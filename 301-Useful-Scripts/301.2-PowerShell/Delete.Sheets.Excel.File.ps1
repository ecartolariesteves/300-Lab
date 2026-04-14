
# # Author: Edgar Cartolari Esteves

# #  If you're using my code you're welcome to connect with me on LinkedIn and optionally send me feedback to help steer this or other code I publish

# #  https://www.linkedin.com/in/edgaresteves/

# # English
# # Delete a sheet from an Excel file.

# # Spanish
# # Deletar una hoja de un fichero Excel.

# # Portuguese
# # Exclua uma aba de um arquivo Excel.



# Ruta del directorio donde se encuentran los archivos de Excel
# Directory path where the Excel files are located
$folderPath = "C:\temp\"

# Nombres de las hojas a conservar
# Names of the leaves to be kept
$sheetNamesToKeep = @("CCT-2.6")

# Crear el objeto COM de Excel
# Create the Excel COM object
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false # True - si quieres ver el Excel en pantalla. -- True - if you want to see the Excel on screen.
$excel.DisplayAlerts = $false # True - si quieres mensajes del Excel en pantalla. -- True - if you want Excel messages on screen.

# Obtener todos los archivos .xlsx en la carpeta especificada
# Get all .xlsx files in the directory
$files = Get-ChildItem -Path $folderPath -Filter *.xls

# Iterar a través de cada archivo de Excel en la carpeta
# Iterate through each Excel file in the folder
foreach ($file in $files) {
    Write-Host "Procesando archivo: $($file.FullName)"

    # Abrir el archivo de Excel
    # Open the Excel file
    $workbook = $excel.Workbooks.Open($file.FullName)

    # Obtener una lista de todas las hojas en el archivo
    # Get a list of all sheets in the file
    $sheetsToDelete = @()

    foreach ($sheet in $workbook.Sheets) {
        # Si el nombre de la hoja no está en la lista de hojas a conservar, añadirla a la lista de eliminación
        # If the sheet name is not in the list of sheets to keep, add it to the delete list
        if ($sheetNamesToKeep -notcontains $sheet.Name) {
            $sheetsToDelete += $sheet
        }
    }

    # Eliminar las hojas que no están en la lista de hojas a conservar
    # Delete sheets that are not in the list of sheets to keep
    foreach ($sheet in $sheetsToDelete) {
        Write-Host "Eliminando hoja: $($sheet.Name)"
        $sheet.Delete()
    }

    # Guardar y cerrar el archivo de Excel
    # Save and close the Excel file
    $workbook.Save()
    $workbook.Close()
}

# Cerrar la aplicación de Excel
# Close the Excel application
$excel.Quit()

# Liberar los objetos COM
# Release COM objects
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
[System.Runtime.Interopervices.Marshal]::ReleaseComObject($excel) | Out-Null

# Eliminar variables
# Delete variables
Remove-Variable workbook
Remove-Variable excel

Write-Host "Proceso completado."
