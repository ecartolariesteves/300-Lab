## Explorar los datos del curso con SQL

Ahora que has repasado los fundamentos de SQL, vas a realizar una exploración básica del conjunto de datos, que contiene información sobre los artículos dentro de cada pedido en nuestros datos de comercio electrónico.

<br>

### Instrucciones 1/2

```
# Escribe una consulta que devuelva las primeras diez filas del conjunto de datos.
SELECT 
	*
FROM
	ecommerce.ecomm_order_details
-- Add the syntax to limit the data
LIMIT 10;
```

### Instrucciones 2/2

Modifica la consulta para seleccionar las columnas order_id, customer_id, order_status y order_purchase_timestamp del conjunto de datos order_details para las primeras 10 filas.
```
-- Add in the correct columns to the query

SELECT 
	-- Fill in the columns we want to return from our query
	order_id, customer_id, order_status, order_purchase_timestamp
FROM
	ecommerce.ecomm_order_details
LIMIT 10;
```

### Encontrar el valor total del pedido

Un caso de uso común de BigQuery es crear informes analíticos, como obtener los 10 mejores resultados de una consulta o resultados dentro de un periodo concreto.

En esta consulta, vas a encontrar los 10 pedidos más pequeños por coste total usando ecommerce.ecomm_payments.

<br>

```
-- Selecciona los diez pedidos más pequeños de ecommerce.ecomm_payments usando SUM sobre la columna payment_value para las primeras 10 filas de datos.

-- Add the correct column and limit values

SELECT
	-- Add the column to calculate the SUM
	order_id, SUM(payment_value)
FROM 
    ecommerce.ecomm_payments
GROUP BY order_id
-- Add the correct column to order
ORDER BY order_id
-- Add the correct number of rows to limit
LIMIT 10;

```

### Uso de joins

En muchos almacenes de datos, incluido BigQuery, los datos se almacenan en varias tablas enlazadas por claves comunes entre tablas. Este es el caso de los datos del curso, que simulan un almacén de datos real.

En este ejercicio, combinarás dos tablas para obtener un único resultado.

<br>

```
-- Haz un join de ecomm_orders con ecomm_order_details usando la columna común order_id.
-- Ordena el conjunto de datos por order_purchase_timestamp para mostrar los pedidos más recientes.

SELECT
	ecomm_orders.order_id,
    ecomm_orders.order_items,
  	ecomm_order_details.order_status,
    ecomm_order_details.order_purchase_timestamp
FROM
	ecommerce.ecomm_orders
-- Join on the common order_id column
JOIN 
	ecommerce.ecomm_order_details 
USING (order_id)
-- Order to show recent orders
ORDER BY order_purchase_timestamp
LIMIT 10;

```



