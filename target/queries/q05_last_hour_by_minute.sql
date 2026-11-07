-- Per-minute traffic for site 62 in the last hour (local time).
SELECT
    toStartOfMinute(toTimeZone(EventTime, 'Europe/Moscow')) AS minute,
    count() AS pageviews,
    uniqExact(UserID) AS users
FROM hits
WHERE CounterID = 62
  AND toTimeZone(EventTime, 'Europe/Moscow') >= toDateTime('2013-07-15 23:00:00', 'Europe/Moscow')
GROUP BY minute
ORDER BY minute
