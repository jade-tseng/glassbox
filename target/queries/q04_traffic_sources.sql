-- Traffic source breakdown for site 62 today.
SELECT
    TraficSourceID,
    SearchEngineID,
    AdvEngineID,
    CASE WHEN SearchEngineID = 0 AND AdvEngineID = 0 THEN Referer ELSE '' END AS src,
    URL AS dst,
    count() AS pageviews
FROM hits
WHERE CounterID = 62
  AND EventDate = '2013-07-15'
  AND IsRefresh = 0
GROUP BY TraficSourceID, SearchEngineID, AdvEngineID, src, dst
ORDER BY pageviews DESC, TraficSourceID, SearchEngineID, AdvEngineID, src, dst
LIMIT 10
