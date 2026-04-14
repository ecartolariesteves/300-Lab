/*
-- Author: Edgar Cartolari Esteves
--
--  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish
--
--  https://www.linkedin.com/in/edgaresteves/
--
-- English
-- Find a word within functions or procedures.

-- Spanish
-- Encuentra una palabra dentro de funciones o procedimientos.

-- Portuguese
-- Localizar uma palavra dentro de funciones o procedures.

*/


SELECT DISTINCT
	t2.name AS Object_Name,
	t2.type_desc
FROM
	sys.sql_modules t1
INNER JOIN
	sys.objects t2
	ON t2.object_id = t1.object_id
WHERE
	t1.definition Like '%word%'