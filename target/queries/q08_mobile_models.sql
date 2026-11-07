-- Mobile phone models by unique users, all sites.
SELECT MobilePhoneModel, uniqExact(UserID) AS users
FROM hits
WHERE MobilePhoneModel != ''
GROUP BY MobilePhoneModel
ORDER BY users DESC, MobilePhoneModel
LIMIT 10
