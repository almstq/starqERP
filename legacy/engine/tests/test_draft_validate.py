#!/usr/bin/env python3
"""Draft validate PASS/FAIL. Fixtures restore. Never writes journals/."""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import journal_outbox as J
import serve as S

EVENTS = os.path.join(HERE, "ops", "events.jsonl")


def _assert(cond, msg):
    if not cond:
        raise SystemExit(f"FAIL: {msg}")


def _journal_stamp():
    root = os.path.join(HERE, "journals")
    out = []
    for dirpath, _d, files in os.walk(root):
        for fn in files:
            if fn.endswith(".journal"):
                p = os.path.join(dirpath, fn)
                out.append((p, os.path.getmtime(p), os.path.getsize(p)))
    return out


def _ready(draft, occupancy="CI", etype="RECEIPT", event_id="E-T-VAL"):
    return J._finish({
        "event_id": event_id,
        "type": etype,
        "status": "draft",
        "reason": "test fixture",
        "draft": draft,
    }, occupancy, "6200", "2100")


def test_pass_known_balanced_tax0():
    p = J.propose_one({
        "id": "E-T-VAL-PASS",
        "ts": "2026-09-10T10:00:00+05:00",
        "type": "RECEIPT",
        "fields": {"item_id": "ci-kiev-rent", "amount": "42000", "vendor": "landlord"},
    })
    v = J.validate_draft(p)
    _assert(p.get("copy_ready") is True, p)
    _assert(v["verdict"] == "PASS", v)
    _assert(v["ok"] is True, v)
    _assert("4300" not in (v.get("accounts") or []), v)
    _assert(p["occupancy"] == "CI", p)


def test_fail_unknown_account():
    draft = (
        '2026-08-20 CI "bad account"\n'
        "  9999    10.00\n"
        "  2100   -10.00\n"
    )
    row = _ready(draft)
    v = J.validate_draft(row)
    _assert(v["verdict"] == "FAIL", v)
    _assert(any("9999" in f for f in v["fails"]), v)


def test_fail_debit_ne_credit():
    draft = (
        '2026-08-20 CI "unbalanced"\n'
        "  6200    10.00\n"
        "  2100    -9.00\n"
    )
    row = _ready(draft)
    v = J.validate_draft(row)
    _assert(v["verdict"] == "FAIL", v)
    _assert(any("debit!=credit" in f for f in v["fails"]), v)


def test_fail_occupancy_mismatch():
    draft = (
        '2026-08-20 STARQ "wrong occupancy"\n'
        "  6300    10.00\n"
        "  2100   -10.00\n"
    )
    row = _ready(draft, occupancy="CI")
    v = J.validate_draft(row)
    _assert(v["verdict"] == "FAIL", v)
    _assert(any("header STARQ" in f for f in v["fails"]), v)


def test_fail_4300_leftover():
    draft = (
        '2026-08-20 CI "leftover paint"\n'
        "  1200    10.00\n"
        "  4300   -10.00\n"
    )
    row = J._finish({
        "event_id": "E-T-4300-V",
        "type": "INVOICE_PAYMENT",
        "status": "draft",
        "reason": "fixture",
        "draft": draft,
    }, "CI", "1200", "4300")
    v = J.validate_draft(row)
    _assert(v["verdict"] == "FAIL", v)
    _assert(any("4300" in f for f in v["fails"]), v)


def test_fail_tax_8():
    draft = (
        '2026-08-20 CI "gst invented"\n'
        "  6200    10.00   # Tax: 8 (tax master). 8% GST.\n"
        "  2100   -10.00\n"
    )
    row = _ready(draft)
    v = J.validate_draft(row)
    _assert(v["verdict"] == "FAIL", v)
    _assert(any("tax must be 0" in f for f in v["fails"]), v)


def test_fail_starq_pos_sale():
    draft = (
        '2026-08-20 STARQ "shop sale"\n'
        "  1110    10.00\n"
        "  4100   -10.00\n"
    )
    row = J._finish({
        "event_id": "E-T-POS-ST",
        "type": "POS_SALE",
        "status": "draft",
        "reason": "fixture",
        "draft": draft,
    }, "STARQ", "1110", "4100")
    v = J.validate_draft(row)
    _assert(v["verdict"] == "FAIL", v)
    _assert(any("no POS" in f for f in v["fails"]), v)


def test_skip_not_copy_ready():
    v = J.validate_draft({"copy_ready": False, "occupancy": "CI", "type": "CALL"})
    _assert(v["verdict"] == "SKIP", v)


def test_fixture_restore_events_and_no_journal_write():
    raw = open(EVENTS, encoding="utf-8").read()
    journals = _journal_stamp()
    fixture = {
        "id": "E-TEST-VALIDATE-RESTORE",
        "ts": "2026-08-20T02:00:00+05:00",
        "type": "RECEIPT",
        "fields": {
            "entity": "CI",
            "item_id": "ci-kiev-rent",
            "amount": "42000",
            "vendor": "landlord",
        },
    }
    try:
        with open(EVENTS, "a", encoding="utf-8") as f:
            f.write(json.dumps(fixture, ensure_ascii=False) + "\n")
        rows = J.validate_copy_ready("CI")
        hit = [r for r in rows if r.get("event_id") == "E-TEST-VALIDATE-RESTORE"]
        _assert(hit, "fixture draft missing from validate_copy_ready")
        _assert(hit[0]["verdict"] == "PASS", hit[0])
        feed = J.occupancy_events("CI", limit=80)
        _assert(any(e.get("id") == "E-TEST-VALIDATE-RESTORE" for e in feed), feed[:3])
        st_feed = J.occupancy_events("STARQ", limit=80)
        _assert(not any(e.get("id") == "E-TEST-VALIDATE-RESTORE" for e in st_feed), st_feed)
        _assert(_journal_stamp() == journals, "validate must not touch journals/")
    finally:
        open(EVENTS, "w", encoding="utf-8").write(raw)
    _assert(open(EVENTS, encoding="utf-8").read() == raw, "events.jsonl must restore")
    _assert("E-TEST-VALIDATE-RESTORE" not in open(EVENTS, encoding="utf-8").read(), "fixture leaked")


def test_accounting_shows_pass_fail_and_txn_log():
    acc = S.h_accounting({}, "CI", "", "")
    _assert("Draft validate:" in acc, "Accounting must show draft validate summary")
    _assert("PASS" in acc or "copy-ready" in acc, acc[:500])
    _assert("4300 leftover blocked" in acc, "Accounting must name leftover 4300 rule")
    _assert("Starq no POS sale" in acc, "Accounting must name Starq POS rule")
    _assert("Transactions (ops events)" in acc or ('href="/transactions' in acc and "Ops" in acc),
            "Accounting must link to Ops feed")
    _assert("journals/" in acc, acc[:400])
    st = S.h_accounting({}, "STARQ", "", "")
    _assert("Starq occupancy" in st, "Starq Accounting occupancy")
    if "CALL" in st and "Pack smoke" in st:
        raise SystemExit("FAIL CI garage event on Starq Accounting")


def test_transactions_occupancy():
    ci = S.h_transactions({}, "CI", "", "")
    _assert("<h1>Ops</h1>" in ci, ci[:300])
    _assert("Transactions (ops events)" in ci or "transaction log until" in ci, ci[:300])
    _assert("transaction log until" in ci, ci[:400])
    _assert("Switch entity to see CI events" not in ci, "old STARQ hide-text leaked onto CI")
    st = S.h_transactions({}, "STARQ", "", "")
    _assert("Starq occupancy" in st, st[:300])
    _assert("Pack smoke" not in st, "CI pack smoke must not appear on Starq transactions")
    _assert("No Starq ops events" in st or "Starq events only" in st, st[:500])
    feed_st = J.occupancy_events("STARQ", limit=80)
    for ev in feed_st:
        _assert(ev.get("occupancy") == "STARQ", ev)


def test_settings_matrix_readonly():
    html = S.h_settings({}, "CI", "", "")
    _assert("Permissions matrix" in html, "Settings must show matrix")
    _assert("Read-only" in html or "read-only" in html, html[html.find("Permissions"):html.find("Permissions")+400])
    _assert("managing_director" in html, "matrix seats")
    _assert("CALL" in html, "matrix ops events")
    _assert("locations create" in html or "locations_create" in html, "matrix named actions")
    _assert("method=\"post\" action=\"/permissions" not in html, "must not edit permissions")
    mx = S.M.permission_matrix()
    _assert("technician" in mx["seats"], mx["seats"])
    _assert(mx["event_grid"]["technician"].get("CALL") is False, "tech cannot CALL")
    _assert(mx["event_grid"]["managing_director"].get("CALL") is True, "MD can CALL")
    _assert(mx["action_grid"]["technician"].get("locations_create") is False, "tech cannot create locations")
    _assert(mx["action_grid"]["director"].get("locations_create") is True, "director can create locations")
    _assert(mx["action_grid"]["ledger_poster"].get("books") is True, "poster has books")


def main():
    journals = _journal_stamp()
    test_pass_known_balanced_tax0()
    test_fail_unknown_account()
    test_fail_debit_ne_credit()
    test_fail_occupancy_mismatch()
    test_fail_4300_leftover()
    test_fail_tax_8()
    test_fail_starq_pos_sale()
    test_skip_not_copy_ready()
    test_fixture_restore_events_and_no_journal_write()
    test_accounting_shows_pass_fail_and_txn_log()
    test_transactions_occupancy()
    test_settings_matrix_readonly()
    _assert(_journal_stamp() == journals, "suite must not touch journals/")
    print("OK — draft validate PASS/FAIL, occupancy txn log, permissions matrix, journals untouched")


if __name__ == "__main__":
    main()
