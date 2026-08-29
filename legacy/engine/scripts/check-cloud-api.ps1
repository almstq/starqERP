$ErrorActionPreference = 'Stop'

$baseUrl = 'https://wthabguvueewgtabjsdo.supabase.co/functions/v1/starq-api'

$health = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/health" -TimeoutSec 20
if ($health.StatusCode -ne 200) {
    throw "Cloud health returned HTTP $($health.StatusCode)."
}
$healthJson = $health.Content | ConvertFrom-Json
if ($healthJson.ok -ne $true -or $healthJson.database -ne 'ready') {
    throw 'Cloud health did not prove database readiness.'
}
if ($health.Headers['Cache-Control'] -notmatch 'no-store') {
    throw 'Cloud API is missing Cache-Control: no-store.'
}
if ($health.Headers['X-Content-Type-Options'] -notmatch 'nosniff') {
    throw 'Cloud API is missing X-Content-Type-Options: nosniff.'
}

$allowed = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/health" -Headers @{ Origin = 'http://localhost:8080' } -TimeoutSec 20
if ($allowed.Headers['Access-Control-Allow-Origin'] -notcontains 'http://localhost:8080') {
    throw 'Approved local web origin did not receive its exact CORS origin.'
}
if ($allowed.Headers['Access-Control-Allow-Credentials'] -notmatch 'true') {
    throw 'Approved local web origin is missing credential support.'
}

try {
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/me" -TimeoutSec 20 | Out-Null
    throw 'Unauthenticated /api/me unexpectedly succeeded.'
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 401) {
        throw
    }
}

try {
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/health" -Headers @{ Origin = 'https://attacker.invalid' } -TimeoutSec 20 | Out-Null
    throw 'Unapproved browser origin unexpectedly succeeded.'
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 403) {
        throw
    }
}

Write-Output 'PASS cloud API boundary check'
Write-Output 'health=ready unauthenticated_me=401 approved_origin=credentialed unapproved_origin=403 security_headers=present'
