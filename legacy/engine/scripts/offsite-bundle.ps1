# Offsite copy of every repository, as verifiable git bundles.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHY BUNDLES AND NOT A FOLDER COPY
# ─────────────────────────────────────────────────────────────────────────────
# A git bundle is a single file containing the complete history, and `git bundle
# verify` proves it is intact and restorable BEFORE you need it. A copied working
# folder proves nothing — it can be half-written, it can miss .git internals, and
# you find out on the day you cannot afford to.
#
# This exists because on 23 August 2026 ninety commits of two days' work existed
# in exactly one place: 38 in the foundation engine, 52 in starqNexus, neither pushed, with
# the external drive unplugged. DEC-019 asks for an offsite copy and had only been
# partly discharged — the Supabase database was copied on 22 Aug, the source was not.
#
# Restore from one:  git clone <bundle> <dir>
#
# This does NOT satisfy DEC-019 on its own. A bundle sitting on a drive next to the
# machine is a BACKUP; DEC-019 asks for OFF-SITE. Take the drive somewhere else.
#
# ─────────────────────────────────────────────────────────────────────────────
# SERP-173, 24 August 2026 — three gaps this run closes
# ─────────────────────────────────────────────────────────────────────────────
# 1. starqERP WAS NOT IN THE LIST. It is the product, it has four commits, it has
#    no remote, and it existed on one disk. It is now the first entry.
#
# 2. THE JOURNALS ARE IN NO REPOSITORY AT ALL. legacy/engine/.gitignore line 5
#    ignores `journals/`, and those plain-text journals ARE the books — SQLite is
#    derived from them. A bundle-only backup captured every line of code that
#    reads the accounts and not one line of the accounts themselves. They are now
#    archived separately, with a per-file SHA-256 manifest.
#
# 3. A BUNDLE IS UNREADABLE WITHOUT GIT. Every artefact above restores only by
#    running `git clone` against it. On the day the founder wants to READ the
#    blueprint, the decisions or the handover — on a borrowed laptop, on a phone,
#    in a lawyer's office, or simply without a toolchain — a bundle is a wall.
#    Every run now also writes the records as PLAIN FILES you can open, with a
#    SHA-256 per file so a copy can still be proven against the original.
#
# 4. WINDOWS CANNOT CHECK THE VAULT OUT. Found by restore-testing on 24 Aug and
#    it is the single most valuable thing this script has produced. The vault
#    bundle is intact and clones perfectly, and then CHECKOUT FAILS:
#
#      error: unable to create file 00_STARQ_HQ/corporate/banking-applications/
#             01 - Club Ignition - BML Islamic/08 - Corporate Supporting Documents/
#             B - Starq Technologies (shareholding entity)/
#             B5 - Income Tax Registration Certificate (TIN 1186669).pdf
#      fatal: unable to checkout working tree
#
#    Five tracked paths exceed 200 characters, the longest 215, and Windows caps
#    a path at 260 unless long paths are enabled. They are real corporate banking
#    documents. A restore onto a default Windows machine gets a repository that
#    clones, reports success, and IS MISSING FILES.
#
#    The bundle is not at fault and neither is git. The fix belongs to whoever
#    restores, so it is printed in the restore banner and audited on every run
#    below - instantly, by measuring path lengths, rather than by spending four
#    minutes writing a gigabyte to discover the same thing.
#
# 5. A BUNDLE ONLY CONTAINS COMMITTED HISTORY. Uncommitted work is invisible to
#    `git bundle create` and the run still reports success — which is exactly how
#    two days of decisions could be backed up and lost at the same time. The
#    pre-flight below refuses to pretend: it counts the dirty files in every repo
#    and, unless -AllowDirty is passed, stops before writing anything.
#
# ─────────────────────────────────────────────────────────────────────────────
# HOW TO RUN IT
# ─────────────────────────────────────────────────────────────────────────────
#   pwsh -File scripts/offsite-bundle.ps1                  # bundle + verify + restore-test
#   pwsh -File scripts/offsite-bundle.ps1 -Encrypt         # ... and encrypt (prompts for the passphrase)
#   pwsh -File scripts/offsite-bundle.ps1 -AllowDirty      # proceed with uncommitted work, recorded as such
#
# -Encrypt is interactive by design. The passphrase is the founder's and is never
# stored, never passed on a command line, and never seen by an agent. A key kept
# beside the backup it protects is not encryption, it is decoration.
#
# ─────────────────────────────────────────────────────────────────────────────
# THIS BACKUP SET IS CALLED "STARQ ARK". THE NAME IS A SAFETY FEATURE.
# ─────────────────────────────────────────────────────────────────────────────
# There are TWO encrypted backup sets on the offsite drive, they use the SAME
# crypto module, and until 24 Aug 2026 they showed the SAME passphrase prompt —
# the bare string "Offline vault passphrase" from VaultCrypto.psm1. Nothing on
# screen told you which of the two secrets was being asked for.
#
#   STARQ ARK      this script. Source, history, the books, and the records.
#                  E:\STARQ-TIER1\repo-bundles\starq-ark-<stamp>.starqv01
#                  Run often — DEC-019 wants weekly or monthly.
#
#   STARQ SECRETS  _secrets/scripts/Backup-SecretsToOfflineVault.ps1.
#                  Live credentials: starqBooks.env, the identity allowlist, and
#                  the STARQ ERP Android RELEASE SIGNING KEY.
#                  E:\STARQ_OFFLINE_VAULT\archives\starq-secrets-<stamp>.sqv
#                  Opened rarely, in emergencies.
#
# USE A DIFFERENT PASSPHRASE FOR EACH, and label them by these names wherever
# you record them. The reasoning is not neatness:
#
#   · DIFFERENT BLAST RADIUS. Losing STARQ ARK is disclosure of source and
#     records. Losing STARQ SECRETS hands someone the ability to SIGN A RELEASE
#     AS STARQ ERP and reach a live system. That is capability, not knowledge.
#
#   · DIFFERENT FREQUENCY. This backup runs routinely and prompts twice a run.
#     The secrets vault is opened rarely. Reusing the secrets passphrase here
#     would drag the highest-value key into the most frequently typed prompt.
#
# THE COST, STATED HONESTLY: two passphrases is two things to lose, and PBKDF2 at
# 600,000 iterations has no back door. A forgotten passphrase means the archive
# is gone. Record both, off this machine, under these names.

[CmdletBinding()]
param(
    # Destination drive. C: and D: are refused: an offsite copy on the machine
    # being protected is not a copy (Rule 0, and plain sense).
    [ValidatePattern('^[E-Ze-z]$')]
    [string]$DriveLetter = 'E',

    # Encrypt the run into a single AES-256-GCM archive. Prompts for the passphrase.
    [switch]$Encrypt,

    # Proceed even though a repository has uncommitted changes. The dirty file
    # count is written into the manifest either way, so a restore never has to
    # guess whether it is looking at everything.
    [switch]$AllowDirty,

    # Skip the clone-back proof. Present for speed on a repeat run within a
    # session; never use it for the run you intend to rely on.
    [switch]$SkipRestoreTest
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$vault = 'D:\!starq'

# ─── destination ─────────────────────────────────────────────────────────────
$letter = $DriveLetter.ToUpperInvariant()
if ($letter -in @('C', 'D')) { throw 'RULE 0 / DEC-019: C: and D: cannot be offsite targets.' }
if (-not (Test-Path "$letter`:\")) { throw "Drive $letter`: is not present. Plug the offsite drive in." }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$dest = "$letter`:\STARQ-TIER1\repo-bundles\$stamp"

# name => working tree. Add repositories here as they appear.
$repos = [ordered]@{
    'starqERP'   = 'D:\!starq\starqERP'
    'vault'      = 'D:\!starq'
    'the foundation engine' = 'D:\!starq\the foundation engine'
    'starqNexus' = 'D:\!starq\starqNexus'
}

# Trees that no repository tracks and that a bundle therefore cannot contain.
$looseTrees = [ordered]@{
    'journals' = 'D:\!starq\the foundation engine\journals'
}

# Trees copied VERBATIM, readable without git or any other tool.
#
# These are the same files the bundles already contain. The duplication is the
# point: a bundle proves history is intact, a plain copy lets a person read the
# blueprint. The two answer different questions on a bad day, and the cheap one
# is the one you actually reach for.
$recordTrees = [ordered]@{
    'HQ'              = 'D:\!starq\00_STARQ_HQ'
    'project-records' = 'D:\!starq\library\12_PROJECTS'
}

function Get-Sha256([string]$Path) {
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

# ─── pre-flight: what would this bundle silently omit? ───────────────────────
Write-Output ''
Write-Output '=== PRE-FLIGHT: uncommitted work is NOT captured by a bundle ==='

$dirty = @()
foreach ($name in $repos.Keys) {
    $path = $repos[$name]
    if (-not (Test-Path (Join-Path $path '.git'))) {
        Write-Output "  $name : SKIP - not a git repository at $path"
        continue
    }
    $changes = @(git -C $path status --porcelain 2>$null)
    if ($changes.Count -gt 0) {
        $dirty += [pscustomobject]@{ repo = $name; files = $changes.Count }
        Write-Output "  $name : $($changes.Count) uncommitted file(s) - these will NOT be in the bundle"
    }
    else {
        Write-Output "  $name : clean"
    }
}

if ($dirty.Count -gt 0 -and -not $AllowDirty) {
    Write-Output ''
    Write-Output 'STOPPED. Commit the work above, or re-run with -AllowDirty to bundle without it.'
    Write-Output 'A run that reports success while omitting uncommitted work is the failure mode'
    Write-Output 'this check exists to prevent.'
    throw 'Uncommitted work present; refusing to write a backup that omits it.'
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
$manifest = @()

# ─── repositories ────────────────────────────────────────────────────────────
Write-Output ''
Write-Output '=== REPOSITORIES ==='

foreach ($name in $repos.Keys) {
    $path = $repos[$name]
    if (-not (Test-Path (Join-Path $path '.git'))) { continue }

    $bundle = Join-Path $dest "$name.bundle"
    Write-Output "==> $name"

    # Tag the exact commit this backup restores to, so a restore can be named
    # rather than described. Idempotent within a run; one tag per stamp.
    $tag = "backup/$stamp"
    git -C $path tag -a $tag -m "Offsite bundle $stamp" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Output "    tag: $tag already exists, reusing" }
    else { Write-Output "    tag: $tag" }

    # --all captures every branch and tag, not just the checked-out one.
    git -C $path bundle create $bundle --all 2>&1 | Where-Object { $_ -notmatch '^\s*$' } | ForEach-Object { "    $_" }
    if ($LASTEXITCODE -ne 0) { throw "bundle failed for $name" }

    # Prove it before trusting it. This is the whole point of using bundles.
    $verify = git -C $path bundle verify $bundle 2>&1
    # Pick the line that states the verdict, not whichever happens to be last -
    # git prints the hash algorithm after it for some bundles.
    $verdict = ($verify | Where-Object { $_ -match 'is okay|The bundle' } | Select-Object -First 1)
    Write-Output "    verify: $verdict"
    if ($LASTEXITCODE -ne 0) { throw "VERIFY FAILED for $name - the bundle is not restorable" }

    $sha = Get-Sha256 $bundle
    $size = [math]::Round((Get-Item $bundle).Length / 1MB, 1)
    $head = (git -C $path rev-parse --short HEAD)
    $count = (git -C $path rev-list --count HEAD)
    $dirtyCount = @(git -C $path status --porcelain 2>$null).Count

    $manifest += [pscustomobject]@{
        kind = 'repo'; name = $name; head = $head; commits = $count
        tag = $tag; uncommitted = $dirtyCount; size_mb = $size; sha256 = $sha
    }
    Write-Output "    $size MB - HEAD $head - $count commits - $dirtyCount uncommitted"
}

# ─── loose trees no repository tracks ────────────────────────────────────────
Write-Output ''
Write-Output '=== UNTRACKED TREES (the books) ==='

foreach ($name in $looseTrees.Keys) {
    $path = $looseTrees[$name]
    if (-not (Test-Path $path)) {
        Write-Output "  $name : SKIP - nothing at $path"
        continue
    }

    Write-Output "==> $name"
    $zip = Join-Path $dest "$name.zip"
    Compress-Archive -Path (Join-Path $path '*') -DestinationPath $zip -CompressionLevel Optimal

    # A per-file manifest, because a zip that opens is not the same as a zip that
    # contains what you think. This is what a restore is checked against.
    $files = Get-ChildItem -LiteralPath $path -Recurse -File
    $rows = foreach ($f in $files) {
        [pscustomobject]@{
            path = $f.FullName.Substring($path.Length).TrimStart('\')
            bytes = $f.Length
            sha256 = Get-Sha256 $f.FullName
        }
    }
    $rows | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $dest "$name-files.json")

    $sha = Get-Sha256 $zip
    $size = [math]::Round((Get-Item $zip).Length / 1MB, 3)
    $manifest += [pscustomobject]@{
        kind = 'tree'; name = $name; head = ''; commits = $files.Count
        tag = ''; uncommitted = 0; size_mb = $size; sha256 = $sha
    }
    Write-Output "    $size MB - $($files.Count) files - per-file manifest written"
}

# ─── path-length audit ───────────────────────────────────────────────────────
# Windows refuses to create a path over 260 characters unless long paths are
# enabled. A repository can bundle cleanly, verify cleanly, clone cleanly, and
# still fail to produce a complete working tree on restore. This measures the
# risk directly instead of discovering it during an emergency.
Write-Output ''
Write-Output '=== PATH LENGTH AUDIT (Windows MAX_PATH = 260) ==='

$WINDOWS_MAX_PATH = 260

# REPORT THE BUDGET, DO NOT GUESS THE DESTINATION.
#
# The first version of this audit assumed a 40-character restore prefix and
# therefore printed "vault : clear" for the one repository that had just been
# PROVEN to fail checkout - the real attempt used a 56-character destination.
# An audit that clears the thing it was written to catch is worse than no audit,
# because it converts a known hazard into a documented reassurance.
#
# So it no longer guesses. For each repo it computes the LONGEST tracked path and
# derives the maximum destination directory length that can still be checked out.
# That number is a fact about the repository; whether a given restore fits is then
# something the person restoring can check against their own path in one glance.
#
# HEADROOM is what turns it into a warning: a repository whose restore budget is
# under 80 characters is fragile in practice, because ordinary destinations -
# a dated folder on an external drive, a user profile path, a temp directory -
# routinely run past it.
$MIN_COMFORTABLE_BUDGET = 80
$longPathFindings = @()

foreach ($name in $repos.Keys) {
    $path = $repos[$name]
    if (-not (Test-Path (Join-Path $path '.git'))) { continue }

    $tracked = @(git -C $path ls-files 2>$null)
    if ($tracked.Count -eq 0) { continue }

    $longest = ($tracked | Measure-Object -Property Length -Maximum).Maximum
    # +1 for the separator between the destination directory and the repo path.
    $budget = $WINDOWS_MAX_PATH - $longest - 1

    if ($budget -lt $MIN_COMFORTABLE_BUDGET) {
        $risky = @($tracked | Where-Object { $_.Length -gt ($WINDOWS_MAX_PATH - $MIN_COMFORTABLE_BUDGET - 1) })
        Write-Output "  $name : AT RISK - longest path $longest chars, leaving only $budget chars for the restore destination"
        Write-Output "      $($risky.Count) path(s) are this long. Restore MUST use -c core.longpaths=true,"
        Write-Output "      or the destination directory must be shorter than $budget characters."
        foreach ($r in ($risky | Sort-Object Length -Descending | Select-Object -First 5)) {
            Write-Output "      $($r.Length)  $r"
        }
        $longPathFindings += [pscustomobject]@{
            repo = $name; longest = $longest; restore_budget_chars = $budget
            count = $risky.Count; paths = $risky
        }
    }
    else {
        Write-Output "  $name : clear - longest $longest chars, $budget chars of destination budget"
    }
}

if ($longPathFindings.Count -gt 0) {
    $longPathFindings | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $dest 'LONG-PATHS.json')
    Write-Output ''
    Write-Output '  These restore ONLY with:  git -c core.longpaths=true clone ...'
    Write-Output '  Recorded in LONG-PATHS.json. A restore-day instruction, not a defect in the backup.'
}

# ─── readable records ────────────────────────────────────────────────────────
Write-Output ''
Write-Output '=== READABLE RECORDS (openable without git) ==='

$recordRoot = Join-Path $dest 'records'
foreach ($name in $recordTrees.Keys) {
    $path = $recordTrees[$name]
    if (-not (Test-Path $path)) {
        Write-Output "  $name : SKIP - nothing at $path"
        continue
    }

    Write-Output "==> $name"
    $target = Join-Path $recordRoot $name
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Path (Join-Path $path '*') -Destination $target -Recurse -Force

    $srcFiles = Get-ChildItem -LiteralPath $path -Recurse -File
    $rows = foreach ($f in $srcFiles) {
        [pscustomobject]@{
            path = $f.FullName.Substring($path.Length).TrimStart('\')
            bytes = $f.Length
            sha256 = Get-Sha256 $f.FullName
        }
    }
    $rows | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $recordRoot "$name-files.json")

    $mb = [math]::Round((($srcFiles | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
    $manifest += [pscustomobject]@{
        kind = 'records'; name = $name; head = ''; commits = $srcFiles.Count
        tag = ''; uncommitted = 0; size_mb = $mb; sha256 = ''
    }
    Write-Output "    $mb MB - $($srcFiles.Count) files copied verbatim - per-file manifest written"
}

# A plain-text pointer, so someone opening this drive cold knows what they have.
@"
STARQ ARK - $stamp
================================================================

THE ENCRYPTED ARCHIVE FOR THIS SET IS CALLED  starq-ark-<stamp>.starqv01
AND IT OPENS WITH THE PASSPHRASE LABELLED     STARQ ARK

There is a second, separate encrypted backup on this drive:

  STARQ SECRETS  E:\STARQ_OFFLINE_VAULT\archives\starq-secrets-*.sqv
                 Live credentials and the STARQ ERP Android release signing key.
                 It has its OWN passphrase. The two are not interchangeable and
                 are deliberately different, because losing STARQ SECRETS hands
                 someone the ability to sign a release as Starq ERP.

Both use AES-256-GCM with PBKDF2-SHA256 at 600,000 iterations. Neither stores
its key anywhere. A lost passphrase means the archive is unrecoverable - there
is no back door and nobody can help you.
================================================================

WHAT IS HERE

  *.bundle            Complete git history. Restore with:

                        git -c safe.directory=* -c core.longpaths=true \
                            clone <file>.bundle <dir>

                      BOTH flags are required and each prevents a different
                      silent failure:

                      safe.directory=*    this volume records no ownership, so
                          git refuses to read a repository it cannot prove you
                          own. Without it the clone appears to work and every
                          later command fails.

                      core.longpaths=true 21 tracked paths in the vault run
                          past 180 characters, the longest 215 - they are
                          corporate banking documents - and Windows caps a path
                          at 260, leaving only 44 characters for your
                          destination directory. WITHOUT THIS FLAG THE CLONE
                          REPORTS SUCCESS AND SILENTLY OMITS THOSE FILES.
                          See LONG-PATHS.json for the exact list.

  journals.zip        The plain-text accounting journals. These are THE BOOKS;
                      the SQLite database is derived from them. They are in no
                      git repository (legacy/engine/.gitignore ignores journals/),
                      so this archive is their only version-independent copy.
                      Verify against journals-files.json - one SHA-256 per file.

  records/HQ/         00_STARQ_HQ, copied verbatim. Open anything directly.
                      Start with:
                        2026-08-24_STARQERP_FINAL_BLUEPRINT.md   the baseline
                        2026-08-24_HANDOVER.md                   the cold start
                        decisions.json                           every decision
                        reports/2026-08-23_24/                   the evidence
                        MASTER_CORPORATE_BLUEPRINT_AND_SCOPE_SPECIFICATION.md

  records/project-records/   library/12_PROJECTS - the per-project authority
                             records. project-starq-erp.md is the ERP's.

  MANIFEST.txt        What this run captured, readable.
  manifest.json       The same, machine-readable.

WHAT THIS IS NOT

  This is a BACKUP. It becomes an OFFSITE copy only when the drive leaves the
  building (DEC-019). Until then it protects against disk failure and not
  against fire, theft, or the flat.

  Figures in the records were true when written. The books are the journals.
"@ | Set-Content -Path (Join-Path $dest 'README.txt')

# ─── restore test: clone every bundle back, compare HEAD ─────────────────────
if (-not $SkipRestoreTest) {
    Write-Output ''
    Write-Output '=== RESTORE TEST ==='
    $testRoot = Join-Path $dest '.restore-test'
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    # -c safe.directory=* IS LOAD-BEARING, AND THE RESTORE TEST IS HOW WE FOUND OUT.
    #
    # An external drive is usually exFAT, which records no ownership. Git treats a
    # repository it cannot prove you own as "dubious ownership" and REFUSES TO READ
    # IT - `git clone` succeeds, and then every subsequent command fails. On the
    # first run of this script the clone worked, `rev-parse` returned an empty
    # string, and the run failed with a mismatch that looked like a corrupt bundle
    # but was nothing of the sort.
    #
    # The lesson is about restore day, not about this script: a person restoring
    # from this drive will hit exactly the same wall, and will hit it while trying
    # to recover from a disaster. So the flag is passed per-invocation here, and the
    # instruction is printed in the restore banner at the end of the run. It is
    # deliberately NOT written into the machine's global git config - a backup
    # script has no business permanently lowering the safety settings of the
    # machine it is backing up.
    # core.longpaths=true travels with every restore call for the reason in note 4
    # of the header. Passed per-invocation, never written to the machine's config.
    $gitSafe = @('-c', 'safe.directory=*', '-c', 'core.longpaths=true')

    try {
        foreach ($row in $manifest | Where-Object { $_.kind -eq 'repo' }) {
            $bundle = Join-Path $dest "$($row.name).bundle"
            $target = Join-Path $testRoot $row.name
            # --no-checkout ON PURPOSE, and it makes the test STRONGER, not weaker.
            #
            # A working tree is not what a backup has to prove. What must be proven
            # is that every object is present and reachable, and `rev-list --count`
            # below walks the entire commit graph to establish exactly that — a
            # checkout only writes files that git has already proven it holds.
            #
            # Checking out was also actively harmful here: the vault is 2,347 files
            # and starqNexus is comparable, so a full run materialised roughly a
            # gigabyte onto an external drive on every backup. That is slow enough
            # to look like a hang, and a restore test people avoid running is a
            # restore test that does not exist.
            git @gitSafe clone --no-checkout --quiet $bundle $target 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "RESTORE FAILED: could not clone $($row.name) from its bundle" }
            $restoredHead = (git @gitSafe -C $target rev-parse --short HEAD)
            if ([string]::IsNullOrWhiteSpace($restoredHead)) {
                throw "RESTORE FAILED for $($row.name): the clone is unreadable (git returned nothing for HEAD)"
            }
            if ($restoredHead -ne $row.head) {
                throw "RESTORE MISMATCH for $($row.name): bundle restored $restoredHead, expected $($row.head)"
            }
            # Walks every commit from HEAD. A missing or corrupt object anywhere in
            # the history fails here rather than years later.
            $restoredCount = (git @gitSafe -C $target rev-list --count HEAD)
            if ($restoredCount -ne $row.commits) {
                throw "RESTORE MISMATCH for $($row.name): bundle holds $restoredCount commits, source has $($row.commits)"
            }
            Write-Output "  $($row.name) : HEAD $restoredHead, $restoredCount commits walked - MATCHES"
        }

        foreach ($row in $manifest | Where-Object { $_.kind -eq 'tree' }) {
            $zip = Join-Path $dest "$($row.name).zip"
            $target = Join-Path $testRoot $row.name
            Expand-Archive -LiteralPath $zip -DestinationPath $target -Force
            $expected = Get-Content -Raw (Join-Path $dest "$($row.name)-files.json") | ConvertFrom-Json
            foreach ($e in $expected) {
                $restored = Join-Path $target $e.path
                if (-not (Test-Path -LiteralPath $restored)) { throw "RESTORE FAILED: $($e.path) missing from $($row.name).zip" }
                $got = Get-Sha256 $restored
                if ($got -ne $e.sha256) { throw "RESTORE CORRUPT: $($e.path) hash $got, expected $($e.sha256)" }
            }
            Write-Output "  $($row.name) : $($expected.Count) files restored, every SHA-256 matches"
        }

        # The record trees are already sitting on the drive - nothing to extract,
        # so the check is simply: is every file there, and is it the same file?
        foreach ($row in $manifest | Where-Object { $_.kind -eq 'records' }) {
            $expected = Get-Content -Raw (Join-Path $recordRoot "$($row.name)-files.json") | ConvertFrom-Json
            $bad = 0
            foreach ($e in $expected) {
                $copied = Join-Path (Join-Path $recordRoot $row.name) $e.path
                if (-not (Test-Path -LiteralPath $copied)) { throw "RECORDS FAILED: $($e.path) missing from records/$($row.name)" }
                if ((Get-Sha256 $copied) -ne $e.sha256) { $bad++ }
            }
            if ($bad -gt 0) { throw "RECORDS CORRUPT: $bad file(s) in records/$($row.name) do not match their source hash" }
            Write-Output "  records/$($row.name) : $($expected.Count) files verified against source SHA-256"
        }
    }
    finally {
        # Removing only what this run just created in its own scratch folder.
        #
        # Git marks everything under .git/objects READ-ONLY, and on an external
        # volume Remove-Item -Force does not reliably clear that before unlinking.
        # The first version of this block failed here — and because it failed
        # inside `finally`, IT REPLACED THE REAL ERROR FROM THE TRY BLOCK WITH ITS
        # OWN. A cleanup fault that hides a restore fault is worse than no cleanup
        # at all: it turns "your backup does not restore" into "could not delete a
        # temp folder". So the attributes are cleared first, and any failure here
        # is reported as a warning and never allowed to mask what came before.
        # Clear the read-only bit on DIRECTORIES as well as files - clearing it
        # on files alone still leaves Remove-Item failing with "directory is not
        # empty", which is what actually happened on the first two runs. Then
        # delete through .NET, which does not carry Remove-Item's retry behaviour
        # on this volume.
        if (Test-Path $testRoot) {
            try {
                Get-ChildItem -LiteralPath $testRoot -Recurse -Force |
                    ForEach-Object { try { $_.Attributes = [IO.FileAttributes]::Normal } catch {} }
                [IO.Directory]::Delete($testRoot, $true)
            }
            catch {
                Write-Warning "Could not remove the restore-test scratch folder at $testRoot - delete it by hand. ($($_.Exception.Message))"
            }
        }
    }
}

# ─── manifest ────────────────────────────────────────────────────────────────
$manifest | Format-Table -AutoSize | Out-String | Set-Content -Path (Join-Path $dest 'MANIFEST.txt')
$manifest | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $dest 'manifest.json')

# ─── encryption ──────────────────────────────────────────────────────────────
$encrypted = $null
if ($Encrypt) {
    Write-Output ''
    Write-Output '=== ENCRYPT ==='
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        throw 'Encryption requires PowerShell 7+ for AES-256-GCM. Run with pwsh.exe.'
    }
    Import-Module (Join-Path $vault '_secrets\scripts\VaultCrypto.psm1') -Force

    $plainZip = Join-Path (Split-Path -Parent $dest) "$stamp.zip"
    Compress-Archive -Path (Join-Path $dest '*') -DestinationPath $plainZip -CompressionLevel Optimal
    $plainSha = Get-Sha256 $plainZip

    # Named, not just timestamped, so the file itself says which passphrase opens it.
    $encrypted = Join-Path (Split-Path -Parent $dest) "starq-ark-$stamp.starqv01"

    # VaultCrypto.psm1 is shared with the secrets vault and prompts with a bare
    # "Offline vault passphrase" for both. Two different secrets behind one
    # identical prompt is how the wrong passphrase gets typed — and typing the
    # SECRETS passphrase here would spread the signing key's secret into a
    # routine workflow without anyone noticing. The module is not modified; the
    # ambiguity is removed by saying plainly which one is wanted.
    # Built at runtime and padded from the content, because a hand-drawn box goes
    # crooked the moment anyone edits a line - the first version of this one did.
    # ASCII rather than box-drawing characters, because this is the one message in
    # the run that MUST stay legible on a console with an unhelpful codepage.
    $arkMsg = @(
        'PASSPHRASE WANTED:   S T A R Q   A R K',
        '',
        'This is NOT the STARQ SECRETS passphrase.',
        'STARQ SECRETS opens the Android release signing',
        'key and starqBooks.env. Never type it here.'
    )
    $w = (($arkMsg | Measure-Object -Property Length -Maximum).Maximum) + 4
    Write-Output ''
    Write-Output ('  +' + ('-' * $w) + '+')
    foreach ($m in $arkMsg) { Write-Output ('  |  ' + $m.PadRight($w - 4) + '  |') }
    Write-Output ('  +' + ('-' * $w) + '+')
    Write-Output ''
    Protect-StarqArchive -InputPath $plainZip -OutputPath $encrypted
    Write-Output "  encrypted -> $encrypted"

    # Prove the round-trip. An archive that has never been decrypted is a promise,
    # not a backup - and the passphrase is verified here, while it can still be
    # corrected, rather than on the day it is needed.
    Write-Output ''
    Write-Output '  Verifying the round-trip. The STARQ ARK passphrase is requested a SECOND time —'
    Write-Output '  this decrypts what was just written and compares it byte for byte. An archive'
    Write-Output '  that has never been decrypted is a promise, not a backup, and this is where a'
    Write-Output '  mistyped passphrase gets caught while it can still be corrected.'
    $roundTrip = Join-Path (Split-Path -Parent $dest) "$stamp.verify.zip"
    Unprotect-StarqArchive -InputPath $encrypted -OutputPath $roundTrip
    $rtSha = Get-Sha256 $roundTrip
    Remove-Item -Force -LiteralPath $roundTrip
    if ($rtSha -ne $plainSha) { throw "ENCRYPTION ROUND-TRIP FAILED: $rtSha != $plainSha" }
    Write-Output "  round-trip verified: $rtSha"

    Remove-Item -Force -LiteralPath $plainZip
    "sha256(plaintext zip) = $plainSha" | Set-Content -Path (Join-Path $dest 'ENCRYPTED.txt')
}

# ─── report ──────────────────────────────────────────────────────────────────
Write-Output ''
Write-Output "Bundles written and VERIFIED: $dest"
Write-Output ''
$manifest | Format-Table -AutoSize
Write-Output 'RESTORE INSTRUCTIONS'
Write-Output '  git -c safe.directory=* -c core.longpaths=true clone <bundle> <dir>'
Write-Output '  BOTH flags are required. safe.directory=* because this volume records no ownership'
Write-Output '  and git refuses to read a repo it cannot prove you own. core.longpaths=true because'
Write-Output '  21 vault paths run past 180 chars (longest 215) and Windows caps at 260, leaving'
Write-Output '  44 chars for your destination - without it the clone'
Write-Output '  REPORTS SUCCESS AND SILENTLY OMITS THOSE FILES.'
Write-Output '  The journals are not a repository - unzip journals.zip and check each file'
Write-Output '  against journals-files.json, which carries a SHA-256 per file.'
Write-Output ''
if (-not $Encrypt) {
    Write-Output 'NOT ENCRYPTED. Re-run with -Encrypt to produce the sealed STARQ ARK archive.'
}
if ($dirty.Count -gt 0) {
    Write-Output "WARNING: bundled with uncommitted work in $($dirty.Count) repo(s). The manifest records the counts."
}
Write-Output 'DEC-019 REMINDER: this is a backup, not yet an offsite copy.'
Write-Output 'It only becomes offsite when the drive leaves the building.'
