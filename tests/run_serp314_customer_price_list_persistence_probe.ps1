[CmdletBinding()]
param(
  # DEC-072 negative control. When set, migration 202609090050 (the Gap-1
  # persistence change) is NOT applied. On the clean baseline this leaves
  # contacts.metadata absent, so the probe must fail RED before any round-trip
  # claim can pass. A control that never turns red proves nothing.
  [switch]$SkipPersistenceMigration
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$containerName = 'starqerp-serp314-price-list-persistence'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.155'
$password = 'synthetic-serp314-gap1-only'
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

  # container inspect writes "no such container" to stderr, which PS 5.1 turns
  # into a terminating error under $ErrorActionPreference = 'Stop'. Probe the
  # exit code via cmd instead so the runner behaves identically on 5.1 and 7+.
  # Always remove a prior container before recreating it: its bind mount points
  # at this worktree, so reusing it can execute against stale source content.
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

  $migrationFiles = Get-ChildItem (Join-Path $repoRoot 'supabase/migrations') -File -Filter '*.sql' |
    Sort-Object Name
  foreach ($migration in $migrationFiles) {
    if ($SkipPersistenceMigration -and $migration.Name -eq '202609090050_serp314_customer_price_list_persistence.sql') {
      Write-Host "Skipping $($migration.Name) (negative control)" -ForegroundColor Yellow
      continue
    }
    Invoke-Psql -File "/workspace/supabase/migrations/$($migration.Name)"
  }

  if ($SkipPersistenceMigration) {
    Write-Host 'NEGATIVE CONTROL: persistence migration withheld - this run is expected to FAIL (RED)' -ForegroundColor Yellow
  }

  Invoke-Psql -File '/workspace/tests/serp314_customer_price_list_persistence_probe.sql'

  Write-Host 'SERP-314 Gap 1 price_list_id persistence probe: PASS' -ForegroundColor Green
} finally {
  if ($started) {
    & docker rm --force $containerName *> $null
  }
}
