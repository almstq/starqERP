[CmdletBinding()]
param()

# tests/run_serp441_malformed_tender_probe.ps1
# SERP-441 — runs tests/serp441_malformed_tender_probe.sql against a DISPOSABLE
# PostgreSQL container, then destroys it. Mirrors run_serp090_retry_resilience_probe.ps1.
#
# Rule 0: the container data directory is a tmpfs, so no database data is ever
# written to the host disk, and the repo is bind-mounted READ-ONLY. The image is
# the same one every SERP-086..090 probe used; nothing is installed.
#
# DIVERGENCE FROM THE SHARED HARNESS, and why:
# The sibling runners (run_serp090_*.ps1 and the rest) abort on their first
# migration under Windows PowerShell 5.1. Cause: psql writes NOTICE records to
# stderr, and `$ErrorActionPreference = 'Stop'` promotes any native stderr to a
# terminating NativeCommandError. The Supabase image already ships pgcrypto, so
# the very first migration always emits one such NOTICE. Verified: the SERP-090
# runner fails identically on the same line, so this is a pre-existing defect in
# the shared pattern, not something this lane introduced.
# This runner merges native stderr into the output stream so notices print as
# text, and keeps $LASTEXITCODE as the authoritative gate. psql runs with
# --set ON_ERROR_STOP=1, so a real SQL failure still exits non-zero and still
# throws. No other runner is modified by this lane.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$containerName = 'starqerp-serp441-tender'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.155'
$password = 'synthetic-serp441-tender-only'
$started = $false

function Invoke-DockerChecked {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  # Windows PowerShell 5.1 wraps native stderr in ErrorRecords even under 2>&1,
  # and under $ErrorActionPreference='Stop' that is terminating. So the
  # preference is relaxed ONLY around the native call and restored immediately;
  # the explicit $LASTEXITCODE throw below remains the authoritative gate.
  $prior = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & docker @Arguments 2>&1
  } finally {
    $ErrorActionPreference = $prior
  }
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

  Invoke-Psql -File '/workspace/tests/serp441_malformed_tender_probe.sql'
  Write-Host 'SERP-441 malformed tender/change negative probe: PASS' -ForegroundColor Green
} finally {
  if ($started) { & docker rm --force $containerName *> $null }
}
