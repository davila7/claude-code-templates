# Neo4j Import Notes

Use these steps when persisting the ownership graph to Neo4j.

## Quick import (LOAD CSV)

1. Copy `people.csv`, `files.csv`, and `edges.csv` into the Neo4j import directory.
2. Run the following Cypher from Neo4j Browser or `cypher-shell`:

```cypher
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT file_id IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE;

LOAD CSV WITH HEADERS FROM 'file:///people.csv' AS row
MERGE (p:Person {id: row.person_id})
SET p.name = row.name,
    p.email = row.email,
    p.first_seen = row.first_seen,
    p.last_seen = row.last_seen,
    p.commit_count = toInteger(row.commit_count),
    p.touches = toInteger(row.touches),
    p.sensitive_touches = toFloat(row.sensitive_touches),
    p.primary_tz_offset = CASE row.primary_tz_offset WHEN '' THEN null ELSE row.primary_tz_offset END,
    p.primary_tz_minutes = CASE row.primary_tz_minutes WHEN '' THEN null ELSE toInteger(row.primary_tz_minutes) END,
    p.timezone_offsets = CASE row.timezone_offsets WHEN '' THEN null ELSE row.timezone_offsets END;

LOAD CSV WITH HEADERS FROM 'file:///files.csv' AS row
MERGE (f:File {id: row.file_id})
SET f.path = row.path,
    f.first_seen = row.first_seen,
    f.last_seen = row.last_seen,
    f.commit_count = toInteger(row.commit_count),
    f.touches = toInteger(row.touches),
    f.bus_factor = toInteger(row.bus_factor),
    f.sensitivity_score = toFloat(row.sensitivity_score),
    f.sensitivity_tags = row.sensitivity_tags;

LOAD CSV WITH HEADERS FROM 'file:///edges.csv' AS row
MATCH (p:Person {id: row.person_id})
MATCH (f:File {id: row.file_id})
MERGE (p)-[r:TOUCHES]->(f)
SET r.touches = toInteger(row.touches),
    r.recency_weight = toFloat(row.recency_weight),
    r.first_seen = row.first_seen,
    r.last_seen = row.last_seen,
    r.sensitive_weight = toFloat(row.sensitive_weight);

LOAD CSV WITH HEADERS FROM 'file:///cochange_edges.csv' AS row
MATCH (f1:File {id: row.file_a})
MATCH (f2:File {id: row.file_b})
MERGE (f1)-[r:COCHANGES]->(f2)
SET r.cochange_count = toInteger(row.cochange_count),
    r.jaccard = toFloat(row.jaccard);
```

## Visualization tips

- Use Neo4j Bloom or Browser with `MATCH (p:Person)-[r:TOUCHES]->(f:File) RETURN p,r,f`.
- Filter by `f.sensitivity_score > 0` to highlight security-relevant clusters.
- For Gephi, import `edges.csv` as edges and `files.csv` / `people.csv` as nodes.
