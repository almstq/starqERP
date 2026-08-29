$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$migrationDir = Join-Path $repo 'supabase\migrations'
$seed = Join-Path $repo 'supabase\seed.sql'

$files = Get-ChildItem -LiteralPath $migrationDir -File -Filter '*.sql' | Sort-Object Name

# The baseline is a FLOOR, not an exact set.
#
# This previously demanded exactly eight migrations and an exact filename list, so every
# legitimate new migration broke it. On 22 Aug it was throwing "Expected 8 ordered
# migrations; found 11" purely because three correct migrations had been added, and the
# runbook had to carry an instruction not to run it. A checker that must be edited every
# time the system legitimately changes is a checker people learn to skip, and then it
# protects nothing on the day it would have mattered.
#
# What actually needs guarding is that the baseline migrations are all still present, in
# order, unrenamed. Additions after the baseline are normal and are reported, not refused.
$expected = @(
    '202608200001_core_foundation.sql',
    '202608200002_garage_inventory.sql',
    '202608200003_commercial_accounting.sql',
    '202608200004_pilot_security.sql',
    '202608200005_garage_api.sql',
    '202608200006_garage_api_search_path.sql',
    '202608200007_garage_api_self_test.sql',
    '202608200008_session_authority.sql'
)

$names = @($files.Name)
$missing = @($expected | Where-Object { $_ -notin $names })
if ($missing.Count -gt 0) {
    throw "Baseline migrations missing or renamed: $($missing -join ', ')"
}

# The baseline must still occupy the first N slots in sort order. A migration inserted
# BEFORE the baseline would change apply order and is refused.
$prefix = @($names | Select-Object -First $expected.Count)
if (Compare-Object $expected $prefix -SyncWindow 0) {
    throw "Baseline migrations are no longer the first $($expected.Count) in order. Apply order has changed."
}

$added = @($names | Select-Object -Skip $expected.Count)
if ($added.Count -gt 0) {
    Write-Output "Baseline intact. $($added.Count) migration(s) added since: $($added -join ', ')"
} else {
    Write-Output 'Baseline intact. No migrations added since.'
}

$sql = ($files | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"

$required = @(
    'create table public.organisations',
    'create table public.memberships',
    'create table public.idempotency_keys',
    'create table public.audit_events',
    'enable row level security',
    'create table public.stock_movements',
    'create table public.garage_jobs',
    'create table public.job_events',
    'create table public.commercial_documents',
    'create table public.journal_proposals',
    'create table public.journal_entries',
    'create constraint trigger journal_lines_balanced',
    'create table public.security_events',
    'create table public.automation_principals',
    'create table public.command_approvals',
    'create or replace function public.api_garage_command',
    'create or replace function public.api_garage_pulse',
    'create or replace function public.api_session_authority',
    'set search_path = public, app_private, extensions, pg_temp',
    'rollback_cloud_self_test',
    'rollback_session_authority_test',
    'from anon, authenticated'
)

foreach ($fragment in $required) {
    if ($sql.IndexOf($fragment, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Required schema fragment missing: $fragment"
    }
}

$forbidden = @(
    'SUPABASE_SERVICE',
    'postgresql://',
    'postgres://',
    'apps.googleusercontent.com',
    '@gmail.com'
)

$all = $sql + "`n" + (Get-Content -LiteralPath $seed -Raw)
foreach ($fragment in $forbidden) {
    if ($all.IndexOf($fragment, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw "Forbidden secret or live-identity pattern found: $fragment"
    }
}

$beginCount = ([regex]::Matches($sql, '(?im)^begin;$')).Count
$commitCount = ([regex]::Matches($sql, '(?im)^commit;$')).Count
if ($beginCount -ne $files.Count -or $commitCount -ne $files.Count) {
    throw "Transaction wrapper mismatch: begin=$beginCount commit=$commitCount migrations=$($files.Count)."
}

$tableCount = ([regex]::Matches($sql, '(?im)^create table ')).Count
$rlsCount = ([regex]::Matches($sql, '(?im)^alter table .* enable row level security;')).Count
$policyCount = ([regex]::Matches($sql, '(?im)^create policy ')).Count

if ($tableCount -lt 20 -or $rlsCount -lt 15 -or $policyCount -lt 15) {
    throw "Schema coverage below baseline: tables=$tableCount rls=$rlsCount policies=$policyCount."
}

Write-Output "PASS repository structural check"
Write-Output "migrations=$($files.Count) tables=$tableCount rls=$rlsCount policies=$policyCount"
Write-Output 'NOTE: This repository-only check does not verify remote execution, RLS behaviour, migration reset or restore.'
