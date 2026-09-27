[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$containerName = 'starqerp-serp439-timeout-retry'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.155'
$password = 'synthetic-serp439-timeout-retry-only'
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

  # Cross-platform existence check
  try {
    & docker container inspect $containerName *> $null
    $exists = ($LASTEXITCODE -eq 0)
  } catch {
    $exists = $false
  }
  if ($exists) {
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

  $ready = $false
  foreach ($attempt in 1..120) {
    $state = (& docker inspect --format '{{.State.Status}} {{.State.Health.Status}}' $containerName).Trim()
    if ($state -eq 'running healthy') { $ready = $true; break }
    if ($state.StartsWith('exited ')) { throw "Synthetic PostgreSQL runtime exited during initialization: $state" }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Synthetic PostgreSQL runtime did not become healthy within 120 seconds.' }

  $migrationFiles = Get-ChildItem (Join-Path $repoRoot 'supabase/migrations') -File -Filter '*.sql' |
    Sort-Object Name
  foreach ($migration in $migrationFiles) {
    Invoke-Psql -File "/workspace/supabase/migrations/$($migration.Name)"
  }

  Invoke-Psql -File '/workspace/tests/serp439_counter_sale_timeout_retry_probe.sql'
  Write-Host 'SERP-439 COUNTER_SALE timeout/retry exactly-once probe: PASS' -ForegroundColor Green
} finally {
  if ($started) { & docker rm --force $containerName *> $null }
}
