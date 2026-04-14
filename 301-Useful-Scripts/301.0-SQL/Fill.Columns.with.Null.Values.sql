/*
-- Author: Edgar Cartolari Esteves
--
--  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish
--
--  https://www.linkedin.com/in/edgaresteves/
--
-- English
-- Fill null columns with data (Fill null rows with information from the top row)

-- Spanish
-- Complete columnas nulas con datos (rellene filas nulas con información de la fila superior)

-- Portuguese
-- Preencher con datos columnas null (Preencher filas nulas com informacao de linha superior)

*/

CREATE TABLE #Temp(
	Month int NULL,
	Year int NULL,
	ColumnA [nvarchar](50) NULL,
	ColumnB [nvarchar](50) NULL
)

-- Fill the #temp table to have test data, where the year will be null for all months except January.

	DECLARE @StartYear INT = 2022;
	DECLARE @EndYear INT = 2024;

	-- Temporary table to store months
	DECLARE @Months TABLE (Month INT);

	-- Insert the 12 months into the time table
	INSERT INTO @Months (Month)
	VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12);

	-- Automatically insert years and months
	INSERT INTO #Temp (Month, Year, ColumnA, ColumnB)
	SELECT
		m.Month,
		CASE WHEN m.Month = 1 THEN y.Year ELSE NULL END AS Year,
		'ValorA' AS ColumnA,
		'ValorB' AS ColumnB
	FROM
		(SELECT DISTINCT Year FROM (SELECT @StartYear AS Year UNION ALL SELECT @StartYear + 1 UNION ALL SELECT @StartYear + 2) AS Years) y
	CROSS JOIN @Months m
	ORDER BY y.Year, m.Month;


WITH TableAux AS
	(
	SELECT
		Month,
		Year,
		ColumnA,
		ColumnB,
		ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS RowNum
	 FROM
		#Temp
	)

SELECT
	t1.Month,
	COALESCE(t1.Year, t2.Year) as Year,
	t1.ColumnA,
	t1.ColumnB,
	ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS RowNum
FROM
	TableAux t1
OUTER APPLY
	(SELECT TOP 1
		Year
    FROM
		TableAux n2
    WHERE
		n2.RowNum < t1.RowNum
	AND n2.Year IS NOT NULL
    ORDER BY
		n2.RowNum DESC
) t2



DROP TABLE #temp