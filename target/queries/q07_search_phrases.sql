-- Most popular search phrases across all sites, by unique users.
SELECT SearchPhrase, uniqExact(UserID) AS users
FROM hits
WHERE SearchPhrase != ''
GROUP BY SearchPhrase
ORDER BY users DESC, SearchPhrase
LIMIT 10
