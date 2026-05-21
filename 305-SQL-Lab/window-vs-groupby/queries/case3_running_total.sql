-- ============================================================
-- CASE 3: Running total (acumulado) por cliente  ★ KEY CASE
-- Resultado: Window Function 8x más rápido (1ms vs 8.5ms)
-- Razón: correlated subquery = O(n²), window fn = O(n)
-- ============================================================

-- Correlated subquery ❌ (recalcula para cada fila)
SELECT o1.order_id, o1.customer_id, o1.amount,
       (SELECT SUM(o2.amount)
        FROM orders o2
        WHERE o2.customer_id = o1.customer_id
          AND o2.order_id   <= o1.order_id) AS running_total
FROM orders o1
LIMIT 200;

-- Window Function ✅ WINNER (single pass sobre los datos)
SELECT order_id, customer_id, amount,
       SUM(amount) OVER (
           PARTITION BY customer_id
           ORDER BY order_id
           ROWS UNBOUNDED PRECEDING
       ) AS running_total
FROM orders
LIMIT 200;

-- BigQuery equivalent (same syntax)
-- SELECT order_id, customer_id, amount,
--        SUM(amount) OVER (
--            PARTITION BY customer_id
--            ORDER BY order_id
--            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
--        ) AS running_total
-- FROM `project.dataset.orders`
-- LIMIT 200;
