-- Hourly hits on site 38 for pages whose URL mentions "google".
SELECT toStartOfHour(EventTime) AS hour, count() AS hits_count
FROM hits
WHERE CounterID = 38
  AND URL LIKE '%google%'
GROUP BY hour
ORDER BY hour
