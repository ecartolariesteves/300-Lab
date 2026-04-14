$tenantId = ""

$body = @{
    client_id     = ""
    client_secret = ""
    scope         = "https://api.businesscentral.dynamics.com/.default" # API BC
    grant_type    = "client_credentials"
}

$response = Invoke-RestMethod `
    -Method Post `
    -Uri "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token" `
    -Body $body `
    -ContentType "application/x-www-form-urlencoded"

$token = $response.access_token

$token


