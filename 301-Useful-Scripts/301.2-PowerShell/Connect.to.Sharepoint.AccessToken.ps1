# ──────────────────────────────────────────────
# 1. CONFIGURACIÓN
# ──────────────────────────────────────────────
$TenantId     = ""   # GUID del Tenant
$ClientId     = ""   # Client ID App Registration
$ClientSecret = ""   # Client Secret

$SiteUrl      = "https://XXXXXX.sharepoint.com"
$SitePath     = "/sites/XXXXXX"
$LibraryPath  = "Documentos compartidos/XXXXXX"

$DownloadFolder = "E:\DescargaArchivos"
$ExtensionFilter = @(".xlsx", ".xls", ".csv", ".txt")


# ──────────────────────────────────────────────
# 2. AUTENTICACIÓN (MODERNA → FALLBACK LEGACY)
# ──────────────────────────────────────────────

$AccessToken = $null
$Resource = $SiteUrl

Write-Host "🔐 Intentando autenticación moderna (Azure AD v2.0)..." -ForegroundColor Cyan

# Intento moderno
try {

    $TokenUrlModern = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"

    $BodyModern = @{
        client_id     = $ClientId
        scope         = "$Resource/.default"
        client_secret = $ClientSecret
        grant_type    = "client_credentials"
    }

    $TokenResponse = Invoke-RestMethod -Method Post `
                                       -Uri $TokenUrlModern `
                                       -Body $BodyModern `
                                       -ContentType "application/x-www-form-urlencoded"

    $AccessToken = $TokenResponse.access_token

    if ($AccessToken) {
        Write-Host "✅ Autenticación moderna correcta" -ForegroundColor Green
    }
}
catch {
    Write-Warning "⚠️ Autenticación moderna falló. Intentando método legacy..."
}

# Intento legacy si moderno falla
if (-not $AccessToken) {

    try {

        $TokenUrlLegacy = "https://accounts.accesscontrol.windows.net/$TenantId/tokens/OAuth/2"

        $BodyLegacy = @{
            grant_type    = "client_credentials"
            client_id     = "$ClientId@$TenantId"
            client_secret = $ClientSecret
            resource      = "00000003-0000-0ff1-ce00-000000000000/$($SiteUrl.Replace('https://',''))@$TenantId"
        }

        $TokenResponse = Invoke-RestMethod -Method Post `
                                           -Uri $TokenUrlLegacy `
                                           -Body $BodyLegacy

        $AccessToken = $TokenResponse.access_token

        if ($AccessToken) {
            Write-Host "✅ Autenticación legacy correcta" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Error "❌ Ambos métodos de autenticación fallaron."
        exit 1
    }
}

# Crear headers
$Headers = @{
    "Authorization" = "Bearer $AccessToken"
    "Accept"        = "application/json;odata=verbose"
}

# ──────────────────────────────────────────────
# 3. CREAR CARPETA LOCAL
# ──────────────────────────────────────────────

if (-not (Test-Path $DownloadFolder)) {
    New-Item -ItemType Directory -Path $DownloadFolder | Out-Null
    Write-Host "📁 Carpeta creada: $DownloadFolder" -ForegroundColor Gray
}

# ──────────────────────────────────────────────
# 4. LISTAR ARCHIVOS
# ──────────────────────────────────────────────

Write-Host "`n🔍 Buscando ficheros en: $LibraryPath" -ForegroundColor Cyan

# Ruta server-relative REAL
$FolderRelativeUrl = "$SitePath/$LibraryPath"

$FilesUrl = "$SiteUrl$SitePath/_api/web/GetFolderByServerRelativeUrl('$FolderRelativeUrl')/Files"

try {
    $Response = Invoke-RestMethod -Method Get -Uri $FilesUrl -Headers $Headers
    $Files = $Response.d.results
}
catch {
    Write-Error "❌ Error accediendo a la carpeta: $($_.Exception.Message)"
    exit 1
}

# ──────────────────────────────────────────────
# 5. RESUMEN
# ──────────────────────────────────────────────

Write-Host "`n──────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "✅ Descargados : $Downloaded fichero(s)" -ForegroundColor Green
Write-Host "⏭️  Omitidos   : $Skipped fichero(s)" -ForegroundColor Gray
Write-Host "📂 Destino     : $DownloadFolder" -ForegroundColor Cyan
Write-Host "──────────────────────────────────────`n" -ForegroundColor DarkGray