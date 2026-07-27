# Data & import scripts moved

Product/import JSON/CSV data and related download/import scripts were moved to the backend split repo:

- Data: `c:\Users\benja\Documents\UtenGluten-Backend\data\`
- Scripts: `c:\Users\benja\Documents\UtenGluten-Backend\scripts\`

Moved scripts (paths use `ROOT = Path(__file__).resolve().parents[1]`, `DATA_DIR = ROOT / "data"`):
- download_vinmonopolet_products.py
- download_meny_glutenfri.py
- download_meny_gluten_lists.py
- download_oda_gluten_lists.py
- import_glutenfridb_sqlcmd.py
- import_oda_to_glutenfridb.py
- import_vetduat_to_glutenfridb.py

Image download / VetDuAt probe scripts remain here under `GlutenFree\scripts\`.
