"""Migrate catalog PKs to id + import Oda products (barcode=unknown).

Requires SQLCMDPASSWORD (or GLUTENFRIDB_PASSWORD) in the environment.
Skips rows whose name already exists in either table (case-insensitive).
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import tempfile

SERVER = "membercam-sql-529.database.windows.net"
USER = "membercamadmin"
DB = "GlutenFridb"
ROOT = pathlib.Path(__file__).resolve().parents[1]
ODA_FRI = ROOT / "data" / "oda-glutenfri-produkter.json"
ODA_GLUTEN = ROOT / "data" / "oda-gluten-produkter.json"

PASSWORD = os.environ.get("SQLCMDPASSWORD") or os.environ.get("GLUTENFRIDB_PASSWORD")
if not PASSWORD:
    raise SystemExit("Set SQLCMDPASSWORD or GLUTENFRIDB_PASSWORD")


def sqlcmd(query: str | None = None, *, input_file: str | None = None) -> None:
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
    if result.stdout.strip():
        print(result.stdout.strip())


MIGRATE_SQL = r"""
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.glutenfri_new', N'U') IS NOT NULL DROP TABLE dbo.glutenfri_new;
IF OBJECT_ID(N'dbo.gluten_new', N'U') IS NOT NULL DROP TABLE dbo.gluten_new;

IF COL_LENGTH('dbo.glutenfri', 'id') IS NULL
BEGIN
  DECLARE @pk_fri sysname =
    (SELECT name FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.glutenfri') AND type = N'PK');
  IF @pk_fri IS NOT NULL
    EXEC(N'ALTER TABLE dbo.glutenfri DROP CONSTRAINT [' + @pk_fri + N']');
  ALTER TABLE dbo.glutenfri ADD id INT IDENTITY(1,1) NOT NULL;
  ALTER TABLE dbo.glutenfri ADD CONSTRAINT PK_glutenfri PRIMARY KEY (id);
END

IF COL_LENGTH('dbo.gluten', 'id') IS NULL
BEGIN
  DECLARE @pk_g sysname =
    (SELECT name FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.gluten') AND type = N'PK');
  IF @pk_g IS NOT NULL
    EXEC(N'ALTER TABLE dbo.gluten DROP CONSTRAINT [' + @pk_g + N']');
  ALTER TABLE dbo.gluten ADD id INT IDENTITY(1,1) NOT NULL;
  ALTER TABLE dbo.gluten ADD CONSTRAINT PK_gluten PRIMARY KEY (id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_glutenfri_barcode_known' AND object_id = OBJECT_ID(N'dbo.glutenfri'))
  CREATE UNIQUE INDEX UX_glutenfri_barcode_known ON dbo.glutenfri(barcode) WHERE barcode <> N'unknown';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_glutenfri_name' AND object_id = OBJECT_ID(N'dbo.glutenfri'))
  CREATE INDEX IX_glutenfri_name ON dbo.glutenfri(name);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_gluten_barcode_known' AND object_id = OBJECT_ID(N'dbo.gluten'))
  CREATE UNIQUE INDEX UX_gluten_barcode_known ON dbo.gluten(barcode) WHERE barcode <> N'unknown';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_gluten_name' AND object_id = OBJECT_ID(N'dbo.gluten'))
  CREATE INDEX IX_gluten_name ON dbo.gluten(name);

IF OBJECT_ID(N'dbo.barcode_reports', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.barcode_reports (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_barcode_reports PRIMARY KEY,
    catalog NVARCHAR(16) NOT NULL,
    product_id INT NOT NULL,
    product_name NVARCHAR(512) NOT NULL,
    suggested_barcode NVARCHAR(64) NOT NULL,
    reported_by_user_id INT NULL,
    applied BIT NOT NULL CONSTRAINT DF_barcode_reports_applied DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_barcode_reports_created DEFAULT SYSUTCDATETIME()
  );
END

SELECT 'fri' AS tbl, COUNT(*) AS cnt FROM dbo.glutenfri
UNION ALL
SELECT 'gluten', COUNT(*) FROM dbo.gluten;
"""


def load_names(path: pathlib.Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    names: list[str] = []
    for p in data.get("products") or []:
        name = (p.get("name") or "").strip()
        if name:
            names.append(name)
    return names


def insert_batch(table: str, names: list[str]) -> int:
    """Insert unknown-barcode rows; skip names already present in either table."""
    inserted = 0
    batch_size = 80
    for i in range(0, len(names), batch_size):
        chunk = names[i : i + batch_size]
        values = []
        for name in chunk:
            n = name.replace("'", "''")
            values.append(f"(N'{n}')")
        values_sql = ",\n".join(values)
        sql = f"""
SET NOCOUNT ON;
DECLARE @src TABLE (name NVARCHAR(512) NOT NULL);
INSERT INTO @src(name) VALUES
{values_sql};

INSERT INTO dbo.[{table}](barcode, name)
SELECT N'unknown', s.name
FROM @src s
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.glutenfri f WHERE LOWER(f.name) = LOWER(s.name)
)
AND NOT EXISTS (
  SELECT 1 FROM dbo.gluten g WHERE LOWER(g.name) = LOWER(s.name)
);

SELECT @@ROWCOUNT AS inserted;
"""
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", suffix=".sql", delete=False
        ) as tf:
            tf.write(sql)
            tmp = tf.name
        try:
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
                "-i",
                tmp,
            ]
            env = os.environ.copy()
            env["SQLCMDPASSWORD"] = PASSWORD
            result = subprocess.run(cmd, capture_output=True, text=True, env=env)
            if result.returncode != 0:
                print(result.stdout)
                print(result.stderr)
                raise SystemExit(result.returncode)
            # Last numeric line is @@ROWCOUNT
            for line in reversed(result.stdout.splitlines()):
                line = line.strip()
                if line.isdigit():
                    inserted += int(line)
                    break
        finally:
            os.unlink(tmp)
        done = min(i + len(chunk), len(names))
        if done == len(names) or (i // batch_size) % 10 == 0:
            print(f"{table}: processed {done}/{len(names)} (inserted so far {inserted})", flush=True)
    return inserted


def main() -> None:
    print("Migrating schema...", flush=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".sql", delete=False
    ) as tf:
        tf.write(MIGRATE_SQL)
        tmp = tf.name
    try:
        sqlcmd(input_file=tmp)
    finally:
        os.unlink(tmp)

    fri = load_names(ODA_FRI)
    gluten = load_names(ODA_GLUTEN)
    print(f"Oda glutenfri names: {len(fri)}", flush=True)
    print(f"Oda gluten names: {len(gluten)}", flush=True)

    n_fri = insert_batch("glutenfri", fri)
    n_gluten = insert_batch("gluten", gluten)
    print(f"Inserted glutenfri: {n_fri}", flush=True)
    print(f"Inserted gluten: {n_gluten}", flush=True)

    sqlcmd(
        "SELECT 'fri' AS tbl, COUNT(*) AS cnt FROM dbo.glutenfri "
        "UNION ALL SELECT 'gluten', COUNT(*) FROM dbo.gluten "
        "UNION ALL SELECT 'fri_unknown', COUNT(*) FROM dbo.glutenfri WHERE barcode = N'unknown' "
        "UNION ALL SELECT 'gluten_unknown', COUNT(*) FROM dbo.gluten WHERE barcode = N'unknown';"
    )


if __name__ == "__main__":
    main()
