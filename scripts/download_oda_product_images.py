"""Download the first Oda product image for unknown-barcode catalog rows.

Oda products in dbo.glutenfri / dbo.gluten use barcode = 'unknown', so matching
is done by product name (case-insensitive).

1) Harvest Oda search API (prefix partitioning) to map product name -> image URL
2) Download the first image and store as data-URI base64 in image_base64

Auth:
  Set SQLCMDPASSWORD or GLUTENFRIDB_PASSWORD, or pass --password.

Examples:
  python scripts/download_oda_product_images.py --limit 20
  python scripts/download_oda_product_images.py --table glutenfri --force
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import string
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pymssql

SERVER = "membercam-sql-529.database.windows.net"
DATABASE = "GlutenFridb"
USER = "membercamadmin"

BASE = "https://oda.com/api/v1/search/mixed/"
PAGE_SIZE = 100
MAX_PAGE = 49

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Referer": "https://oda.com/no/",
}
IMG_HEADERS = {
    "User-Agent": UA,
    "Referer": "https://oda.com/no/",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


def resolve_password(cli_password: str | None) -> str:
    if cli_password:
        return cli_password
    for key in ("SQLCMDPASSWORD", "GLUTENFRIDB_PASSWORD"):
        val = os.environ.get(key)
        if val:
            return val
    appsettings = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "GlutenScanner.Api"
        / "appsettings.json"
    )
    if appsettings.is_file():
        data = json.loads(appsettings.read_text(encoding="utf-8"))
        cs = (data.get("ConnectionStrings") or {}).get("Default") or ""
        if "Password=" in cs:
            return cs.split("Password=", 1)[1].split(";", 1)[0]
    raise SystemExit(
        "Missing SQL password. Set SQLCMDPASSWORD / GLUTENFRIDB_PASSWORD or pass --password."
    )


def connect(password: str):
    return pymssql.connect(
        server=SERVER,
        user=USER,
        password=password,
        database=DATABASE,
        login_timeout=60,
        timeout=120,
    )


def fetch_page(*, filters: str, page: int, q: str) -> dict:
    params = {
        "q": q,
        "type": "product",
        "page": str(page),
        "size": str(PAGE_SIZE),
    }
    if filters:
        params["filters"] = filters
    url = BASE + "?" + urllib.parse.urlencode(params)
    last: Exception | None = None
    for attempt in range(1, 7):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(min(2**attempt, 12))
    assert last is not None
    raise last


def product_count(data: dict) -> int | None:
    for rt in (data.get("attributes") or {}).get("request_types") or []:
        if rt.get("type") == "product":
            return int(rt.get("count") or 0)
    return None


def product_name(attrs: dict) -> str:
    full = (attrs.get("full_name") or "").strip()
    if full:
        return full
    name = (attrs.get("name") or "").strip()
    extra = (attrs.get("name_extra") or "").strip()
    return " ".join(p for p in [name, extra] if p)


def first_image_url(attrs: dict) -> str | None:
    images = attrs.get("images") or []
    if not images:
        return None
    first = images[0] or {}
    for key in ("large", "thumbnail"):
        block = first.get(key) or {}
        url = (block.get("url") or "").strip()
        if url:
            return url
    # Rare alternate shapes
    if isinstance(first.get("url"), str) and first["url"].strip():
        return first["url"].strip()
    return None


def prefixes() -> list[str]:
    return list(string.ascii_lowercase) + ["æ", "ø", "å"] + list(string.digits)


def harvest_image_map(*, filters: str, label: str) -> dict[str, str]:
    """Return casefolded name -> image URL."""
    out: dict[str, str] = {}

    def ingest(data: dict) -> int:
        added = 0
        for item in data.get("items") or []:
            if item.get("type") != "product":
                continue
            attrs = item.get("attributes") or {}
            name = product_name(attrs)
            url = first_image_url(attrs)
            if not name or not url:
                continue
            key = name.casefold()
            if key not in out:
                out[key] = url
                added += 1
        return added

    def iter_query(q: str) -> None:
        empty_streak = 0
        for page in range(1, MAX_PAGE + 1):
            try:
                data = fetch_page(filters=filters, page=page, q=q)
            except Exception as exc:  # noqa: BLE001
                print(f"  [{label} q={q!r}] page={page} ERR {exc}", flush=True)
                break
            attrs = data.get("attributes") or {}
            has_more = bool(attrs.get("has_more_items"))
            added = ingest(data)
            if page == 1 or page % 10 == 0 or not has_more:
                print(
                    f"  [{label} q={q!r}] page={page} +{added} map={len(out)} more={has_more}",
                    flush=True,
                )
            if added == 0:
                empty_streak += 1
            else:
                empty_streak = 0
            if not has_more or empty_streak >= 3:
                break
            time.sleep(0.06)

    print(f"[{label}] empty query", flush=True)
    iter_query("")

    for pfx in prefixes():
        try:
            first = fetch_page(filters=filters, page=1, q=pfx)
        except Exception as exc:  # noqa: BLE001
            print(f"[{label}] prefix {pfx!r} ERR {exc}", flush=True)
            continue
        count = product_count(first) or 0
        print(f"[{label}] prefix {pfx!r} count={count}", flush=True)
        if count == 0:
            continue
        if count > MAX_PAGE * 50:
            for c2 in list(string.ascii_lowercase) + ["æ", "ø", "å"] + list(string.digits):
                iter_query(pfx + c2)
        else:
            ingest(first)
            iter_query(pfx)
        time.sleep(0.04)

    print(f"[{label}] image map size={len(out)}", flush=True)
    return out


def download_image(url: str) -> tuple[bytes, str] | None:
    last: Exception | None = None
    for attempt in range(1, 5):
        try:
            req = urllib.request.Request(url, headers=IMG_HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read()
                ctype = (resp.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip()
                if body and (ctype.startswith("image/") or url.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))):
                    if not ctype.startswith("image/"):
                        ctype = "image/jpeg"
                    return body, ctype
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code in (404, 403):
                return None
            time.sleep(min(2**attempt, 8))
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(min(2**attempt, 8))
    if last:
        raise last
    return None


def to_data_uri(raw: bytes, content_type: str) -> str:
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{content_type};base64,{b64}"


def load_targets(conn, table: str, *, force: bool, limit: int | None) -> list[tuple[int, str]]:
    where = ["barcode = N'unknown'", "name IS NOT NULL", "LTRIM(RTRIM(name)) <> N''"]
    if not force:
        where.append("(image_base64 IS NULL OR LTRIM(RTRIM(image_base64)) = N'')")
    sql = (
        f"SELECT id, name FROM dbo.[{table}] WHERE "
        + " AND ".join(where)
        + " ORDER BY id"
    )
    if limit is not None:
        sql = sql.replace("SELECT id, name", f"SELECT TOP ({int(limit)}) id, name", 1)
    cur = conn.cursor()
    cur.execute(sql)
    rows = [(int(r[0]), str(r[1]).strip()) for r in cur.fetchall()]
    cur.close()
    return rows


def update_image(conn, table: str, row_id: int, image_base64: str) -> None:
    cur = conn.cursor()
    cur.execute(
        f"UPDATE dbo.[{table}] SET image_base64 = %s WHERE id = %s",
        (image_base64, row_id),
    )
    conn.commit()
    cur.close()


def process_table(
    conn,
    table: str,
    image_map: dict[str, str],
    *,
    force: bool,
    limit: int | None,
    sleep_s: float,
) -> None:
    targets = load_targets(conn, table, force=force, limit=limit)
    print(f"[{table}] {len(targets)} unknown-barcode products to process", flush=True)
    ok = 0
    miss = 0
    err = 0
    for i, (row_id, name) in enumerate(targets, start=1):
        try:
            url = image_map.get(name.casefold())
            if not url:
                # Fallback: one targeted search by product name
                data = fetch_page(filters="", page=1, q=name[:80])
                for item in data.get("items") or []:
                    if item.get("type") != "product":
                        continue
                    attrs = item.get("attributes") or {}
                    if product_name(attrs).casefold() != name.casefold():
                        continue
                    url = first_image_url(attrs)
                    if url:
                        image_map[name.casefold()] = url
                    break

            if not url:
                miss += 1
                if i == 1 or i % 50 == 0 or i == len(targets):
                    print(
                        f"  [{table}] {i}/{len(targets)} id={row_id} NO_URL name={name[:60]!r}",
                        flush=True,
                    )
                continue

            downloaded = download_image(url)
            if not downloaded:
                miss += 1
                print(
                    f"  [{table}] {i}/{len(targets)} id={row_id} NO_IMAGE name={name[:60]!r}",
                    flush=True,
                )
                continue

            raw, ctype = downloaded
            update_image(conn, table, row_id, to_data_uri(raw, ctype))
            ok += 1
            if i == 1 or i % 25 == 0 or i == len(targets):
                print(
                    f"  [{table}] {i}/{len(targets)} id={row_id} ok bytes={len(raw)} "
                    f"saved={ok} miss={miss} err={err}",
                    flush=True,
                )
        except Exception as exc:  # noqa: BLE001
            err += 1
            print(f"  [{table}] {i}/{len(targets)} id={row_id} ERR {exc}", flush=True)
        time.sleep(sleep_s)
    print(f"[{table}] done ok={ok} miss={miss} err={err}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--table",
        choices=("glutenfri", "gluten", "both"),
        default="both",
        help="Which catalog table(s) to update (unknown barcodes only)",
    )
    parser.add_argument("--limit", type=int, default=None, help="Max rows per table")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite rows that already have image_base64",
    )
    parser.add_argument("--password", default=None, help="SQL password (optional)")
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.05,
        help="Delay between image downloads in seconds",
    )
    parser.add_argument(
        "--skip-harvest",
        action="store_true",
        help="Skip Oda map harvest; resolve each product with a direct search only",
    )
    args = parser.parse_args()

    password = resolve_password(args.password)
    tables = ["glutenfri", "gluten"] if args.table == "both" else [args.table]

    image_map: dict[str, str] = {}
    if not args.skip_harvest:
        # Gluten-free set first, then full catalog to cover gluten-holding Oda rows.
        fri_map = harvest_image_map(filters="allergens_free:gluten_free", label="oda-fri")
        image_map.update(fri_map)
        all_map = harvest_image_map(filters="", label="oda-all")
        # Keep fri URLs if already present; fill gaps from all.
        for k, v in all_map.items():
            image_map.setdefault(k, v)
        print(f"[harvest] combined image map size={len(image_map)}", flush=True)

    conn = connect(password)
    try:
        for table in tables:
            process_table(
                conn,
                table,
                image_map,
                force=args.force,
                limit=args.limit,
                sleep_s=args.sleep,
            )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
