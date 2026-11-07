-- Hourly pageviews for site 62 during business hours, shown in the customer's timezone.
SELECT
    toHour(toTimeZone(EventTime, 'Europe/Moscow')) AS hour,
    count() AS pageviews
FROM hits
WHERE CounterID = 62
  AND toTimeZone(EventTime, 'Europe/Moscow') BETWEEN toDateTime('2013-07-15 09:00:00', 'Europe/Moscow')
                                                 AND toDateTime('2013-07-15 17:59:59', 'Europe/Moscow')
  AND DontCountHits = 0
  AND IsRefresh = 0
GROUP BY hour
ORDER BY hour
