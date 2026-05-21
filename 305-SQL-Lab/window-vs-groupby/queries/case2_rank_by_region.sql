-- ============================================================
-- CASE 2: RANK de clientes por gasto dentro de cada región
-- Resultado: Window Function gana (798ms vs 840ms)
-- ============================================================

-- GROUP BY + RANK window (híbrido habitual)
SELECT c.region, o.customer_id,
       SUM(o.amount) AS total,
       RANK() OVER (PARTITION BY c.region ORDER BY SUM(o.amount) DESC) AS rnk
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
GROUP BY c.region, o.customer_id;

-- CTE + Window Function ✅ más limpio
WITH totals AS (
    SELECT c.region, o.customer_id, SUM(o.amount) AS total
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    GROUP BY c.region, o.customer_id
)
SELECT region, customer_id, total,
       RANK() OVER (PARTITION BY region ORDER BY total DESC) AS rnk
FROM totals;
