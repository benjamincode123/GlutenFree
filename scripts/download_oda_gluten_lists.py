"""Download Oda gluten-free and gluten-containing lists (Meny-style JSON).

API: https://oda.com/api/v1/search/mixed/
- Hard page cap around 50 → partition by search prefix
- glutenfri: filters=allergens_free:gluten_free
- gluten: all products minus glutenfri
Barcode unknown (not in API).
"""
from __future__ import annotations

import json
import string
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
OUT_FRI = DATA / "oda-glutenfri-produkter.json"
OUT_GLUTEN = DATA / "oda-gluten-produkter.json"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
BASE = "https://oda.com/api/v1/search/mixed/"
PAGE_SIZE = 100  # API returns up to ~50
MAX_PAGE = 49  # page 50+ returns 422


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
    for attempt in range(1, 8):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": UA,
                    "Accept": "application/json",
                    "Referer": "https://oda.com/no/",
                },
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(min(2**attempt, 15))
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


def prefixes() -> list[str]:
    # Latin letters + Norwegian + digits
    base = list(string.ascii_lowercase) + ["æ", "ø", "å"] + list(string.digits)
    # Expand busy first letters into digraphs when needed at runtime
    return base


def iter_query(*, filters: str, q: str, label: str) -> dict[int, str]:
    out: dict[int, str] = {}
    empty_streak = 0
    for page in range(1, MAX_PAGE + 1):
        try:
            data = fetch_page(filters=filters, page=page, q=q)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{label} q={q!r}] page={page} ERR {exc}", flush=True)
            break
        attrs = data.get("attributes") or {}
        has_more = bool(attrs.get("has_more_items"))
        items = data.get("items") or []
        added = 0
        for item in items:
            if item.get("type") != "product":
                continue
            a = item.get("attributes") or {}
            pid = a.get("id") or item.get("id")
            name = product_name(a)
            if pid is None or not name:
                continue
            pid = int(pid)
            if pid not in out:
                out[pid] = name
                added += 1
        if page == 1 or page % 10 == 0 or not has_more:
            print(
                f"  [{label} q={q!r}] page={page} +{added} unique={len(out)} more={has_more}",
                flush=True,
            )
        if added == 0:
            empty_streak += 1
        else:
            empty_streak = 0
        if not has_more or not items or empty_streak >= 3:
            break
        time.sleep(0.08)
    return out


def harvest(*, filters: str, label: str) -> dict[int, str]:
    out: dict[int, str] = {}
    # Start with empty query (gets first ~49 pages), then fill gaps via prefixes
    print(f"[{label}] empty query", flush=True)
    out.update(iter_query(filters=filters, q="", label=label))

    for pfx in prefixes():
        first = fetch_page(filters=filters, page=1, q=pfx)
        count = product_count(first) or 0
        print(f"[{label}] prefix {pfx!r} count={count}", flush=True)
        if count == 0:
            continue
        # If too large for one prefix window, dig deeper
        if count > MAX_PAGE * 50:
            for c2 in list(string.ascii_lowercase) + ["æ", "ø", "å"] + list(string.digits):
                q2 = pfx + c2
                out.update(iter_query(filters=filters, q=q2, label=label))
        else:
            out.update(iter_query(filters=filters, q=pfx, label=label))
        time.sleep(0.05)

    print(f"[{label}] TOTAL unique={len(out)}", flush=True)
    return out


def dump(path: Path, by_id: dict[int, str], note: str) -> None:
    rows = [
        {"name": n, "barcode": "unknown"}
        for _, n in sorted(by_id.items(), key=lambda x: x[1].casefold())
    ]
    seen: set[str] = set()
    unique: list[dict] = []
    for row in rows:
        key = row["name"].casefold()
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    payload = {
        "source": "Oda / oda.com",
        "endpoint": "https://oda.com/api/v1/search/mixed/",
        "note": note,
        "count": len(unique),
        "products": unique,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(unique)} -> {path}", flush=True)


def main() -> None:
    fri = harvest(filters="allergens_free:gluten_free", label="glutenfri")
    all_products = harvest(filters="", label="all")
    all_products.update(fri)
    gluten = {pid: name for pid, name in all_products.items() if pid not in fri}

    dump(
        OUT_FRI,
        fri,
        "Glutenfri: allergens_free:gluten_free; barcode unknown (Oda search API has no EAN)",
    )
    dump(
        OUT_GLUTEN,
        gluten,
        "Not in Oda gluten-free set (treated as gluten-containing); barcode unknown",
    )


if __name__ == "__main__":
    main()
