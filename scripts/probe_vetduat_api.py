import re
from pathlib import Path

temp = Path.home() / "AppData" / "Local" / "Temp"
for name in ["chunk-YEYT7LNA.js", "chunk-AHBVNL5B.js", "chunk-WEMEWHOO.js"]:
    p = temp / name
    if not p.exists():
        print("missing", name)
        continue
    t = p.read_text(encoding="utf-8", errors="ignore")
    print("====", name, "len", len(t))
    seen = set()
    for m in re.finditer(r"/api/[A-Za-z0-9_./${}`+-]+", t):
        s = m.group(0)
        if s not in seen:
            seen.add(s)
            print(s)
    for pat in ["ingrediens", "Ingredients", "ingredient", "gtin", "getProduct", "productDetail"]:
        print(f"  count {pat}:", t.lower().count(pat.lower()))
