# Execution Plans — Subquery vs CTE

## BigQuery EXPLAIN (referencia)

En BigQuery, puedes ver el plan de ejecución con:
```sql
-- En BigQuery UI: activar "Query plan explanation" en los detalles del job
-- O via API: jobs.get -> statistics.queryPlan
```

### Observación clave

Para los casos 1-3, BigQuery genera **el mismo plan de ejecución** para subquery y CTE.
El optimizador los trata de forma equivalente.

Para el caso 4 (reutilización), el CTE puede reducir el número de scans dependiendo
de si el optimizador decide materializar el resultado intermedio.

## PostgreSQL EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
WITH customer_spending AS (
    SELECT customer_id, SUM(amount) AS total_spent
    FROM orders GROUP BY customer_id
)
SELECT customer_id, total_spent
FROM customer_spending
ORDER BY total_spent DESC
LIMIT 10;
```

En PostgreSQL 12+, los CTEs son "optimization fences" por defecto cuando se usan
con MATERIALIZED. Desde PostgreSQL 12 puedes controlar esto:
- `WITH cte AS MATERIALIZED (...)` → fuerza materialización
- `WITH cte AS NOT MATERIALIZED (...)` → permite al planner inlinear
