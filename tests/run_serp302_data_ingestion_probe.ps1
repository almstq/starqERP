[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$containerName = 'starqerp-serp302-data-ingestion-probe'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.155'
$password = 'synthetic-serp302-probe-only'
$started = $false

function Invoke-DockerChecked {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Psql {
  param([string]$File, [string]$Command)
  if ($File) {
    Invoke-DockerChecked exec $containerName psql `
      --username postgres --dbname postgres --set ON_ERROR_STOP=1 --file $File | Out-Host
  } else {
    Invoke-DockerChecked exec $containerName psql `
      --username postgres --dbname postgres --set ON_ERROR_STOP=1 --command $Command | Out-Host
  }
}

try {
  Invoke-DockerChecked info --format '{{.ServerVersion}}' | Out-Null
  Invoke-DockerChecked image inspect $image | Out-Null

  cmd /c "docker container inspect $containerName 1>nul 2>nul"
  $existing = ($LASTEXITCODE -eq 0)
  if ($existing) {
    Invoke-DockerChecked rm --force $containerName | Out-Null
  }

  Invoke-DockerChecked create `
    --name $containerName `
    --mount "type=bind,source=$repoRoot,target=/workspace,readonly" `
    --tmpfs '/var/lib/postgresql/data:rw,noexec,nosuid,size=1g' `
    --env "POSTGRES_PASSWORD=$password" `
    --env 'POSTGRES_DB=postgres' `
    $image | Out-Null

  Invoke-DockerChecked start $containerName | Out-Null
  $started = $true

  # The Supabase image accepts connections briefly during first-time init and
  # then restarts PostgreSQL. Wait on the healthcheck's settled state.
  $ready = $false
  foreach ($attempt in 1..120) {
    $state = (& docker inspect --format '{{.State.Status}} {{.State.Health.Status}}' $containerName).Trim()
    if ($state -eq 'running healthy') { $ready = $true; break }
    if ($state.StartsWith('exited ')) {
      throw "Synthetic PostgreSQL runtime exited during initialization: $state"
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    throw 'Synthetic PostgreSQL runtime did not become healthy within 120 seconds.'
  }

  Write-Host "Applying baseline migrations..." -ForegroundColor Cyan
  $migrations = Get-ChildItem -Path "$repoRoot/supabase/migrations" -Filter "*.sql" | Sort-Object Name
  foreach ($m in $migrations) {
    Invoke-Psql -File "/workspace/supabase/migrations/$($m.Name)"
  }

  Write-Host "Executing SERP-302 Ingestion DB probe..." -ForegroundColor Cyan
  Invoke-Psql -File "/workspace/tests/serp302_data_ingestion_probe.sql"

  Write-Host "SERP-302 DB probe PASSED." -ForegroundColor Green
}
finally {
  if ($started) {
    & docker rm --force $containerName *> $null
  }
}
