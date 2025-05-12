```sql
CREATE TABLE reader_response (
    reader_id UUID,
    word VARCHAR(127),
    response INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reader_id, word, timestamp)
);
```

```sql
SELECT
    reader_id,
    word,
    response
FROM (
    SELECT
        reader_id,
        word,
        response,
        timestamp,
        ROW_NUMBER() OVER (PARTITION BY word ORDER BY timestamp DESC) as rn
    FROM
        reader_response
    WHERE
        reader_id = $1
) AS ranked_results
WHERE
    -- Filter for the top 5 most recent rows
    rn <= 10
ORDER BY
    word,
    rn;
```
