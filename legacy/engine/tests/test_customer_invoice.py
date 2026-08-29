#!/usr/bin/env python3
"""Customer invoice capture + 4110/8211 BAR gate. Restores events.jsonl. Never journals/."""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import books as B
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


CONTACTS_CI = [
    {"id": "CI-CT-8", "entity": "CI", "kind": "customer", "name": "Walk-in"},
]
CONTACTS_ST = [
    {"id": "ST-CT-8", "entity": "STARQ", "kind": "customer", "name": "Named client"},
]
ORG_NO_8211 = [{
    "entity": "STARQ",
    "business_names": [
        {"bn": "BN62392026", "name": "Starq Dynamics", "bar": None, "isic": "8211",
         "income_accounts": ["4110"]},
    ],
    "company_bar": {"bp": "BP84562026", "isic": "6201", "income_accounts": ["4100"]},
}]


def test_prepare_uses_contact_else_ops_never_invents():
    journals = _journal_stamp()
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Walk-in", "income_account": "4200"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_CI, events=[],
    )
    _assert(err is None, err)
    _assert(packed["customer"] == "Walk-in", packed)
    _assert(packed["contact_id"] == "CI-CT-8", packed)
    _assert(packed["tax_rate"] == "0", packed)
    _assert(packed["income_account"] == "4200", packed)
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "already-on-ops", "income_account": "4200"},
        occupancy="CI", seat="director",
        contacts=[],
        events=[{
            "type": "CALL",
            "fields": {"entity": "CI", "customer": "already-on-ops"},
        }],
    )
    _assert(err is None, err)
    _assert(packed["customer"] == "already-on-ops", packed)
    _assert("contact_id" not in packed, packed)
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "brand-new", "income_account": "4200"},
        occupancy="CI", seat="director",
        contacts=[], events=[],
    )
    _assert(err is not None, "invented customer")
    _assert("invent" in (err or "").lower(), err)
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Walk-in", "income_account": "4200"},
        occupancy="CI", seat="technician",
        contacts=CONTACTS_CI, events=[],
    )
    _assert(err is not None, "tech typed amount")
    packed, err = J.prepare_customer_invoice(
        {"customer": "Walk-in", "income_account": "4200"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_CI, events=[],
    )
    _assert(err is not None, "missing amount")
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Walk-in", "tax_rate": "8", "income_account": "4200"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_CI, events=[],
    )
    _assert(err is not None, "8% GST")
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Walk-in", "sku": "INK-PAINT-LEFT", "income_account": "4200"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_CI, events=[],
    )
    _assert(err is not None, "leftover")
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Walk-in", "income_account": "4200"},
        occupancy="", seat="director",
        contacts=CONTACTS_CI, events=[],
    )
    _assert(err is not None, "group occupancy")
    _assert(_journal_stamp() == journals, "prepare must not write journals/")


def test_4110_gate_respects_disk_does_not_invent_clearance():
    journals = _journal_stamp()
    live = J.income_credit_gate("4110", "STARQ")
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Named client", "income_account": "4110"},
        occupancy="STARQ", seat="director",
        contacts=CONTACTS_ST, events=[],
    )
    if live:
        _assert(err is not None, "live 4110 gate on disk must refuse, not invent clearance")
        _assert("4110" in (err or "") or "8211" in (err or "") or "BAR" in (err or ""), err)
    else:
        _assert(err is None, err)
        _assert(packed["income_account"] == "4110", packed)
    blocked_coa = dict(B.load_accounts())
    blocked_coa["4110"] = dict(blocked_coa["4110"])
    blocked_coa["4110"]["status"] = "blocked"
    blocked_coa["4110"]["note"] = "do not credit 4110 before 8211 is on the BAR"
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Named client", "income_account": "4110"},
        occupancy="STARQ", seat="director",
        contacts=CONTACTS_ST, events=[],
        accounts=blocked_coa,
    )
    _assert(err is not None, "blocked CoA 4110")
    _assert("invent" in (err or "").lower() or "BLOCKED" in (err or "") or "BAR" in (err or ""), err)
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Named client", "income_account": "4110"},
        occupancy="STARQ", seat="director",
        contacts=CONTACTS_ST, events=[],
        orgs=ORG_NO_8211,
    )
    _assert(err is not None, "empty Dynamics BAR")
    packed, err = J.prepare_customer_invoice(
        {"amount": "90.00", "customer": "Named client", "income_account": "4100"},
        occupancy="STARQ", seat="director",
        contacts=CONTACTS_ST, events=[],
        orgs=ORG_NO_8211,
    )
    _assert(err is None, err)
    _assert(packed["income_account"] == "4100", packed)
    _assert(_journal_stamp() == journals, "4110 gate must not write journals/")


def test_invoice_draft_debits_ar_tax_zero_unissued():
    journals = _journal_stamp()
    p = J.propose_one({
        "id": "E-T-INV-AR",
        "ts": "2026-08-20T10:00:00+05:00",
        "type": "INVOICE",
        "fields": {
            "entity": "CI", "amount": "90.00", "customer": "Walk-in",
            "item": "paint", "tax_rate": "0", "income_account": "4200",
        },
    })
    _assert(p["status"] == "draft", p)
    _assert(p["occupancy"] == "CI", p)
    _assert(p["debit"] == "1200", p)
    _assert(p["credit"] == "4200", p)
    _assert("90.00" in p["draft"] or "90" in p["draft"], p["draft"])
    _assert("STARQ" not in p["draft"], p["draft"])
    _assert("8%" not in p["draft"], p["draft"])
    _assert(p.get("doc_kind") == "INV", p)
    _assert(p.get("doc_issued") is False, p)
    _assert(p.get("doc_unissued") is True, p)
    _assert(J.may_issue(p, "director", "CI") is True, p)
    seq = J._sequence("CI", "invoice")
    _assert(int(seq.get("issued") or 0) == 0, seq)
    st = J.propose_one({
        "id": "E-T-INV-ST",
        "ts": "2026-08-20T10:00:00+05:00",
        "type": "INVOICE",
        "fields": {
            "entity": "STARQ", "amount": "90.00", "customer": "Named client",
            "tax_rate": "0", "income_account": "4100",
        },
    })
    _assert(st["occupancy"] == "STARQ", st)
    _assert("STARQ" in st["draft"], st["draft"])
    _assert(st["debit"] == "1200", st)
    _assert(st["credit"] == "4100", st)
    _assert(st.get("doc_issued") is False, st)
    left = J.propose_one({
        "id": "E-T-INV-L",
        "type": "INVOICE",
        "fields": {
            "entity": "CI", "amount": "5", "customer": "Walk-in",
            "sku": "INK-PAINT-LEFT",
        },
    })
    _assert(left["status"] == "blocked", left)
    miss = J.propose_one({
        "id": "E-T-INV-NOAMT",
        "type": "INVOICE",
        "fields": {"entity": "CI", "customer": "Walk-in", "income_account": "4200"},
    })
    _assert(miss["status"] == "blocked", miss)
    orig = B.load_accounts
    try:
        def _blocked():
            acc = orig()
            acc["4110"] = dict(acc["4110"])
            acc["4110"]["status"] = "blocked"
            acc["4110"]["note"] = "do not credit 4110 before 8211 is on the BAR"
            return acc
        B.load_accounts = _blocked
        gated = J.propose_one({
            "id": "E-T-INV-4110B",
            "type": "INVOICE",
            "fields": {
                "entity": "STARQ", "amount": "90", "customer": "Named client",
                "income_account": "4110", "tax_rate": "0",
            },
        })
        _assert(gated["status"] == "blocked", gated)
        _assert("invent" in (gated.get("reason") or "").lower()
                or "BLOCKED" in (gated.get("reason") or "")
                or "BAR" in (gated.get("reason") or ""), gated)
        _assert(J.may_issue(gated, "director", "STARQ") is False, gated)
    finally:
        B.load_accounts = orig
    _assert(_journal_stamp() == journals, "propose INVOICE must not write journals/")


def test_fixture_restore_events_jsonl():
    raw = open(EVENTS, encoding="utf-8").read()
    journals = _journal_stamp()
    fixture = {
        "id": "E-T-INV-RESTORE",
        "ts": "2026-08-20T10:30:00+05:00",
        "type": "INVOICE",
        "fields": {
            "entity": "CI",
            "kind": "customer_invoice",
            "amount": "90.00",
            "customer": "ops-customer",
            "tax_rate": "0",
            "income_account": "4200",
        },
    }
    try:
        with open(EVENTS, "a", encoding="utf-8") as f:
            f.write(json.dumps(fixture, ensure_ascii=False) + "\n")
        hit = None
        for ev in J.load_events():
            if ev.get("id") == "E-T-INV-RESTORE":
                hit = ev
                break
        _assert(hit is not None, "fixture missing from events.jsonl")
        p = J.propose_one(hit)
        _assert(p["status"] == "draft", p)
        _assert(p["debit"] == "1200", p)
        _assert(p["copy_ready"] is True, p)
        _assert(p.get("doc_issued") is False, p)
        st_feed = J.occupancy_events("STARQ", limit=80)
        _assert(not any(e.get("id") == "E-T-INV-RESTORE" for e in st_feed), st_feed)
        _assert(_journal_stamp() == journals, "capture fixture must not touch journals/")
    finally:
        open(EVENTS, "w", encoding="utf-8").write(raw)
    _assert(open(EVENTS, encoding="utf-8").read() == raw, "events.jsonl must restore")
    _assert("E-T-INV-RESTORE" not in open(EVENTS, encoding="utf-8").read(), "fixture leaked")


def test_sales_chrome():
    sales = S.h_sales({}, "CI", "", "")
    _assert("Customer invoice" in sales, "Sales must show Customer invoice")
    _assert("will not invent a customer" in sales.lower(), sales[:800])
    _assert("Capture customer invoice" not in sales, "form must not show without a seat")
    _assert("Tax 0" in sales, sales[:800])
    _assert("Never 8% GST" in sales, sales[:800])
    _assert("Tax: 8" not in sales and "GST 8" not in sales, sales[:800])
    _assert("issued stays 0" in sales.lower() or "does not increment issued" in sales.lower(), sales[:900])
    st = S.h_sales({}, "STARQ", "", "")
    _assert("Customer invoice" in st, st[:600])
    _assert("No shop POS" in st, st[:600])
    _assert("Pack smoke" not in st, "CI leak")
    _assert("4110" in st, st[:800])
    pre = S.h_sales({}, "CI", "", "", None, None, "CI-CT-8")
    _assert('option value="CI-CT-8" selected' in pre, "contact shortcut should preselect customer")


if __name__ == "__main__":
    test_prepare_uses_contact_else_ops_never_invents()
    test_4110_gate_respects_disk_does_not_invent_clearance()
    test_invoice_draft_debits_ar_tax_zero_unissued()
    test_fixture_restore_events_jsonl()
    test_sales_chrome()
    print("OK — customer invoice AR 1200 draft, occupancy customer, events.jsonl restored, 4110 gate honest, journals untouched")
