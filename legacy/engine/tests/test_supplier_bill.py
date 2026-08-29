#!/usr/bin/env python3
"""Supplier bill capture + dashboard gates. Restores events.jsonl. Never journals/."""
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


CONTACTS_STO = [
    {"id": "CI-CT-9", "entity": "CI", "kind": "vendor", "name": "STO"},
]


def test_prepare_uses_contact_else_ops_never_invents():
    journals = _journal_stamp()
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "STO"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_STO, events=[],
    )
    _assert(err is None, err)
    _assert(packed["vendor"] == "STO", packed)
    _assert(packed["contact_id"] == "CI-CT-9", packed)
    _assert(packed["tax_rate"] == "0", packed)
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "already-on-ops"},
        occupancy="CI", seat="director",
        contacts=[],
        events=[{
            "type": "PURCHASE",
            "fields": {"entity": "CI", "supplier": "already-on-ops", "scm_step": "need"},
        }],
    )
    _assert(err is None, err)
    _assert(packed["vendor"] == "already-on-ops", packed)
    _assert("contact_id" not in packed, packed)
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "brand-new"},
        occupancy="CI", seat="director",
        contacts=[], events=[],
    )
    _assert(err is not None, "invented vendor")
    _assert("invent" in (err or "").lower(), err)
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "STO"},
        occupancy="CI", seat="technician",
        contacts=CONTACTS_STO, events=[],
    )
    _assert(err is not None, "tech typed amount")
    packed, err = J.prepare_supplier_bill(
        {"vendor": "STO"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_STO, events=[],
    )
    _assert(err is not None, "missing amount")
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "STO", "tax_rate": "8"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_STO, events=[],
    )
    _assert(err is not None, "8% GST")
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "STO", "sku": "INK-PAINT-LEFT"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_STO, events=[],
    )
    _assert(err is not None, "leftover")
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "STO", "po_number": "CI-PO-99"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_STO, events=[], issued=[],
    )
    _assert(err is not None, "unissued PO")
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "STO", "po_event_id": "E-T-PO-ISS"},
        occupancy="CI", seat="director",
        contacts=CONTACTS_STO, events=[],
        issued=[{
            "kind": "PO", "occupancy": "CI", "event_id": "E-T-PO-ISS",
            "number": "CI-PO-1", "amount": "12.50",
        }],
    )
    _assert(err is None, err)
    _assert(packed["po_number"] == "CI-PO-1", packed)
    packed, err = J.prepare_supplier_bill(
        {"amount": "12.50", "vendor": "STO"},
        occupancy="", seat="director",
        contacts=CONTACTS_STO, events=[],
    )
    _assert(err is not None, "group occupancy")
    _assert(_journal_stamp() == journals, "prepare must not write journals/")


def test_bill_draft_credits_ap_tax_zero():
    journals = _journal_stamp()
    p = J.propose_one({
        "id": "E-T-BILL-AP",
        "ts": "2026-08-20T09:00:00+05:00",
        "type": "BILL",
        "fields": {
            "entity": "CI", "amount": "12.50", "vendor": "STO",
            "item": "thinner", "tax_rate": "0",
        },
    })
    _assert(p["status"] == "draft", p)
    _assert(p["occupancy"] == "CI", p)
    _assert("2100" in p["draft"], p["draft"])
    _assert("12.50" in p["draft"] or "12.50" in p["draft"].replace(",", ""), p["draft"])
    _assert("STARQ" not in p["draft"], p["draft"])
    _assert("8%" not in p["draft"], p["draft"])
    st = J.propose_one({
        "id": "E-T-BILL-ST",
        "ts": "2026-08-20T09:00:00+05:00",
        "type": "BILL",
        "fields": {
            "entity": "STARQ", "amount": "12.50", "vendor": "STO",
            "tax_rate": "0",
        },
    })
    _assert(st["occupancy"] == "STARQ", st)
    _assert("STARQ" in st["draft"], st["draft"])
    _assert("2100" in st["draft"], st["draft"])
    left = J.propose_one({
        "id": "E-T-BILL-L",
        "type": "BILL",
        "fields": {
            "entity": "CI", "amount": "5", "vendor": "STO",
            "sku": "INK-PAINT-LEFT",
        },
    })
    _assert(left["status"] == "blocked", left)
    miss = J.propose_one({
        "id": "E-T-BILL-NOAMT",
        "type": "BILL",
        "fields": {"entity": "CI", "vendor": "STO"},
    })
    _assert(miss["status"] == "blocked", miss)
    _assert(_journal_stamp() == journals, "propose BILL must not write journals/")


def test_fixture_restore_events_jsonl():
    raw = open(EVENTS, encoding="utf-8").read()
    journals = _journal_stamp()
    fixture = {
        "id": "E-T-BILL-RESTORE",
        "ts": "2026-08-20T09:30:00+05:00",
        "type": "BILL",
        "fields": {
            "entity": "CI",
            "kind": "supplier_bill",
            "amount": "12.50",
            "vendor": "ops-vendor",
            "supplier": "ops-vendor",
            "tax_rate": "0",
        },
    }
    try:
        with open(EVENTS, "a", encoding="utf-8") as f:
            f.write(json.dumps(fixture, ensure_ascii=False) + "\n")
        hit = None
        for ev in J.load_events():
            if ev.get("id") == "E-T-BILL-RESTORE":
                hit = ev
                break
        _assert(hit is not None, "fixture missing from events.jsonl")
        p = J.propose_one(hit)
        _assert(p["status"] == "draft", p)
        _assert(p["credit"] == "2100", p)
        _assert(p["copy_ready"] is True, p)
        st_feed = J.occupancy_events("STARQ", limit=80)
        _assert(not any(e.get("id") == "E-T-BILL-RESTORE" for e in st_feed), st_feed)
        _assert(_journal_stamp() == journals, "capture fixture must not touch journals/")
    finally:
        open(EVENTS, "w", encoding="utf-8").write(raw)
    _assert(open(EVENTS, encoding="utf-8").read() == raw, "events.jsonl must restore")
    _assert("E-T-BILL-RESTORE" not in open(EVENTS, encoding="utf-8").read(), "fixture leaked")


def test_dashboard_gates_honest():
    journals = _journal_stamp()
    ci = J.draft_gates("CI")
    _assert(ci["progress_pct"] is None, ci)
    codes = {i["code"] for i in ci["items"]}
    _assert("need-issue" in codes, ci)
    _assert("need-price" in codes, ci)
    _assert("need-count" in codes, ci)
    _assert("dec-008-copy" in codes, ci)
    _assert("issued=0" in (ci["reason"] + "".join(i.get("note") or "" for i in ci["items"])), ci)
    st = J.draft_gates("STARQ")
    _assert(st["progress_pct"] is None, st)
    price = next(i for i in st["items"] if i["code"] == "need-price")
    _assert(price["blocking"] is False, price)
    _assert("no shop POS" in price["note"], price)
    grp = J.draft_gates("")
    _assert(not grp["items"], grp)
    html = S._draft_gates_panel("CI")
    _assert("Next draft" in html, html[:400])
    _assert("need issue" in html, html)
    _assert("progress_pct" not in html, html)
    _assert("% complete" not in html.lower(), html)
    html_st = S._draft_gates_panel("STARQ")
    _assert("Club Ignition till/cage stay on CI" in html_st, html_st[:500])
    _assert(_journal_stamp() == journals, "gates must not write journals/")


def test_expenses_chrome():
    exp = S.h_expenses({}, "CI", "", "")
    _assert("Supplier bill" in exp, "Expenses must show Supplier bill")
    _assert("will not invent a vendor" in exp.lower(), exp[:800])
    _assert("Capture supplier bill" not in exp, "form must not show without a seat")
    _assert("Tax 0" in exp, exp[:800])
    _assert("8%" not in exp, exp)
    st = S.h_expenses({}, "STARQ", "", "")
    _assert("Starq occupancy" in st or "Starq vendors" in st, st[:600])
    _assert("Pack smoke" not in st, "CI leak")
    pre = S.h_expenses({}, "CI", "", "", None, None, "CI-CT-9")
    _assert('option value="CI-CT-9" selected' in pre, "contact shortcut should preselect vendor")


if __name__ == "__main__":
    test_prepare_uses_contact_else_ops_never_invents()
    test_bill_draft_credits_ap_tax_zero()
    test_fixture_restore_events_jsonl()
    test_dashboard_gates_honest()
    test_expenses_chrome()
    print("OK — supplier bill AP draft, occupancy vendor, events.jsonl restored, honest gates, journals untouched")
