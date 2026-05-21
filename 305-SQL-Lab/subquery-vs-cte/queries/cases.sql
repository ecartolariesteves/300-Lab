-- ============================================================
-- CASE 1: Aggregación simple — Top clientes por gasto total
-- ============================================================

-- Versión SUBQUERY
SELECT customer_id, total_spent
FROM (
    SELECT customer_id, SUM(amount) AS total_spent
    FROM orders
    GROUP BY customer_id
) ranked
ORDER BY total_spent DESC
LIMIT 10;

-- Versión CTE
WITH customer_spending AS (
    SELECT customer_id, SUM(amount) AS total_spent
    FROM orders
    GROUP BY customer_id
)
SELECT customer_id, total_spent
FROM customer_spending
ORDER BY total_spent DESC
LIMIT 10;


-- ============================================================
-- CASE 2: Filtrado por resultado calculado — clientes sobre la media
-- ============================================================

-- Versión SUBQUERY
SELECT customer_id, SUM(amount) AS total_spent
FROM orders
GROUP BY customer_id
HAVING SUM(amount) > (
    SELECT AVG(total) FROM (
        SELECT customer_id, SUM(amount) AS total
        FROM orders
        GROUP BY customer_id
    )
);

-- Versión CTE
WITH customer_totals AS (
    SELECT customer_id, SUM(amount) AS total_spent
    FROM orders
    GROUP BY customer_id
),
avg_spending AS (
    SELECT AVG(total_spent) AS avg_total
    FROM customer_totals
)
SELECT customer_id, total_spent
FROM customer_totals, avg_spending
WHERE total_spent > avg_total;


-- ============================================================
-- CASE 3: Multi-nivel — Ranking por región y segmento
-- ============================================================

-- Versión SUBQUERY (3 niveles anidados — difícil de leer)
SELECT region, segment, customer_id, total_spent, rnk
FROM (
    SELECT region, segment, customer_id, total_spent,
           RANK() OVER (PARTITION BY region, segment ORDER BY total_spent DESC) AS rnk
    FROM (
        SELECT c.region, c.segment, o.customer_id, SUM(o.amount) AS total_spent
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        GROUP BY c.region, c.segment, o.customer_id
    ) aggregated
) ranked
WHERE rnk <= 3;

-- Versión CTE (misma lógica, mucho más clara)
WITH order_totals AS (
    SELECT c.region, c.segment, o.customer_id, SUM(o.amount) AS total_spent
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    GROUP BY c.region, c.segment, o.customer_id
),
ranked AS (
    SELECT *,
           RANK() OVER (PARTITION BY region, segment ORDER BY total_spent DESC) AS rnk
    FROM order_totals
)
SELECT region, segment, customer_id, total_spent, rnk
FROM ranked
WHERE rnk <= 3;


-- ============================================================
-- CASE 4: Reutilización — misma lógica usada dos veces
-- ⚠️  Aquí el CTE puede ganar si el motor lo materializa
-- ============================================================

-- Versión SUBQUERY — calcula customer_spending DOS veces
SELECT
    a.customer_id,
    a.total_spent,
    a.total_spent / b.grand_total AS pct_of_total
FROM (
    SELECT customer_id, SUM(amount) AS total_spent
    FROM orders
    GROUP BY customer_id
) a
CROSS JOIN (
    SELECT SUM(amount) AS grand_total
    FROM (
        SELECT customer_id, SUM(amount) AS total_spent
        FROM orders
        GROUP BY customer_id
    )
) b
ORDER BY total_spent DESC;

-- Versión CTE — customer_spending calculado UNA SOLA VEZ
WITH customer_spending AS (
    SELECT customer_id, SUM(amount) AS total_spent
    FROM orders
    GROUP BY customer_id
),
totals AS (
    SELECT SUM(total_spent) AS grand_total
    FROM customer_spending  -- reutiliza el CTE anterior
)
SELECT
    cs.customer_id,
    cs.total_spent,
    cs.total_spent / t.grand_total AS pct_of_total
FROM customer_spending cs, totals t
ORDER BY total_spent DESC;
