"""Download gluten-free products from Meny (ngdata) API into JSON.

Uses category search to stay under Elasticsearch's ~10k pagination window.
Keeps products where allergens.gluten.code == FRI (same idea as Meny allergen filter).
"""
from __future__ import annotations

import json
import math
import time
import urllib.error
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
OUT = Path(__file__).resolve().parents[1] / "data" / "meny-glutenfri-produkter.json"


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


def is_gluten_free(src: dict) -> bool:
    allergens = src.get("allergens") or []
    gluten = next((a for a in allergens if a.get("name") == "gluten"), None)
    return bool(gluten) and gluten.get("code") == "FRI"


def product_row(src: dict) -> dict:
    title = (src.get("title") or "").strip()
    subtitle = (src.get("subtitle") or "").strip()
    name = f"{title} {subtitle}".strip() if subtitle else title
    return {"name": name, "barcode": src.get("ean") or ""}


def iter_category_products(category: str) -> list[dict]:
    first = fetch(page=1, search=category)
    total = total_hits(first)
    pages = max(1, math.ceil(total / PAGE_SIZE))
    # Hard cap: API breaks past ~10k offset
    if total > 9500:
        print(f"  WARN {category!r} has {total} hits; truncating to first 9500")
        pages = min(pages, 95)
    rows: list[dict] = []
    for page in range(1, pages + 1):
        data = first if page == 1 else fetch(page=page, search=category)
        for hit in data["hits"]["hits"]:
            src = hit["_source"]
            if src.get("categoryName") != category:
                continue
            if not is_gluten_free(src):
                continue
            ean = src.get("ean")
            if not ean:
                continue
            rows.append(product_row(src))
        time.sleep(0.05)
    print(f"  {category}: api={total} glutenfri_in_category={len(rows)}")
    return rows


def main() -> None:
    bootstrap = fetch(page=1, page_size=5)
    categories = [b["key"] for b in bootstrap["aggregations"]["Categories"]["buckets"]]
    print(f"Categories: {len(categories)}")

    by_ean: dict[str, dict] = {}
    for category in categories:
        for row in iter_category_products(category):
            by_ean[row["barcode"]] = row

    products = sorted(by_ean.values(), key=lambda p: (p["name"].lower(), p["barcode"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "Meny / ngdata platform-rest-prod",
        "endpoint": BASE,
        "storeId": "1300",
        "contextEan": "7080001150488",
        "filter": "allergens.gluten.code == FRI and categoryName match",
        "count": len(products),
        "products": products,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(products)} products -> {OUT}")


if __name__ == "__main__":
    main()
