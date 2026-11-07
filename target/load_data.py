"""Load ClickBench `hits` Parquet partitions (target/data/hits_*.parquet) into raw.hits_raw. Run once.

Keeps a realistic subset of columns with proper types; the agent's schema.sql decides how `hits` is stored.
"""

import time

from chclient import client

# (column, ClickHouse type, expression over the Parquet file)
COLUMNS = [
    ("WatchID", "Int64", "WatchID"),
    ("EventTime", "DateTime", "toDateTime(EventTime)"),
    ("EventDate", "Date", "toDate(EventDate)"),
    ("CounterID", "UInt32", "CounterID"),
    ("UserID", "Int64", "UserID"),
    ("ClientIP", "Int32", "ClientIP"),
    ("RegionID", "UInt32", "RegionID"),
    ("OS", "UInt8", "OS"),
    ("UserAgent", "UInt8", "UserAgent"),
    ("IsMobile", "UInt8", "IsMobile"),
    ("MobilePhoneModel", "String", "MobilePhoneModel"),
    ("ResolutionWidth", "UInt16", "ResolutionWidth"),
    ("URL", "String", "URL"),
    ("Referer", "String", "Referer"),
    ("Title", "String", "Title"),
    ("IsRefresh", "UInt8", "IsRefresh"),
    ("IsLink", "UInt8", "IsLink"),
    ("IsDownload", "UInt8", "IsDownload"),
    ("DontCountHits", "UInt8", "DontCountHits"),
    ("TraficSourceID", "Int8", "TraficSourceID"),
    ("SearchEngineID", "UInt16", "SearchEngineID"),
    ("SearchPhrase", "String", "SearchPhrase"),
    ("AdvEngineID", "UInt8", "AdvEngineID"),
    ("BrowserLanguage", "String", "BrowserLanguage"),
    ("BrowserCountry", "String", "BrowserCountry"),
    ("URLHash", "Int64", "URLHash"),
    ("RefererHash", "Int64", "RefererHash"),
]


def main():
    ch = client()
    t0 = time.time()
    ch.command("CREATE DATABASE IF NOT EXISTS raw")
    ch.command("DROP TABLE IF EXISTS raw.hits_raw")
    cols = ",\n  ".join(f"{name} {typ}" for name, typ, _ in COLUMNS)
    ch.command(f"CREATE TABLE raw.hits_raw (\n  {cols}\n) ENGINE = MergeTree ORDER BY tuple()")
    select = ", ".join(f"assumeNotNull({expr}) AS {name}" for name, _, expr in COLUMNS)
    ch.command(f"INSERT INTO raw.hits_raw SELECT {select} FROM file('hits_*.parquet')")
    ch.command("OPTIMIZE TABLE raw.hits_raw FINAL")
    n = ch.command("SELECT count() FROM raw.hits_raw")
    print(f"raw.hits_raw: {n:,} rows in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
