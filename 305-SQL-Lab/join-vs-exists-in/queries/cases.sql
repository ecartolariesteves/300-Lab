-- ============================================================
-- CASE 1: Filtrar órdenes de clientes VIP
-- Winner: IN (87ms vs 157ms JOIN vs 183ms EXISTS)
-- ============================================================

-- JOIN
SELECT o.order_id, o.customer_id, o.amount
FROM orders o
INNER JOIN vip_customers v ON o.customer_id = v.customer_id;

-- EXISTS
SELECT o.order_id, o.customer_id, o.amount
FROM orders o
WHERE EXISTS (
    SELECT 1 FROM vip_customers v
    WHERE v.customer_id = o.customer_id
);

-- IN ✅ WINNER
SELECT o.order_id, o.customer_id, o.amount
FROM orders o
WHERE o.customer_id IN (SELECT customer_id FROM vip_customers);


-- ============================================================
-- CASE 2: COUNT de órdenes por cliente VIP
-- Winner: IN (5ms — 10x más rápido que EXISTS, JOIN)
-- ============================================================

-- JOIN
SELECT o.customer_id, COUNT(*) AS order_count
FROM orders o
INNER JOIN vip_customers v ON o.customer_id = v.customer_id
GROUP BY o.customer_id;

-- EXISTS
SELECT o.customer_id, COUNT(*) AS order_count
FROM orders o
WHERE EXISTS (
    SELECT 1 FROM vip_customers v
    WHERE v.customer_id = o.customer_id
)
GROUP BY o.customer_id;

-- IN ✅ WINNER
SELECT o.customer_id, COUNT(*) AS order_count
FROM orders o
WHERE o.customer_id IN (SELECT customer_id FROM vip_customers)
GROUP BY o.customer_id;


-- ============================================================
-- CASE 3: Anti-join — clientes SIN órdenes
-- Winner: NOT EXISTS (4ms) ← semánticamente correcto + más rápido
-- ⚠️  NOT IN bug: si hay NULLs en subquery → devuelve 0 filas
-- ============================================================

-- LEFT JOIN + IS NULL
SELECT c.customer_id
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.customer_id IS NULL;

-- NOT EXISTS ✅ WINNER
SELECT c.customer_id
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
);

-- NOT IN ⚠️  (cuidado con NULLs — puede devolver 0 filas incorrectamente)
SELECT c.customer_id
FROM customers c
WHERE c.customer_id NOT IN (
    SELECT DISTINCT customer_id FROM orders
    -- Si customer_id puede ser NULL aquí, NOT IN falla silenciosamente
);


-- ============================================================
-- CASE 4: Filtro multi-condición (segment + region)
-- Winner: JOIN ≈ IN (EXISTS explota a 393ms)
-- ============================================================

-- JOIN ✅ WINNER (tied with IN)
SELECT o.order_id, o.amount
FROM orders o
INNER JOIN customers c ON o.customer_id = c.customer_id
WHERE c.segment = 'Premium'
  AND c.region  = 'North';

-- EXISTS ❌ SLOW (393ms — correlated subquery re-evaluated per row)
SELECT o.order_id, o.amount
FROM orders o
WHERE EXISTS (
    SELECT 1 FROM customers c
    WHERE c.customer_id = o.customer_id
      AND c.segment = 'Premium'
      AND c.region  = 'North'
);

-- IN ✅ WINNER (tied with JOIN)
SELECT o.order_id, o.amount
FROM orders o
WHERE o.customer_id IN (
    SELECT customer_id FROM customers
    WHERE segment = 'Premium'
      AND region  = 'North'
);
