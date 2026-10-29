[CmdletBinding()]
param(
  [string]$Worktree = $PSScriptRoot
)

# tests/run_serp443_isolation_matrix_probe.ps1
# SERP-443 runner. Disposable Postgres, synthetic fixtures only.
#
# Follows the established repo convention: serp086/087/088/089/090 each ship
# <name>_probe.sql plus run_<name>_probe.ps1, spinning a throwaway container,
# applying migrations, running the probe, and reporting pass/fail by exit code.
#
# The database is disposable. Nothing outside the container is touched, and the
# probe itself rolls back so it leaves no residue even inside the container.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$containerName = 'starqerp-serp443-isolation-probe'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.155'
$password = 'synthetic-serp443-only'
$probeFile = Join-Path $PSScriptRoot 'serp443_isolation_matrix_probe.sql'
$started = $false

function Invoke-DockerChecked {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Exe,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Exe $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

try {
  Write-Host '== SERP-443 isolation matrix probe =='

  if (-not (Test-Path $probeFile)) {
    throw "probe file not found: $probeFile"
  }

  Invoke-DockerChecked info --format '{{.ServerVersion}}' | Out-Null
  Invoke-DockerChecked image inspect $image | Out-Null

  $existing = $null
  try {
    $existing = @(docker container inspect $containerName 2>&1)
  }
  catch {
    # A missing disposable container is the expected first-run path.
    $existing = $null
  }
  if (-not $existing -or ($existing -join "`n") -match 'No such object|No such container') {
    Invoke-DockerChecked create `
      --name $containerName `
      --mount "type=bind,source=$repoRoot,target=/workspace,readonly" `
      --tmpfs '/var/lib/postgresql/data:rw,noexec,nosuid,size=1g' `
      --env "POSTGRES_PASSWORD=$password" `
      --env 'POSTGRES_DB=postgres' `
      $image | Out-Null
  }
  else {
    $running = (& docker inspect --format '{{.State.Running}}' $containerName).Trim()
    if ($running -eq 'true') {
      Invoke-DockerChecked stop $containerName | Out-Null
    }
  }

  Invoke-DockerChecked start $containerName | Out-Null
  $started = $true

  # Supabase's image briefly accepts connections during first-time init, then
  # restarts PostgreSQL. Waiting only on pg_isready races that restart and
  # produces a false harness failure, so require the final healthy state.
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    $state = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' $containerName).Trim()
    if ($state -eq 'healthy') { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) {
    throw 'container did not become healthy in time'
  }

  # Apply migrations in filename order so the probe sees the real schema.
  Write-Host '-- applying migrations --'
  $migrationDir = Join-Path $repoRoot (Join-Path 'supabase' 'migrations')
  $migrations = Get-ChildItem -Path $migrationDir -Filter '*.sql' | Sort-Object Name
  Write-Host "   $($migrations.Count) migration(s)"

  foreach ($migration in $migrations) {
    Write-Host "   applying $($migration.Name)"
    & docker cp $migration.FullName "$containerName`:/tmp/$($migration.Name)"
    if ($LASTEXITCODE -ne 0) { throw "docker cp failed for $($migration.Name)" }
    & docker exec $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/tmp/$($migration.Name)"
    if ($LASTEXITCODE -ne 0) { throw "migration failed: $($migration.Name)" }
  }

  Write-Host '-- running SERP-443 probe --'
  Invoke-DockerChecked exec $containerName bash -c `
    "cp /workspace/tests/serp443_isolation_matrix_probe.sql /tmp/probe.sql && psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/probe.sql"

  Write-Host ''
  Write-Host 'RESULT: PASS - SERP-443 isolation matrix probe completed with no violations.'
}
catch {
  Write-Host ''
  Write-Host "RESULT: FAIL - $($_.Exception.Message)"
  exit 1
}
finally {
  if ($started) {
    Write-Host '-- stopping disposable container --'
    & docker stop $containerName 2>&1 | Out-Null
  }
}
