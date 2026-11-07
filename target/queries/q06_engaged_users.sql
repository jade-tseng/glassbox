-- Engaged users on site 62 today (5+ pageviews).
SELECT count() AS engaged_users
FROM
(
    SELECT UserID
    FROM hits
    WHERE CounterID = 62 AND EventDate = '2013-07-15'
    GROUP BY UserID
    HAVING count() >= 5
)
