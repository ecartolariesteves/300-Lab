/*
-- Author: Edgar Cartolari Esteves
--
--  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish
--
--  https://www.linkedin.com/in/edgaresteves/
--
-- English
-- Compare row counts in tables from two different databases with the same schema

-- Spanish
-- Comparar recuentos de filas en tablas de dos bases de datos diferentes con el mismo esquema

-- Portuguese
-- Comparar quantidade de linhas em tabelas de dois bancos de dados diferentes com o mesmo esquema

*/


use AdventureWorks2019 -- Old Database
CREATE TABLE #counts
(
table_name varchar(255),
row_count int
)
EXEC sp_MSForEachTable @command1='INSERT #counts (table_name, row_count) SELECT ''?'', COUNT(*) FROM #counts'

use AdventureWorks2019 -- New Database
CREATE TABLE #counts_2
(
table_name varchar(255),
row_count int
)
EXEC sp_MSForEachTable @command1='INSERT #counts_2 (table_name, row_count) SELECT ''?'', COUNT(*) FROM #counts_2'

SELECT
	t1.table_name,
	t1.row_count as [Counts from regular run],
	t2.row_count as [Counts from mod scripts],
	t1.row_count - t2.row_count as [difference]
-- select *
FROM
	#counts t1
INNER JOIN
	#counts_2 t2
	ON t1.table_name = t2.table_name
where
	t1.row_count <> t2.row_count
ORDER BY
	t1.table_name,
	t1.row_count DESC

-- DROP TABLE #counts
-- DROP TABLE #counts_2