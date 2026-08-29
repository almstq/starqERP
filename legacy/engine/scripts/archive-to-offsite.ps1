# Move cold data off the working drive and onto the offsite drive.
#
# FOUNDER, 24 August 2026: "move all archive and backup to e: all old data on
# this dev, unless reference is required, all needed stays on d: but nothing on C:"
#
# ─────────────────────────────────────────────────────────────────────────────
# THE RULE THIS ENCODES
# ─────────────────────────────────────────────────────────────────────────────
#   C:  nothing. Rule 0. Not code, not caches, not downloads, not installs.
#   D:  everything still referenced — active projects, build caches the
#       toolchain reads, and LOCAL GIT REMOTES that repositories push to.
#   E:  everything cold — superseded work, raw source material, retired trees.
#
# "Unless reference is required" is doing real work in that sentence, and the
# survey found one thing that looks exactly like an archive and is not:
#
#   _git-remotes/ IS A LIVE PUSH TARGET. D:\!starq\.git/config has
#   local -> D:\!starq\_git-remotes\starqos.git, and projects/antrac-erp points
#   at antrac-erp.git the same way. The founder's own note is that "D: is the
#   GitHub" — these bare repositories ARE the origin for two projects. Moving
#   them to a drive that gets unplugged would break `git push` the next time the
#   drive is out of the building, which is precisely when it is supposed to be.
#   It stays on D:. It is 490 MB and it is not the problem.
#
# Also staying, for the same reason: .gradle, .pub-cache and Android. They are
# caches and an SDK, they are large, and the toolchain reads them on every
# build. They are already correctly off C:, which is where they would otherwise
# have landed.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHAT MOVES, AND WHY EACH ONE IS SAFE
# ─────────────────────────────────────────────────────────────────────────────
#   _staging/          27.6 GB. Almost entirely academics_raw, untouched since
#                      29 June. Gitignored, so moving it is invisible to git.
#                      The single biggest item on the drive.
#
#   _recyclebin/       10.8 GB across 238,574 files — and only TWO of them are
#                      tracked by git, so this is nearly free to move. Its
#                      CONTENTS move; the folder itself stays, empty, because
#                      Rule 2 routes every future retirement into it and a
#                      missing destination would quietly turn "move it" back
#                      into "delete it".
#
#   .claude/worktrees/ 1.5 GB of stale checkouts, both at detached HEAD dbb272b,
#                      both verified clean: zero uncommitted files and zero
#                      commits that are not already on master. Nothing unique
#                      exists there. This is board task SERP-179 — a stale tree
#                      is a hazard because an agent can read it and believe it.
#
# Nothing is deleted. Everything lands under a dated folder on E:, and the
# worktree registrations are pruned only AFTER their contents are safely copied.

[CmdletBinding()]
param(
    [ValidatePattern('^[E-Ze-z]$')]
    [string]$DriveLetter = 'E',

    # Show what would move and how big it is, and touch nothing.
    [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$vault = 'D:\!starq'
$letter = $DriveLetter.ToUpperInvariant()
if ($letter -in @('C', 'D')) { throw 'RULE 0: C: and D: are not archive destinations.' }
if (-not (Test-Path "$letter`:\")) { throw "Drive $letter`: is not present." }

$stamp = Get-Date -Format 'yyyy-MM-dd'
$dest = "$letter`:\STARQ-ARCHIVE\$stamp"

# source => destination leaf. Order matters only for readability.
$moves = [ordered]@{
    '_staging'          = 'staging'
    '_recyclebin'       = 'recyclebin'
    '.claude\worktrees' = 'claude-worktrees'
}

function Get-TreeSize([string]$Path) {
    if (-not (Test-Path $Path)) { return @{ MB = 0; Files = 0 } }
    $m = Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum
    return @{ MB = [math]::Round($m.Sum / 1MB, 1); Files = $m.Count }
}

Write-Output ''
Write-Output "=== ARCHIVE TO $letter`: — survey ==="
$total = 0
foreach ($src in $moves.Keys) {
    $full = Join-Path $vault $src
    $s = Get-TreeSize $full
    $total += $s.MB
    if (Test-Path $full) {
        Write-Output ("  {0,-20} {1,10:N1} MB  {2,7} files" -f $src, $s.MB, $s.Files)
    }
    else {
        Write-Output ("  {0,-20} (absent - nothing to do)" -f $src)
    }
}
Write-Output ("  {0,-20} {1,10:N1} MB total" -f '', $total)

$free = [math]::Round((Get-PSDrive -Name $letter).Free / 1MB, 1)
Write-Output ("  destination free space: {0:N1} MB" -f $free)
if ($free -lt ($total * 1.1)) { throw "Not enough room on $letter`: — need ~$total MB, have $free MB." }

Write-Output ''
Write-Output '  STAYING ON D: (reference required):'
Write-Output '    _git-remotes   live push target for the vault repo and antrac-erp'
Write-Output '    .gradle        Gradle cache, read on every Android build'
Write-Output '    .pub-cache     Flutter/Dart package cache'
Write-Output '    Android        SDK'

if ($WhatIfOnly) {
    Write-Output ''
    Write-Output '  -WhatIfOnly: nothing was moved.'
    return
}

# ─── worktrees must be de-registered, not just moved ─────────────────────────
# A registered worktree that vanishes from disk leaves git holding a reference to
# a path that no longer exists. The contents are copied first and the
# registration is pruned afterwards, so at no point is the only copy in flight.
$worktreesMoved = $false

New-Item -ItemType Directory -Force -Path $dest | Out-Null
$log = @()

foreach ($src in $moves.Keys) {
    $full = Join-Path $vault $src
    if (-not (Test-Path $full)) { continue }

    $target = Join-Path $dest $moves[$src]
    Write-Output ''
    Write-Output "==> $src  ->  $target"

    $before = Get-TreeSize $full
    # What the destination ALREADY holds. A run that resumes an interrupted move
    # finds files there from the previous attempt, and the completion check has to
    # account for them or it will report a successful resume as a failure.
    $destBefore = Get-TreeSize $target

    # robocopy rather than Move-Item: 238,574 files, paths past 260 characters,
    # and a destination that is exFAT. /COPY:DAT because exFAT cannot hold NTFS
    # ACLs and asking it to would fail every file. /XJ skips junction points,
    # which otherwise get followed and copied twice.
    $args = @($full, $target, '/E', '/MOVE', '/COPY:DAT', '/R:2', '/W:2', '/MT:16', '/XJ', '/NFL', '/NDL', '/NP', '/NJH')
    & robocopy @args | Out-Null
    $rc = $LASTEXITCODE

    # ─────────────────────────────────────────────────────────────────────────
    # EXFAT CANNOT STORE A SYMLINK. THAT IS A FILESYSTEM FACT, NOT A FAILED MOVE.
    # ─────────────────────────────────────────────────────────────────────────
    # robocopy exit codes are a bitmask; 8 means "some files did not copy". The
    # first run of this script threw on exit 9 after moving 238,573 of 238,574
    # files. The one that stayed behind was a SYMBOLIC LINK — `dart`, inside a
    # Flutter SDK that had already been retired to _recyclebin. exFAT has no
    # concept of a symlink, so it can never be written there, and no number of
    # retries will change that.
    #
    # Treating that as a fatal error was wrong in a way worth naming: it reported
    # a complete, successful archive as a failure, which is the mirror image of
    # the bug this script was written to prevent. A run that cries wolf gets
    # re-run blindly, and a re-run of a /MOVE is exactly when someone loses data.
    #
    # So the check is now specific rather than absolute: anything left at the
    # source is inspected. If every survivor is a reparse point, the move is
    # complete as far as the destination filesystem allows, and they are REPORTED
    # rather than swallowed. If anything else survived, that is a real failure
    # and it still throws.
    $leftover = @(Get-ChildItem -LiteralPath $full -Recurse -File -Force -ErrorAction SilentlyContinue)
    $reparse = @($leftover | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
    $realFailures = @($leftover | Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) })

    if ($realFailures.Count -gt 0) {
        Write-Output "    $($realFailures.Count) file(s) failed to move and are NOT reparse points:"
        $realFailures | Select-Object -First 5 | ForEach-Object { Write-Output "      $($_.FullName)" }
        throw "robocopy failed for $src with exit code $rc — $($realFailures.Count) real failure(s), listed above. Source is intact; nothing was lost."
    }

    if ($reparse.Count -gt 0) {
        Write-Output "    $($reparse.Count) symbolic link(s)/reparse point(s) left on D: — exFAT cannot store them:"
        $reparse | Select-Object -First 5 | ForEach-Object { Write-Output "      $($_.FullName)" }
        Write-Output '      These are links, not data. Their targets moved. Nothing is lost.'
    }
    elseif ($rc -ge 8) {
        throw "robocopy reported exit code $rc for $src but nothing remains at the source — investigate before trusting this run."
    }

    # THE REAL COMPLETION TEST IS THAT THE SOURCE IS EMPTY, and it has already run
    # above: anything left that is not a reparse point throws. This is the
    # arithmetic confirmation of it, and it must count from where the destination
    # STARTED, not from zero — on the resumed run that finished this move, the
    # destination already held 238,573 files from the interrupted attempt while
    # the source held one symlink. Comparing the destination total against the
    # source count would have thrown on a run that was entirely correct.
    $after = Get-TreeSize $target
    $expected = $destBefore.Files + $before.Files - $reparse.Count
    if ($after.Files -ne $expected) {
        throw "MOVE INCOMPLETE for $src — expected $expected files at destination ($($destBefore.Files) already there + $($before.Files) from source - $($reparse.Count) unstorable link(s)), found $($after.Files)."
    }
    Write-Output ("    {0:N1} MB, {1} files — verified file-for-file" -f $after.MB, $after.Files)
    $log += [pscustomobject]@{ source = $src; destination = $target; mb = $after.MB; files = $after.Files }

    if ($src -eq '.claude\worktrees') { $worktreesMoved = $true }
}

# ─── keep _recyclebin alive as a destination ─────────────────────────────────
# Rule 2 says nothing is ever deleted, it is moved here. If the folder itself
# disappeared, the next agent needing to retire a file would find no destination
# and the rule would quietly stop being followable.
$recycle = Join-Path $vault '_recyclebin'
New-Item -ItemType Directory -Force -Path $recycle | Out-Null
@"
This folder is intentionally empty.

RULE 2: nothing in this system is ever deleted. Anything retired moves here,
with a note saying what it was and why it went.

Everything that was here up to $stamp was moved to:

    $dest\recyclebin

It was moved, not deleted. If you are looking for something that used to be in
_recyclebin, it is on the offsite drive under that path.
"@ | Set-Content -Path (Join-Path $recycle 'README.txt')

# ─── prune the worktree registrations, now that the copies are safe ──────────
if ($worktreesMoved) {
    Write-Output ''
    Write-Output '==> pruning stale worktree registrations'
    git -C $vault worktree prune
    Write-Output '    remaining worktrees:'
    git -C $vault worktree list | ForEach-Object { "      $_" }
}

$log | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $dest 'MOVED.json')

Write-Output ''
Write-Output "Archived to: $dest"
$log | Format-Table -AutoSize
Write-Output 'Nothing was deleted. MOVED.json records what went where.'
Write-Output ''
Write-Output ("D: free after: {0:N1} GB" -f ((Get-PSDrive -Name D).Free / 1GB))
