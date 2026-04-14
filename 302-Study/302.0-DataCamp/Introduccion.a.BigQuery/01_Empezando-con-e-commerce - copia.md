## Empezando con e-commerce

¿Listo para ensuciarte las manos con BigQuery? ¡Esta es tu oportunidad! Acabas de empezar un nuevo proyecto de e-commerce en BigQuery y todavía sabes poco sobre los datos. ¡Vamos a echarles un mejor vistazo!

<br>

### T-SQL 

```
# Selecciona todas las columnas y limita el resultado a 3 filas.
-- Select all columns
SELECT *
FROM ecommerce.ecomm_order_details
-- Limit the output to 3 rows
LIMIT 3;
```

### Atributos únicos de BigQuery

Entender los principales atributos de BigQuery que lo hacen único te ayudará a determinar cuándo es más apropiado usarlo.

Identifica, entre las opciones disponibles, las características que hacen que BigQuery sea único.

<br>

[ ] Admite consultas concurrentes para business intelligence
[X] Separación entre cómputo y almacenamiento
[X] Ejecuta informes analíticos programados o periódicos
[ ] Diseñado para gestionar consultas transaccionales

### Organización de datos en BigQuery - Estructura de la tabla

Las tablas en BigQuery siguen una jerarquía que permite aplicarles permisos y derechos de acceso en tres niveles distintos. Esto afecta no solo a los derechos de acceso asignados dentro de Google Cloud, sino también a la ubicación física de tus datos y a los recursos a los que tendrás acceso.

<br>

```
SELECT
    *
FROM
    Project.DataSet.Table

```

### Tablas en estado salvaje

Trabajas en una empresa de comercio electrónico en un momento clave de transición. Tu empresa está migrando su infraestructura de datos de Postgres a BigQuery para ganar en escalabilidad y eficiencia. Tu responsable te ha asignado una tarea crucial: identificar las ciudades de vendedores únicas dentro del conjunto de datos.

<br>

```
-- Modifica el código para seleccionar los valores distintos de seller_city de la tabla ecomm_sellers en el conjunto de datos ecommerce.
SELECT DISTINCT seller_city
-- Specify the dataset and table
FROM ecommerce.ecomm_sellers;

```