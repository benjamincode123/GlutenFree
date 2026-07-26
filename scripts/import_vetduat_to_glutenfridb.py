"""Import VetDuAt products into dbo.glutenfri / dbo.gluten.

Uses the public VetDuAt BFF (same backend as https://vetduat.no/product):
  GET  https://vetduatbffapi.tradesolution.no/api/products/count
  POST https://vetduatbffapi.tradesolution.no/api/products/search
  GET  https://vetduatbffapi.tradesolution.no/api/products/{variantIdentityGuid}

Classification:
  - any gluten allergen in allergenerInneholder or allergenerKanInneholde -> gluten
  - otherwise -> glutenfri

Stores GTIN as barcode and pakning.ingredienser as ingredients.

Requires:
  SQLCMDPASSWORD or GLUTENFRIDB_PASSWORD
  Optional: VETDUAT_LIMIT (int) to cap products for a test run
  Optional: VETDUAT_WORKERS (default 8)
  Optional: VETDUAT_SKIP_DOWNLOAD=1 to only import from existing jsonl

Resumable: writes data/vetduat-products.jsonl and data/vetduat-import.state.json
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

SERVER = "membercam-sql-529.database.windows.net"
USER = "membercamadmin"
DB = "GlutenFridb"
ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
JSONL_PATH = DATA_DIR / "vetduat-products.jsonl"
STATE_PATH = DATA_DIR / "vetduat-import.state.json"
API = "https://vetduatbffapi.tradesolution.no"
ORIGIN = "https://vetduat.no"
PAGE_SIZE = 100
FACETS = [
    "AllergenerInneholder,count:10,sort:count",
    "AllergenerInneholderIkke,count:10,sort:count",
    "AllergenerKanInneholde,count:10,sort:count",
    "KategoriNavn,count:10,sort:count",
    "Varemerke,count:10,sort:count",
    "Varegruppenavn,count:10,sort:count",
    "FirmaNavn,count:10,sort:count",
    "MerkeOrdninger,count:10,sort:count",
    "Produksjonsland,count:10,sort:count",
    "ErStorhusholdningsprodukt,count:10,sort:count",
]

PASSWORD = os.environ.get("SQLCMDPASSWORD") or os.environ.get("GLUTENFRIDB_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set SQLCMDPASSWORD or GLUTENFRIDB_PASSWORD")

LIMIT = int(os.environ["VETDUAT_LIMIT"]) if os.environ.get("VETDUAT_LIMIT") else None
WORKERS = int(os.environ.get("VETDUAT_WORKERS", "8"))
SKIP_DOWNLOAD = os.environ.get("VETDUAT_SKIP_DOWNLOAD") == "1"

_print_lock = threading.Lock()


def log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


def http_json(method: str, url: str, body: dict | None = None, retries: int = 6) -> Any:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Origin": ORIGIN,
        "Referer": f"{ORIGIN}/product?q=",
        "User-Agent": "UtenGlutenImporter/1.0",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read()
                if not raw:
                    raise RuntimeError(f"empty response from {url}")
                return json.loads(raw.decode("utf-8"))
        except Exception as err:  # noqa: BLE001
            last_err = err
            wait = min(30.0, 1.5 ** attempt)
            if isinstance(err, urllib.error.HTTPError) and err.code in (429, 503):
                wait = max(wait, 5.0)
            time.sleep(wait)
    raise RuntimeError(f"request failed {method} {url}: {last_err}")


def sqlcmd(query: str | None = None, *, input_file: str | None = None) -> str:
    cmd = [
        "sqlcmd",
        "-S",
        f"tcp:{SERVER},1433",
        "-d",
        DB,
        "-U",
        USER,
        "-l",
        "60",
        "-b",
        "-h",
        "-1",
        "-W",
    ]
    env = os.environ.copy()
    env["SQLCMDPASSWORD"] = PASSWORD
    if input_file:
        cmd.extend(["-i", input_file])
    else:
        assert query is not None
        cmd.extend(["-Q", query])
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout


ENSURE_SQL = r"""
SET NOCOUNT ON;
IF COL_LENGTH(N'dbo.glutenfri', N'ingredients') IS NULL
  ALTER TABLE dbo.glutenfri ADD ingredients NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.gluten', N'ingredients') IS NULL
  ALTER TABLE dbo.gluten ADD ingredients NVARCHAR(MAX) NULL;
SELECT 'ok' AS status;
"""


def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"search_skip": 0, "downloaded_guids": 0, "imported_lines": 0}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def is_gluten_allergen(value: str) -> bool:
    return "gluten" in (value or "").casefold()


def classify_table(pakning: dict[str, Any]) -> str:
    contains = pakning.get("allergenerInneholder") or []
    may = pakning.get("allergenerKanInneholde") or []
    if any(is_gluten_allergen(str(x)) for x in [*contains, *may]):
        return "gluten"
    return "glutenfri"


def pick_pakning(detail: dict[str, Any]) -> dict[str, Any] | None:
    packs = detail.get("pakninger") or []
    if not packs:
        return None
    for p in packs:
        if p.get("isBasispakning") is True and p.get("gtin"):
            return p
    for p in packs:
        if p.get("gtin"):
            return p
    return None


def normalize_row(detail: dict[str, Any]) -> dict[str, Any] | None:
    pakning = pick_pakning(detail)
    if pakning is None:
        return None
    gtin = str(pakning.get("gtin") or "").strip()
    if not gtin or gtin.lower() == "unknown":
        return None
    name = (pakning.get("markedsnavn") or detail.get("fellesProduktnavn") or "").strip()
    if not name:
        name = f"GTIN {gtin}"
    ingredients = (pakning.get("ingredienser") or "").strip() or None
    return {
        "table": classify_table(pakning),
        "barcode": gtin,
        "name": name[:512],
        "ingredients": ingredients,
        "variantIdentityGuid": detail.get("variantIdentityGuid"),
        "allergenerInneholder": pakning.get("allergenerInneholder") or [],
        "allergenerKanInneholde": pakning.get("allergenerKanInneholde") or [],
    }


def download_all() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()
    count = int(http_json("GET", f"{API}/api/products/count"))
    log(f"VetDuAt product count: {count}")
    target = min(count, LIMIT) if LIMIT else count

    seen: set[str] = set()
    if JSONL_PATH.exists():
        with JSONL_PATH.open(encoding="utf-8") as fh:
            for line in fh:
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                guid = row.get("variantIdentityGuid")
                if guid:
                    seen.add(str(guid))
    log(f"Already downloaded rows: {len(seen)}")

    skip = int(state.get("search_skip") or 0)
    write_lock = threading.Lock()

    def fetch_and_write(guid: str) -> bool:
        if guid in seen:
            return False
        detail = http_json("GET", f"{API}/api/products/{guid}")
        row = normalize_row(detail)
        if row is None:
            return False
        with write_lock:
            if guid in seen:
                return False
            with JSONL_PATH.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            seen.add(guid)
        return True

    while skip < target:
        top = min(PAGE_SIZE, target - skip)
        payload = {
            "searchBody": {
                "facets": FACETS,
                "top": top,
                "skip": skip,
                "count": True,
                "search": "*",
            }
        }
        page = http_json("POST", f"{API}/api/products/search", payload)
        products = page.get("products") or []
        if not products:
            log(f"No more products at skip={skip}")
            break

        guids = [
            str(p.get("variantIdentityGuid"))
            for p in products
            if p.get("variantIdentityGuid")
        ]
        added = 0
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(fetch_and_write, g) for g in guids]
            for fut in as_completed(futures):
                if fut.result():
                    added += 1

        skip += len(products)
        state["search_skip"] = skip
        state["downloaded_guids"] = len(seen)
        save_state(state)
        log(
            f"search skip={skip}/{target} page={len(products)} "
            f"new_details={added} total_rows={len(seen)}"
        )

    log(f"Download complete. jsonl rows ~= {len(seen)}")


def sql_quote(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "N'" + value.replace("'", "''") + "'"


def upsert_batch(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    values_sql = []
    for r in rows:
        values_sql.append(
            "("
            + ",".join(
                [
                    sql_quote(r["table"]),
                    sql_quote(r["barcode"]),
                    sql_quote(r["name"]),
                    sql_quote(r.get("ingredients")),
                ]
            )
            + ")"
        )
    sql = f"""
SET NOCOUNT ON;
DECLARE @src TABLE (
  dest NVARCHAR(16) NOT NULL,
  barcode NVARCHAR(64) NOT NULL,
  name NVARCHAR(512) NOT NULL,
  ingredients NVARCHAR(MAX) NULL
);
INSERT INTO @src(dest, barcode, name, ingredients) VALUES
{",".join(values_sql)};

DELETE f
FROM dbo.glutenfri f
INNER JOIN @src s ON s.barcode = f.barcode AND s.dest = N'gluten'
WHERE f.barcode <> N'unknown';

DELETE g
FROM dbo.gluten g
INNER JOIN @src s ON s.barcode = g.barcode AND s.dest = N'glutenfri'
WHERE g.barcode <> N'unknown';

UPDATE f
SET f.name = s.name,
    f.ingredients = s.ingredients
FROM dbo.glutenfri f
INNER JOIN @src s ON s.barcode = f.barcode AND s.dest = N'glutenfri';

INSERT INTO dbo.glutenfri(barcode, name, ingredients)
SELECT s.barcode, s.name, s.ingredients
FROM @src s
WHERE s.dest = N'glutenfri'
  AND NOT EXISTS (SELECT 1 FROM dbo.glutenfri f WHERE f.barcode = s.barcode);

UPDATE g
SET g.name = s.name,
    g.ingredients = s.ingredients
FROM dbo.gluten g
INNER JOIN @src s ON s.barcode = g.barcode AND s.dest = N'gluten';

INSERT INTO dbo.gluten(barcode, name, ingredients)
SELECT s.barcode, s.name, s.ingredients
FROM @src s
WHERE s.dest = N'gluten'
  AND NOT EXISTS (SELECT 1 FROM dbo.gluten g WHERE g.barcode = s.barcode);
"""
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".sql", delete=False
    ) as tf:
        tf.write(sql)
        tmp = tf.name
    try:
        sqlcmd(input_file=tmp)
    finally:
        os.unlink(tmp)


def import_jsonl() -> None:
    if not JSONL_PATH.exists():
        raise SystemExit(f"Missing {JSONL_PATH}")
    state = load_state()
    start_line = int(state.get("imported_lines") or 0)
    batch: list[dict[str, Any]] = []
    line_no = 0
    seen_barcodes: set[str] = set()
    with JSONL_PATH.open(encoding="utf-8") as fh:
        for line in fh:
            line_no += 1
            if line_no <= start_line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            barcode = str(row.get("barcode") or "").strip()
            if not barcode or barcode in seen_barcodes:
                continue
            seen_barcodes.add(barcode)
            batch.append(row)
            if len(batch) >= 40:
                upsert_batch(batch)
                state["imported_lines"] = line_no
                save_state(state)
                log(f"imported through line {line_no}")
                batch.clear()
        if batch:
            upsert_batch(batch)
            state["imported_lines"] = line_no
            save_state(state)
            log(f"imported through line {line_no}")

    sqlcmd(
        "SELECT 'fri' AS tbl, COUNT(*) AS cnt FROM dbo.glutenfri "
        "UNION ALL SELECT 'gluten', COUNT(*) FROM dbo.gluten "
        "UNION ALL SELECT 'fri_with_ingredients', COUNT(*) FROM dbo.glutenfri WHERE ingredients IS NOT NULL "
        "UNION ALL SELECT 'gluten_with_ingredients', COUNT(*) FROM dbo.gluten WHERE ingredients IS NOT NULL;"
    )


def main() -> None:
    log("Ensuring ingredients columns...")
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".sql", delete=False
    ) as tf:
        tf.write(ENSURE_SQL)
        tmp = tf.name
    try:
        sqlcmd(input_file=tmp)
    finally:
        os.unlink(tmp)

    if not SKIP_DOWNLOAD:
        download_all()
    else:
        log("Skipping download (VETDUAT_SKIP_DOWNLOAD=1)")

    log("Upserting into SQL...")
    import_jsonl()
    log("Done.")


if __name__ == "__main__":
    main()
