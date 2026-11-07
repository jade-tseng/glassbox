-- Glassbox target: the `hits` table behind the analytics dashboard.
-- Editable by the agent. bench.py drops the `bench` database, runs this file in it,
-- then fills `hits` from raw.hits_raw (same column names). Multiple statements are allowed.

CREATE TABLE hits
(
    WatchID          Int64,
    EventTime        DateTime,
    EventDate        Date,
    CounterID        UInt32,
    UserID           Int64,
    ClientIP         Int32,
    RegionID         UInt32,
    OS               UInt8,
    UserAgent        UInt8,
    IsMobile         UInt8,
    MobilePhoneModel String,
    ResolutionWidth  UInt16,
    URL              String,
    Referer          String,
    Title            String,
    IsRefresh        UInt8,
    IsLink           UInt8,
    IsDownload       UInt8,
    DontCountHits    UInt8,
    TraficSourceID   Int8,
    SearchEngineID   UInt16,
    SearchPhrase     String,
    AdvEngineID      UInt8,
    BrowserLanguage  String,
    BrowserCountry   String,
    URLHash          Int64,
    RefererHash      Int64
)
ENGINE = MergeTree
ORDER BY WatchID;
