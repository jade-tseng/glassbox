-- Top referring domains for site 62 this afternoon (domain parsed at query time).
SELECT domain(Referer) AS referrer, count() AS visits
FROM hits
WHERE CounterID = 62
  AND formatDateTime(EventTime, '%Y-%m-%d %H', 'Europe/Moscow') BETWEEN '2013-07-15 12' AND '2013-07-15 17'
  AND Referer != ''
  AND IsRefresh = 0
GROUP BY referrer
ORDER BY visits DESC, referrer
LIMIT 10
