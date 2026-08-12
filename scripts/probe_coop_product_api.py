"""Probe Coop Norway product-related endpoints."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (compatible; AltUtenProbe/1.0)",
    "Accept": "application/json, text/plain, */*",
}


def fetch(url: str) -> tuple[int | None, str, bytes]:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read()
    except urllib.error.HTTPError as e:
        body = e.read() if e.fp else b""
        ctype = e.headers.get("Content-Type", "") if e.headers else ""
        return e.code, ctype, body
    except Exception as e:  # noqa: BLE001
        return None, "", str(e).encode()


def main() -> None:
    ids = [
        "1",
        "12",
        "123",
        "1234",
        "12345",
        "100000",
        "702301",
        "702370",
        "70356240",
        "7044610876001",
        "7038010001234",
        "7310865004473",
        "7046110001234",
        "7025110001234",
        "tine",
        "melk",
    ]
    print("=== www.coop.no/api/product/{id} ===")
    for i in ids:
        st, _, body = fetch(f"https://www.coop.no/api/product/{i}")
        snip = body[:100].decode("utf-8", "replace").replace("\n", " ")
        print(f"{i:16} status={st} len={len(body)} {snip}")

    print("\n=== api.coop.no article endpoints ===")
    gtins = [
        "7044610876001",
        "7038010014015",
        "7025110051234",
        "7046110012345",
        "7310865004473",
        "7035620012345",
        "7023010123456",
        "7043500001234",
        "7037710012345",
        "5760466901234",
    ]
    templates = [
        "https://api.coop.no/v1/articles/gtin/{g}",
        "https://api.coop.no/articleSearch/v1/search?q={g}&rows=5&page=0",
        "https://api.coop.no/vippsapp/v1/articles/gtin/{g}",
        "https://api.coop.no/memberapp/v1/articles/gtin/{g}",
        "https://api.coop.no/mss/v1/articles/gtin/{g}",
    ]
    for g in gtins[:4]:
        for tmpl in templates:
            url = tmpl.format(g=g)
            st, ct, body = fetch(url)
            snip = body[:140].decode("utf-8", "replace").replace("\n", " ")
            print(f"{st} {url}")
            print(f"   {ct} {snip}")

    print("\n=== search ===")
    for q in ["melk", "tine", "bread", "coop xtra"]:
        url = f"https://api.coop.no/articleSearch/v1/search?q={urllib.request.quote(q)}&rows=5&page=0"
        st, ct, body = fetch(url)
        print(f"{st} q={q!r} len={len(body)} ct={ct}")
        try:
            data = json.loads(body.decode("utf-8", "replace"))
            print("   keys:", list(data)[:12] if isinstance(data, dict) else type(data))
            print("   snip:", json.dumps(data, ensure_ascii=False)[:220])
        except Exception:
            print("   raw:", body[:180])


if __name__ == "__main__":
    main()
