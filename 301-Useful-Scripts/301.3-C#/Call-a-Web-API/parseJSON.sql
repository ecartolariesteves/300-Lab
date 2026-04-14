/*
-- Author: Edgar Cartolari Esteves
--
--  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish
--
--  https://www.linkedin.com/in/edgaresteves/
--
-- English
-- Script to read JSON files into SQL with old versions

-- Spanish
-- Script para leer archivos JSON en SQL con versiones antiguas

-- Portuguese
-- Script para ler os arquivos JSON em SQL com versiones antiguas

*/

DECLARE @JSON nvarchar(4000) =
	(SELECT TOP 1
	JSON
FROM
	[dbo].[tablaJSON]
WHERE
	Metodo = 'Metodo_REE'
ORDER BY
	FechaCarga DESC
)

INSERT INTO TableDestination
           (ColumnA
           ,ColumnB
		   ,ColumnC)

SELECT
	'A' AS ColumnA,
	cast(t1.StringValue as float) ColumnB,
	RIGHT('0' + cast(MONTH(t2.StringValue) as nvarchar(2)),2)  + '/' + cast(YEAR(t2.StringValue) as nvarchar(4)) as ColumnC
FROM
	(SELECT
		*
	FROM
		parseJSON(@JSON)
	WHERE
		Name = 'value'
	) t1
INNER JOIN
	(SELECT
		*
	FROM
		parseJSON(@JSON)
	WHERE
		Name = 'datetime'
	) t2 on t1.Parent_ID = t2.Parent_ID