"""Download all Meny products; split into glutenfri vs gluten using existing fri file + allergen codes.

- glutenfri file: products with allergens.gluten.code == FRI (refreshed)
- gluten file: all other products (not in glutenfri set) — treated as not gluten-free
"""
from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://platform-rest-prod.ngdata.no/api/products/1300/7080001150488"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Origin": "https://meny.no",
    "Referer": "https://meny.no/",
}
PAGE_SIZE = 100
DATA = Path(__file__).resolve().parents[1] / "data"
FRI_PATH = DATA / "meny-glutenfri-produkter.json"
GLUTEN_PATH = DATA / "meny-gluten-produkter.json"


def fetch(page: int = 1, page_size: int = PAGE_SIZE, search: str | None = None) -> dict:
    params: dict[str, str] = {
        "page": str(page),
        "page_size": str(page_size),
        "full_response": "true",
        "fieldset": "maximal",
        "facets": "Category,Allergen",
        "showNotForSale": "true",
    }
    if search:
        params["search"] = search
    url = f"{BASE}?{urllib.parse.urlencode(params)}"
    last: Exception | None = None
    for attempt in range(1, 8):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(min(2**attempt, 30))
    assert last is not None
    raise last


def total_hits(data: dict) -> int:
    total = data["hits"]["total"]
    if isinstance(total, dict):
        return int(total.get("value", 0))
    return int(total)


def product_row(src: dict) -> dict:
    title = (src.get("title") or "").strip()
    subtitle = (src.get("subtitle") or "").strip()
    name = f"{title} {subtitle}".strip() if subtitle else title
    gluten = next((a for a in (src.get("allergens") or []) if a.get("name") == "gluten"), None)
    return {
        "name": name,
        "barcode": src.get("ean") or "",
        "glutenCode": (gluten or {}).get("code"),
        "category": src.get("categoryName") or "",
    }


def is_declared_gluten_free(src: dict) -> bool:
    gluten = next((a for a in (src.get("allergens") or []) if a.get("name") == "gluten"), None)
    return bool(gluten) and gluten.get("code") == "FRI"


def iter_category_products(category: str) -> list[dict]:
    first = fetch(page=1, search=category)
    total = total_hits(first)
    pages = max(1, math.ceil(total / PAGE_SIZE))
    if total > 9500:
        print(f"  WARN {category!r} has {total} hits; truncating")
        pages = min(pages, 95)

    rows: list[dict] = []
    for page in range(1, pages + 1):
        data = first if page == 1 else fetch(page=page, search=category)
        for hit in data["hits"]["hits"]:
            src = hit["_source"]
            if src.get("categoryName") != category:
                continue
            ean = src.get("ean")
            if not ean:
                continue
            rows.append({"src": src, "row": product_row(src)})
        time.sleep(0.05)
    print(f"  {category}: {len(rows)} products")
    return rows


def dump(path: Path, products: list[dict], note: str) -> None:
    slim = [{"name": p["name"], "barcode": p["barcode"]} for p in products]
    payload = {
        "source": "Meny / ngdata platform-rest-prod",
        "endpoint": BASE,
        "storeId": "1300",
        "contextEan": "7080001150488",
        "note": note,
        "count": len(slim),
        "products": slim,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(slim)} -> {path}")


def main() -> None:
    # Prefer barcodes already registered as glutenfri, if file exists
    existing_fri: set[str] = set()
    if FRI_PATH.exists():
        prev = json.loads(FRI_PATH.read_text(encoding="utf-8"))
        existing_fri = {p["barcode"] for p in prev.get("products", []) if p.get("barcode")}
        print(f"Loaded {len(existing_fri)} barcodes from existing glutenfri file")

    bootstrap = fetch(page=1, page_size=5)
    categories = [b["key"] for b in bootstrap["aggregations"]["Categories"]["buckets"]]
    print(f"Categories: {len(categories)}")

    all_by_ean: dict[str, dict] = {}
    fri_by_ean: dict[str, dict] = {}

    for category in categories:
        for item in iter_category_products(category):
            src, row = item["src"], item["row"]
            ean = row["barcode"]
            all_by_ean[ean] = row
            # Keep / refresh fri set: declared FRI OR already registered
            if is_declared_gluten_free(src) or ean in existing_fri:
                fri_by_ean[ean] = {"name": row["name"], "barcode": ean}

    # Anything not in glutenfri set goes to gluten file
    gluten_by_ean = {
        ean: {"name": row["name"], "barcode": ean}
        for ean, row in all_by_ean.items()
        if ean not in fri_by_ean
    }

    fri_list = sorted(fri_by_ean.values(), key=lambda p: (p["name"].lower(), p["barcode"]))
    gluten_list = sorted(gluten_by_ean.values(), key=lambda p: (p["name"].lower(), p["barcode"]))

    dump(
        FRI_PATH,
        fri_list,
        "Glutenfri: allergens.gluten.code == FRI (plus previously registered barcodes)",
    )
    dump(
        GLUTEN_PATH,
        gluten_list,
        "Inneholder gluten / ikke glutenfritt: alle produkter som ikke finnes i glutenfri-filen",
    )
    print(f"Total unique products: {len(all_by_ean)}")
    print(f"Glutenfri: {len(fri_list)} | Gluten: {len(gluten_list)}")


if __name__ == "__main__":
    main()
