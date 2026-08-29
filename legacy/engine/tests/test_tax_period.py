"""SERP-122 — specification by test: a tax rate is a period, never a constant.

STATUS: RED BY DESIGN. Not wired into the default suite yet.

DEC-033 freezes new features until the audit criticals are closed and proven, so this deliberately
changes no production code. It writes the control BEFORE the feature, which is the rule this
project earned the hard way on 22 August: an artefact counts only when something fails without it,
and a test that has never failed has not been shown to detect anything.

Run it directly:  python test_tax_period.py
It reports which acceptance criteria of SERP-122 are met. Today it should report failures. When
SERP-122 is implemented it goes green and gets wired into the suite.

--------------------------------------------------------------------------------
WHY THIS EXISTS
--------------------------------------------------------------------------------
Tourism GST was 16% and became 17% at 00:00 on 1 July 2025, under the seventh amendment to the GST
Act. A competitor is shipping a hard-coded 16%, which is a live compliance defect and is one of the
differentiators in the product strategy.

THE TRAP, and it is the whole point: fixing that by hard-coding 17% is the SAME defect pointing the
other way. Every credit note, amended return and prior-period correction touching a supply before
1 July 2025 must compute at 16% — from the same code, with no branch and no redeploy.

--------------------------------------------------------------------------------
WHAT IS ACTUALLY WRONG TODAY, verified 22 Aug 2026
--------------------------------------------------------------------------------
The rate is NOT hard-coded, which is better than the competitor. `journal_outbox.live_invoice_rate()`
reads `ops/masters/tax.json`. So the value is already data-driven.

But the data is a SNAPSHOT, not a HISTORY:

    {"as_of": "2026-08-19", "gst_status": "not_registered", "live_invoice_rate": 0,
     "codes": [{"id": "...", "rate": 0, "label": "..."}]}

`as_of` is the date the FILE was written, not the date the rate APPLIES FROM. Each code carries a
flat `rate` with no validity period, and `live_invoice_rate()` takes no arguments. The system can
answer "what is the rate now" and cannot answer "what was the rate on 30 June 2025".

THIS IS THE CHEAPEST POSSIBLE MOMENT TO FIX IT. `gst_status` is `not_registered` and the rate is 0,
so no GST has ever been posted. Fixing it now is a schema change to one small file. Fixing it after
the first GST invoice is a data migration across every document ever issued.

MIRA defines TIME OF SUPPLY as the earlier of invoice issue or payment received. That, not the
posting date and not today, is what selects the rate.
"""

import json
import os
from datetime import date
from decimal import Decimal

HERE = os.path.dirname(os.path.abspath(__file__))
TAX = os.path.join(HERE, "ops", "masters", "tax.json")

# The published Maldives tourism GST history this must be able to express.
TGST_BEFORE = Decimal("16")   # up to and including 2025-06-30
TGST_AFTER = Decimal("17")    # from 2025-07-01
CHANGE_DATE = date(2025, 7, 1)

results = []


def check(name, fn):
    try:
        fn()
        results.append((True, name, ""))
    except AssertionError as exc:
        results.append((False, name, str(exc)))
    except Exception as exc:  # noqa: BLE001 - a spec test reports, it does not raise
        results.append((False, name, f"{exc.__class__.__name__}: {exc}"))


def _tax():
    with open(TAX, encoding="utf-8") as f:
        return json.load(f)


# --- AC1: every rate carries a validity period -------------------------------
def ac1_rates_carry_validity():
    data = _tax()
    codes = data.get("codes") or []
    assert codes, "tax.json has no codes"
    missing = [c.get("id") for c in codes if "valid_from" not in c]
    assert not missing, (
        f"codes without valid_from: {missing}. A rate without a validity period cannot be "
        f"resolved historically. Note 'as_of' at the top level is when the FILE was written, "
        f"not when the rate applies from - it is not a substitute."
    )


# --- AC2: the resolver takes a date ------------------------------------------
def ac2_resolver_accepts_a_date():
    import inspect

    import journal_outbox

    fn = getattr(journal_outbox, "rate_on", None)
    assert fn is not None, (
        "no journal_outbox.rate_on(<date>, code) resolver exists. "
        "live_invoice_rate() takes no arguments, so it can only answer 'what is the rate now'."
    )
    params = inspect.signature(fn).parameters
    assert len(params) >= 1, "rate_on must accept a date"


# --- AC3: the same code resolves differently either side of the change --------
def ac3_same_code_two_periods():
    import journal_outbox

    fn = getattr(journal_outbox, "rate_on", None)
    assert fn is not None, "no rate_on resolver (see AC2)"
    before = fn(date(2025, 6, 30), "TGST")
    after = fn(CHANGE_DATE, "TGST")
    assert Decimal(str(before)) == TGST_BEFORE, f"2025-06-30 should be {TGST_BEFORE}, got {before}"
    assert Decimal(str(after)) == TGST_AFTER, f"2025-07-01 should be {TGST_AFTER}, got {after}"


# --- AC4: a credit note uses the ORIGINAL rate --------------------------------
def ac4_credit_note_uses_original_rate():
    import journal_outbox

    fn = getattr(journal_outbox, "rate_for_supply", None)
    assert fn is not None, (
        "no rate_for_supply(time_of_supply, code) - a credit note raised today against a "
        "June 2025 invoice must compute at 16%, not at today's rate. This is the failure that "
        "hard-coding 17% would cause, and it is silent."
    )
    assert Decimal(str(fn(date(2025, 6, 15), "TGST"))) == TGST_BEFORE


# --- AC5: no tax-rate literals in application code ----------------------------
def ac5_no_rate_literals_in_code():
    import re

    suspicious = []
    pattern = re.compile(r"(?:Decimal\(\s*[\"'](?:8|16|17)(?:\.0+)?[\"']\s*\)|\b(?:0\.08|0\.16|0\.17)\b)")
    skip_dirs = {".venv", ".git", "node_modules", ".claude", "__pycache__"}
    for root, dirs, files in os.walk(HERE):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fn in files:
            if not fn.endswith(".py") or fn.startswith("test_"):
                continue
            path = os.path.join(root, fn)
            try:
                with open(path, encoding="utf-8") as f:
                    for i, line in enumerate(f, 1):
                        if pattern.search(line):
                            suspicious.append(f"{os.path.relpath(path, HERE)}:{i}")
            except OSError:
                continue
    assert not suspicious, f"tax-rate literals found in application code: {suspicious}"


check("AC1  every rate carries valid_from", ac1_rates_carry_validity)
check("AC2  resolver accepts a date", ac2_resolver_accepts_a_date)
check("AC3  16% on 2025-06-30, 17% on 2025-07-01", ac3_same_code_two_periods)
check("AC4  credit note uses the original rate", ac4_credit_note_uses_original_rate)
check("AC5  no tax-rate literals in application code", ac5_no_rate_literals_in_code)

if __name__ == "__main__":
    print("SERP-122 - date-effective tax rates. Specification by test.")
    print("RED BY DESIGN until SERP-122 is implemented.\n")
    passed = 0
    for ok, name, why in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
        if not ok:
            print(f"         {why}")
        passed += ok
    print(f"\n  {passed}/{len(results)} acceptance criteria met.")
    print("  Not wired into the default suite. DEC-033's freeze is respected -")
    print("  no production code is changed by this file.")
