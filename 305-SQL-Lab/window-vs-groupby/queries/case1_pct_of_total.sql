-- ============================================================
-- CASE 1: % del total por cliente
-- Resultado: TIE (~375ms ambos)
-- ============================================================

-- GROUP BY (correlated scalar subquery)
SELECT customer_id,
       SUM(amount) AS total,
       SUM(amount) * 100.0 / (SELECT SUM(amount) FROM orders) AS pct
FROM orders
GROUP BY customer_id
ORDER BY total DESC
LIMIT 20;

-- Window Function ✅ (más legible, mismo rendimiento)
WITH base AS (
    SELECT customer_id, SUM(amount) AS total
    FROM orders
    GROUP BY customer_id
),
grand AS (
    SELECT SUM(amount) AS grand_total FROM orders
)
SELECT customer_id, total,
       total * 100.0 / grand_total AS pct
FROM base, grand
ORDER BY total DESC
LIMIT 20;
