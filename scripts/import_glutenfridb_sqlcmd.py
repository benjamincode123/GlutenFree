import csv
import os
import subprocess
import pathlib

SERVER = "membercam-sql-529.database.windows.net"
USER = "membercamadmin"
PASSWORD = os.environ["GLUTENFRIDB_PASSWORD"]
DATA = pathlib.Path(r"c:\Users\benja\Documents\GlutenFree\data\import")
BATCH_SQL = pathlib.Path(os.environ["TEMP"]) / "gluten_batch.sql"


def load(table: str, path: pathlib.Path) -> None:
    rows = list(csv.reader(path.open(encoding="utf-8"), delimiter="|"))
    print(table, "rows", len(rows), flush=True)
    batch = 150
    for i in range(0, len(rows), batch):
        chunk = rows[i : i + batch]
        values = []
        for barcode, name in chunk:
            b = barcode.replace("'", "''")
            n = name.replace("'", "''")
            values.append(f"(N'{b}', N'{n}')")
        sql = f"INSERT INTO dbo.[{table}](barcode, name) VALUES\n" + ",\n".join(values) + ";\n"
        BATCH_SQL.write_text(sql, encoding="utf-8")
        result = subprocess.run(
            [
                "sqlcmd",
                "-S",
                SERVER,
                "-d",
                "GlutenFridb",
                "-U",
                USER,
                "-P",
                PASSWORD,
                "-l",
                "60",
                "-b",
                "-i",
                str(BATCH_SQL),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(result.stdout)
            print(result.stderr)
            raise SystemExit(result.returncode)
        done = min(i + len(chunk), len(rows))
        if done == len(rows) or (i // batch) % 15 == 0:
            print(table, done, "/", len(rows), flush=True)
    print(table, "done", flush=True)


if __name__ == "__main__":
    load("glutenfri", DATA / "glutenfri.csv")
    load("gluten", DATA / "gluten.csv")
