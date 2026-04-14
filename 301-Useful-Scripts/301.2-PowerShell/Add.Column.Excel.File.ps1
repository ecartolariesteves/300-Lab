
# # Author: Edgar Cartolari Esteves

# #  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish

# #  https://www.linkedin.com/in/edgaresteves/

# # English
# # Add a column in an Excel file and fill it with auto number.

# # Spanish
# # Adicionar una columna en un fichero Excel y rellenar con auto numerico.

# # Portuguese
# # Adicione uma coluna a um arquivo Excel e preencha-a com números automáticos.



# Ruta del directorio que contiene los archivos de Excel
# Path of the directory containing the Excel files
$excelDirectoryPath = 'C:\temp\'


# Crear el objeto COM de Excel
# Create the Excel COM object
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false # True - si quieres ver el Excel en pantalla. -- True - if you want to see the Excel on screen.
$excel.DisplayAlerts = $false # True - si quieres mensajes del Excel en pantalla. -- True - if you want Excel messages on screen.

# Obtener todos los archivos .xlsx en el directorio
# Get all .xlsx files in the directory
$excelFiles = Get-ChildItem -Path $excelDirectoryPath -Filter "*.xls"

# Procesar cada archivo
# Process each file
foreach ($excelFile in $excelFiles) {
    $excelFilePath = $excelFile.FullName

    # Abrir el archivo de Excel
    # Open Excel file
    $workbook = $excel.Workbooks.Open($excelFilePath)

    # Iterar a través de las hojas y realizar las operaciones necesarias
    # Iterate through the sheets and perform the necessary operations
    foreach ($sheet in $workbook.Sheets) {

        Write-Host "Procesando hoja: $($sheet.Name)"

        # Insertar una nueva columna "Number" en la posición M (13 en base 1)
        # Insert a new column "Number" at position M (13 in base 1)
        $range = $sheet.Range("M1")
        $range.EntireColumn.Insert()

        # Establecer el encabezado de la nueva columna
        # Set the new column header
        $sheet.Cells.Item(1, 13).Value2 = "Number"

        # Encontrar la última fila con datos en la columna A (o cualquier columna segura)
        # Find the last row with data in column A (or any safe column)
        $lastRow = $sheet.Cells($sheet.Rows.Count, 1).End(-4162).Row  # -4162 es xlUp

        # Rellenar la columna "Number" con el valor extraído del nombre del archivo
        # Fill the "Number" column with the value extracted from the file name
        for ($row = 2; $row -le $lastRow; $row++) {
            $sheet.Cells.Item($row, 16).Value2 = $row
        }

    }

    # Guardar y cerrar el libro de trabajo
    # Save and close the workbook
    $workbook.Save()
    $workbook.Close()
}

# Cerrar la aplicación de Excel
# Close the Excel application
$excel.Quit()

# Liberar los objetos COM
# Release COM objects
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($sheet) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

# Eliminar variables
# Delete variables
Remove-Variable sheet
Remove-Variable workbook
Remove-Variable excel
Remove-Variable excelFiles