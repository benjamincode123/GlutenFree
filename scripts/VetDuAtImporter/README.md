# VetDuAt → GlutenFridb importer

Parallel C# importer for ~97k products from VetDuAt BFF into Azure SQL.

## Speed

Default **96 concurrent workers**. Expect roughly:

| Rate | Full ~97k |
|------|-----------|
| ~54/s | ~30 min |
| ~27/s | ~60 min |

If the API rate-limits (429), lower `VETDUAT_WORKERS` (e.g. 48).

## Run

```powershell
cd scripts\VetDuAtImporter

$env:SQLCMDPASSWORD = "<password>"   # or GLUTENFRIDB_CONNECTION / GLUTENFRIDB_PASSWORD
# $env:VETDUAT_WORKERS = "96"
# $env:VETDUAT_LIMIT = "100"         # smoke test
# $env:VETDUAT_WRITE_JSONL = "1"     # optional resume file under data/

dotnet run -c Release
```

## Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `SQLCMDPASSWORD` / `GLUTENFRIDB_PASSWORD` | — | Azure SQL password |
| `GLUTENFRIDB_CONNECTION` | — | Full connection string (overrides above) |
| `VETDUAT_WORKERS` | `96` | Parallel detail HTTP workers |
| `VETDUAT_LIMIT` | all | Cap products imported |
| `VETDUAT_SKIP` | `0` | Skip N search hits |
| `VETDUAT_WRITE_JSONL` | off | `1` = append resume jsonl |
| `VETDUAT_JSONL` | `data/vetduat-products.jsonl` | Jsonl path |

Classification: allergen text containing `gluten` (contains or may-contain) → `dbo.gluten`, else `dbo.glutenfri`. GTIN → barcode; `ingredienser` → `ingredients`.

Only **dagligvare** products are imported (`ErStorhusholdningsprodukt eq false`).
