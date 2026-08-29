#!/usr/bin/env python3
"""T-03 step 1 — local dated copy of journals/ to backups/ on D: only.

Copies D:\\StarqTech\\the foundation engine\\journals\\ to
D:\\StarqTech\\the foundation engine\\backups\\journals-YYYY-MM-DD\\
Never deletes the source tree. Never writes to C:.

Usage (from repo root on D:):
    python scripts/backup-journals.py
"""
from __future__ import annotations

import os
import shutil
import sys
from datetime import date

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, "journals")
DST_ROOT = os.path.join(HERE, "backups")
TAG = date.today().isoformat()
DST = os.path.join(DST_ROOT, f"journals-{TAG}")


def main() -> int:
    if not os.path.isdir(SRC):
        print(f"FAIL: no journals at {SRC}", file=sys.stderr)
        return 1
    if SRC.upper().startswith("C:"):
        print("FAIL: RULE 0 — journals source must not be on C:", file=sys.stderr)
        return 1
    if DST_ROOT.upper().startswith("C:"):
        print("FAIL: RULE 0 — backup destination must not be on C:", file=sys.stderr)
        return 1
    os.makedirs(DST_ROOT, exist_ok=True)
    if os.path.exists(DST):
        print(f"FAIL: backup already exists: {DST}", file=sys.stderr)
        return 1
    shutil.copytree(SRC, DST)
    n_files = sum(len(files) for _d, _dn, files in os.walk(DST))
    print(f"OK - copied journals/ -> {DST} ({n_files} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
