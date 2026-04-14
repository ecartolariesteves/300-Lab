
# # Author: Edgar Cartolari Esteves

# #  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish

# #  https://www.linkedin.com/in/edgaresteves/

# # English
# # Convert all Excel files in a path XLS to XLSX

# # Spanish
# # Convertir todos los ficheros Excel de una ruta XLS en XLSX

# # Portuguese
# # Converta todos os arquivos Excel em um caminho XLS para XLSX

# Directorio donde están los archivos .xls
# Directory where the .xls files are located
$directorio = "C:\temp\"

# Crear una instancia de Excel
# Create an instance of Excel
$excel = New-Object -ComObject Excel.Application

# Deshabilitar las alertas para evitar confirmaciones
# Disable alerts to avoid confirmations
$excel.DisplayAlerts = $false

# Obtener la lista de archivos .xls
# Get the list of .xls files
$archivos = Get-ChildItem -Path $directorio, -Filter "*.xls"

# Recorrer cada archivo y convertirlo a .xlsx
# Go through each file and convert it to .xlsx
foreach ($archivo in $archivos) {
    # Construir las rutas de entrada y salida
    # Build the entry and exit routes
    $ruta_entrada = $archivo.FullName
    $ruta_salida = [System.IO.Path]::ChangeExtension($ruta_entrada, ".xlsx")

    # Abrir el archivo .xls
    # Open the .xls file
    $workbook = $excel.Workbooks.Open($ruta_entrada)

    # Guardar como .xlsx
    # Save as .xlsx
    $workbook.SaveAs($ruta_salida, [Microsoft.Office.Interop.Excel.XlFileFormat]::xlOpenXMLWorkbook)

    # Cerrar el libro
    # Close the file
    $workbook.Close()

    Write-Output "Convertido: $($archivo.Name) -> $(Split-Path -Leaf $ruta_salida)"
}

# Cerrar Excel
# Close Excel
$excel.Quit()

# Liberar recursos de la instancia de Excel
# Release resources from the Excel instance
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

# Eliminar variables
# Delete variables
Remove-Variable excel

Write-Output "Todos los archivos han sido convertidos."
