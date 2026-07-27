"""Download the first Meny product image for each catalog barcode and store as base64.

Uses Meny / ngdata product search to resolve imagePath, then downloads:
  https://bilder.ngdata.no/{imagePath}/large.jpg
(fallbacks: medium.jpg, small.jpg)

Updates dbo.glutenfri and dbo.gluten.image_base64 for rows with a real barcode
(skips barcode = 'unknown').

Auth:
  Set SQLCMDPASSWORD or GLUTENFRIDB_PASSWORD, or pass --password.
  Optional: --connection-string / ConnectionStrings__Default env.

Examples:
  python scripts/download_meny_product_images.py --limit 20
  python scripts/download_meny_product_images.py --table glutenfri --force
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pymssql

SERVER = "membercam-sql-529.database.windows.net"
DATABASE = "GlutenFridb"
USER = "membercamadmin"

MENY_BASE = "https://platform-rest-prod.ngdata.no/api/products/1300/7080001150488"
IMAGE_HOST = "https://bilder.ngdata.no"
IMAGE_SIZES = ("large.jpg", "medium.jpg", "small.jpg")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
MENY_HEADERS = {
    "Accept": "application/json",
    "User-Agent": UA,
    "Origin": "https://meny.no",
    "Referer": "https://meny.no/",
}
IMG_HEADERS = {
    "User-Agent": UA,
    "Referer": "https://meny.no/",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


def resolve_password(cli_password: str | None) -> str:
    if cli_password:
        return cli_password
    for key in ("SQLCMDPASSWORD", "GLUTENFRIDB_PASSWORD"):
        val = os.environ.get(key)
        if val:
            return val
    # Fall back to sibling UtenGluten-Backend appsettings (dev machine)
    root = Path(__file__).resolve().parents[1]
    candidates = [
        root.parent / "UtenGluten-Backend" / "GlutenScanner.Api" / "appsettings.Development.json",
        root.parent / "UtenGluten-Backend" / "GlutenScanner.Api" / "appsettings.json",
    ]
    for appsettings in candidates:
        if not appsettings.is_file():
            continue
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


def fetch_json(url: str) -> dict:
    last: Exception | None = None
    for attempt in range(1, 6):
        try:
            req = urllib.request.Request(url, headers=MENY_HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(min(2**attempt, 12))
    assert last is not None
    raise last


def meny_image_path(barcode: str) -> str | None:
    params = urllib.parse.urlencode(
        {
            "page": "1",
            "page_size": "10",
            "full_response": "true",
            "fieldset": "maximal",
            "search": barcode,
            "showNotForSale": "true",
        }
    )
    data = fetch_json(f"{MENY_BASE}?{params}")
    hits = (data.get("hits") or {}).get("hits") or []
    for hit in hits:
        src = hit.get("_source") or {}
        ean = str(src.get("ean") or "").strip()
        if ean != barcode:
            continue
        path = (src.get("imagePath") or "").strip()
        if path:
            return path
        # Fallback when imagePath missing but EAN matches
        return f"{ean}/meny"
    # Last resort: try barcode/meny even if search miss
    return f"{barcode}/meny"


def download_first_image(image_path: str) -> tuple[bytes, str] | None:
    for size in IMAGE_SIZES:
        url = f"{IMAGE_HOST}/{image_path.strip('/')}/{size}"
        try:
            req = urllib.request.Request(url, headers=IMG_HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read()
                ctype = (resp.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip()
                if body and ctype.startswith("image/"):
                    return body, ctype
        except urllib.error.HTTPError as exc:
            if exc.code in (404, 403):
                continue
            raise
        except Exception:  # noqa: BLE001
            continue
    return None


def to_data_uri(raw: bytes, content_type: str) -> str:
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{content_type};base64,{b64}"


def load_targets(conn, table: str, *, force: bool, limit: int | None) -> list[tuple[int, str]]:
    where = ["barcode <> N'unknown'", "barcode IS NOT NULL", "LTRIM(RTRIM(barcode)) <> N''"]
    if not force:
        where.append("(image_base64 IS NULL OR LTRIM(RTRIM(image_base64)) = N'')")
    sql = (
        f"SELECT id, barcode FROM dbo.[{table}] WHERE "
        + " AND ".join(where)
        + " ORDER BY id"
    )
    if limit is not None:
        sql = sql.replace("SELECT id, barcode", f"SELECT TOP ({int(limit)}) id, barcode", 1)
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
    *,
    force: bool,
    limit: int | None,
    sleep_s: float,
) -> None:
    targets = load_targets(conn, table, force=force, limit=limit)
    print(f"[{table}] {len(targets)} products to process", flush=True)
    ok = 0
    miss = 0
    err = 0
    for i, (row_id, barcode) in enumerate(targets, start=1):
        try:
            path = meny_image_path(barcode)
            if not path:
                miss += 1
                print(f"  [{table}] {i}/{len(targets)} id={row_id} {barcode} NO_PATH", flush=True)
                continue
            downloaded = download_first_image(path)
            if not downloaded:
                miss += 1
                print(
                    f"  [{table}] {i}/{len(targets)} id={row_id} {barcode} path={path} NO_IMAGE",
                    flush=True,
                )
                continue
            raw, ctype = downloaded
            payload = to_data_uri(raw, ctype)
            update_image(conn, table, row_id, payload)
            ok += 1
            if i == 1 or i % 25 == 0 or i == len(targets):
                print(
                    f"  [{table}] {i}/{len(targets)} id={row_id} {barcode} "
                    f"ok bytes={len(raw)} saved={ok} miss={miss} err={err}",
                    flush=True,
                )
        except Exception as exc:  # noqa: BLE001
            err += 1
            print(f"  [{table}] {i}/{len(targets)} id={row_id} {barcode} ERR {exc}", flush=True)
        time.sleep(sleep_s)
    print(f"[{table}] done ok={ok} miss={miss} err={err}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--table",
        choices=("glutenfri", "gluten", "both"),
        default="both",
        help="Which catalog table(s) to update",
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
        default=0.12,
        help="Delay between products in seconds",
    )
    args = parser.parse_args()

    password = resolve_password(args.password)
    tables = ["glutenfri", "gluten"] if args.table == "both" else [args.table]

    conn = connect(password)
    try:
        for table in tables:
            process_table(
                conn,
                table,
                force=args.force,
                limit=args.limit,
                sleep_s=args.sleep,
            )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
