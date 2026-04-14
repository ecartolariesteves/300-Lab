/*
-- Author: Edgar Cartolari Esteves
--
--  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish
--
--  https://www.linkedin.com/in/edgaresteves/
--
-- English
-- Find a word within all columns of a database.

-- Spanish
-- Encuentre una palabra dentro de todas las columnas de una base de datos.

-- Portuguese
-- Localizar uma palavra dentro de todas las columnas de um banco de dados.

*/

DECLARE @SearchStr nvarchar(100)

SET @SearchStr = 'James' -- Word within the content of the tables


/*Table type variable*/

DECLARE @TablaBusquedaValores TABLE
(
ColumnName nvarchar(370),
ColumnValue nvarchar(3630)
)

SET NOCOUNT ON

DECLARE
	@TableName nvarchar(256),
	@ColumnName nvarchar(128),
	@SearchStr2 nvarchar(110)

SET  @TableName = ''
SET @SearchStr2 = QUOTENAME('%' + @SearchStr + '%','''')

WHILE @TableName IS NOT NULL

BEGIN
    SET @ColumnName = ''
    SET @TableName =
    (
        SELECT
			MIN(QUOTENAME(TABLE_SCHEMA) + '.' + QUOTENAME(TABLE_NAME))
        FROM
			INFORMATION_SCHEMA.TABLES
        WHERE
			TABLE_TYPE = 'BASE TABLE'
		AND QUOTENAME(TABLE_SCHEMA) + '.' + QUOTENAME(TABLE_NAME) > @TableName
		AND OBJECTPROPERTY(
              OBJECT_ID(
               QUOTENAME(TABLE_SCHEMA) + '.' + QUOTENAME(TABLE_NAME)), 'IsMSShipped') = 0
    )
    WHILE (@TableName IS NOT NULL) AND (@ColumnName IS NOT NULL)
    BEGIN
        SET @ColumnName =
        (
            SELECT
				MIN(QUOTENAME(COLUMN_NAME))
            FROM
				INFORMATION_SCHEMA.COLUMNS
            WHERE
				TABLE_SCHEMA = PARSENAME(@TableName, 2)
			AND TABLE_NAME = PARSENAME(@TableName, 1)
			AND DATA_TYPE IN ('char', 'varchar', 'nchar', 'nvarchar', 'int', 'decimal','uniqueidentifier')
			AND QUOTENAME(COLUMN_NAME) > @ColumnName
        )
        IF @ColumnName IS NOT NULL
        BEGIN
            INSERT INTO @TablaBusquedaValores

            EXEC
            (
                'SELECT ''' + @TableName + '.' + @ColumnName + ''', LEFT(' + @ColumnName + ', 3630) FROM ' + @TableName + ' (NOLOCK) ' +
                ' WHERE ' + @ColumnName + ' LIKE ' + @SearchStr2
            )
        END
    END
END


SELECT
	*
FROM
	@TablaBusquedaValores

