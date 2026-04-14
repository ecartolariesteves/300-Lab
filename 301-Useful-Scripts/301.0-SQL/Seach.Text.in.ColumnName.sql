/*
-- Author: Edgar Cartolari Esteves
--
--  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish
--
--  https://www.linkedin.com/in/edgaresteves/
--
-- English
-- Find columns by name within all tables in a database.

-- Spanish
-- Busque columnas por nombre dentro de todas las tablas de una base de datos.

-- Portuguese
-- Localizar colunas por nome dentro de todas las tablas de um banco de dados.

*/

SELECT
	*
FROM
	INFORMATION_SCHEMA.COLUMNS
WHERE
	COLUMN_NAME like '%word%'
ORDER BY
	TABLE_NAME