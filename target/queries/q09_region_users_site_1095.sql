-- Regions by unique users for site 1095.
SELECT RegionID, uniqExact(UserID) AS users, count() AS pageviews
FROM hits
WHERE CounterID = 1095
GROUP BY RegionID
ORDER BY users DESC, RegionID
LIMIT 10
