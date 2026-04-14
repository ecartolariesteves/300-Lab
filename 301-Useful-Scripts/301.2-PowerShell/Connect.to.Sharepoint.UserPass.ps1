#Config Variables

$SiteURL = "https://XXXXXXXX.sharepoint.com/sites/XXXXXXXXX" #URL de Sharepoint
$DownloadPath ="E:\Datos Carga" # Ubicación del servidor local donde se va a descargar el archivo

$nombre1= "XXXXXXXXX/XXXXXXXXX/DATA.xlsx" # Ruta en Sharepoint y archivo que se desea descargar
$FileRelativeURL1 = "/Documentos compartidos/" + $nombre1  # Ubiación de la carpeta principal de archivos, es la predeterminada
$FileName_Destination1 = "DATA 2024.xlsx" # Nombre que tendrá el archivo cuando se descargue en el servidor local

#Get Credentials to connect


##Connect to PNP Online
Add-PnPStoredCredential -Name https://apsistemas.sharepoint.com -Username XXXXXXXXX -Password (ConvertTo-SecureString -String "XXXXXXXXX" -AsPlainText -Force) # Usuario (correo) y contraseña de acceso. Este correo debe tener acceso a la carpeta de Sharepoint
#Connect-PnPOnline -Url $SiteURL -interactive
Connect-PnPOnline -Url $SiteURL -WarningAction Ignore -ClientID XXXXXXXXXXXXXXXXXXXXXXXXXXX  #Este código de ClientID debe sacarse desde Azure, es el ID de aplicación PnP PowerShell App que se encuentra en el registro de aplciaciones del tennat

#powershell download file from sharepoint online
Get-PnPFile -Url $FileRelativeURL1 -Path $DownloadPath -FileName $FileName_Destination1 -AsFile -Force

#Read more: https://www.sharepointdiary.com/2016/09/sharepoint-online-download-file-from-library-using-powershell.html#ixzz6Js5TRxfU