CREATE FUNCTION dbo.ValidarCIFNIF (@Identificador NVARCHAR(15))
RETURNS BIT
AS
BEGIN
    DECLARE @EsValido BIT = 0
    DECLARE @Longitud INT
    DECLARE @PrimerCaracter NVARCHAR(1)
    DECLARE @Digitos NVARCHAR(10)
    DECLARE @Control NVARCHAR(1)
    DECLARE @SumaPar INT = 0
    DECLARE @SumaImpar INT = 0
    DECLARE @DigitoControl INT

    -- Eliminar espacios y normalizar longitud
    SET @Identificador = UPPER(LTRIM(RTRIM(@Identificador)))
    SET @Longitud = LEN(@Identificador)

    -- Comprobar longitud válida (8 o 9 caracteres)
    IF @Longitud NOT BETWEEN 8 AND 9 RETURN 0

    -- Separar partes
    SET @PrimerCaracter = LEFT(@Identificador, 1)
    SET @Digitos = SUBSTRING(@Identificador, 2, @Longitud - 2)
    SET @Control = RIGHT(@Identificador, 1)

    -- Validación de NIF (personas físicas)
    IF @PrimerCaracter BETWEEN '0' AND '9' -- Primer carácter numérico
    BEGIN
        -- Comprobar que solo hay números más una letra de control
        IF @Identificador LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][A-Z]'
        BEGIN
            -- Cálculo de la letra correcta
            DECLARE @LetrasControl NVARCHAR(23) = 'TRWAGMYFPDXBNJZSQVHLCKE'
            DECLARE @Posicion INT = CAST(@Digitos AS INT) % 23
            IF SUBSTRING(@LetrasControl, @Posicion + 1, 1) = @Control
                SET @EsValido = 1
        END
    END

    -- Validación de CIF (empresas u organizaciones)
    ELSE IF @PrimerCaracter LIKE '[A-HJ-NP-SUVW]'
    BEGIN
        -- Comprobar que tiene formato válido
        IF @Identificador LIKE '[A-HJ-NP-SUVW][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9A-Z]'
        BEGIN
            -- Cálculo del dígito de control
            DECLARE @i INT = 1
            WHILE @i <= 7
            BEGIN
                DECLARE @Digito INT = CAST(SUBSTRING(@Digitos, @i, 1) AS INT)
                IF @i % 2 = 0
                    SET @SumaPar = @SumaPar + @Digito
                ELSE
                    SET @SumaImpar = @SumaImpar + SUM(((@Digito * 2) / 10) + ((@Digito * 2) % 10))
                SET @i = @i + 1
            END
            SET @DigitoControl = (10 - ((@SumaPar + @SumaImpar) % 10)) % 10

            -- Verificar el dígito o la letra de control
            IF @Control = CAST(@DigitoControl AS NVARCHAR(1)) OR
               @Control = CHAR(ASCII('A') + @DigitoControl - 1)
                SET @EsValido = 1
        END
    END

    RETURN @EsValido
END
GO
