-- Top pages for site 62 today.
SELECT URL, count() AS pageviews
FROM hits
WHERE CounterID = 62
  AND EventDate = '2013-07-15'
  AND DontCountHits = 0
  AND IsRefresh = 0
  AND URL != ''
GROUP BY URL
ORDER BY pageviews DESC, URL
LIMIT 10
