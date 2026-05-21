-- ============================================================
-- CASE 4: Desviación de cada pedido respecto a la media del cliente
-- Resultado: TIE (~5ms ambos)
-- ============================================================

-- GROUP BY + JOIN
SELECT o.order_id, o.customer_id, o.amount,
       o.amount - avg_t.avg_amount AS diff_from_avg
FROM orders o
JOIN (
    SELECT customer_id, AVG(amount) AS avg_amount
    FROM orders
    GROUP BY customer_id
) avg_t ON o.customer_id = avg_t.customer_id
LIMIT 2000;

-- Window Function ✅ (más conciso, mismo rendimiento)
SELECT order_id, customer_id, amount,
       amount - AVG(amount) OVER (PARTITION BY customer_id) AS diff_from_avg
FROM orders
LIMIT 2000;
