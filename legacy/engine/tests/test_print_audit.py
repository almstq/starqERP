#!/usr/bin/env python3
"""Printable PO/INV + master audit + job costing. Fixtures restore. Never journals/."""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import journal_outbox as J
import masters as M
import serve as S

AUDIT = os.path.join(HERE, "ops", "master_audit.jsonl")


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


def test_print_po_letterhead_tax0_draft():
    orig = J.load_events
    J._ISSUED_ROWS = []
    J.load_events = lambda: [{
        "id": "E-T-PRINT-PO",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "award",
            "amount": "250",
            "item": "thinner",
            "supplier": "existing-vendor",
        },
    }]
    try:
        payload, err = J.print_payload(
            event_id="E-T-PRINT-PO", kind="PO", occupancy="CI",
        )
        _assert(err is None, err)
        _assert(payload["watermark"] == "DRAFT", payload)
        _assert(payload["tax"] == "0", payload)
        _assert(payload["party"] == "existing-vendor", payload)
        _assert(payload["amount"] == "250.00", payload)
        _assert(payload["letterhead"]["legal_name"] == "Club Ignition Pvt Ltd", payload)
        _assert(payload["letterhead"]["registry_c"] == "C30222026", payload)
        _assert(payload["letterhead"]["gst_status"] == "not_registered", payload)
        _assert(payload["letterhead"]["tin"] == "", "must not invent TIN")
        html = S.h_document_print(payload)
        _assert("DRAFT" in html, html[:400])
        _assert('class="wm">DRAFT' in html, html)
        _assert("Club Ignition Pvt Ltd" in html, html)
        _assert("Tax: 0" in html, html)
        _assert("8%" not in html, html)
        _assert("GST-registered" not in html, html)
        _assert("127.0.0.1" in html, html)
        _assert("does not allocate" in html, html)
        _assert(J.preview_next("CI", "PO")["issued"] == 0, "print must not issue")
    finally:
        J.load_events = orig
        J._ISSUED_ROWS = None


def test_print_refuses_missing_amount_or_customer():
    orig = J.load_events
    J._ISSUED_ROWS = []
    J.load_events = lambda: [
        {
            "id": "E-T-PRINT-BARE",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "PURCHASE",
            "fields": {"scm_step": "award", "item": "thinner", "supplier": "existing-vendor"},
        },
        {
            "id": "E-T-PRINT-NOCUST",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "INVOICE_PAYMENT",
            "job_no": "JOB-2026-0003",
            "fields": {"amount": "700", "sku": "INK-PAINT"},
        },
        {
            "id": "E-T-PRINT-LEFT",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "PURCHASE",
            "fields": {
                "scm_step": "award", "amount": "1", "sku": "INK-PAINT-LEFT",
                "supplier": "x",
            },
        },
        {
            "id": "E-T-PRINT-INV-OK",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "INVOICE_PAYMENT",
            "job_no": "JOB-2026-0003",
            "fields": {"amount": "700", "sku": "INK-PAINT", "customer": "Walk-in"},
        },
    ]
    try:
        _p, err = J.print_payload(event_id="E-T-PRINT-BARE", kind="PO", occupancy="CI")
        _assert(err is not None and "Will not invent" in err, err)
        _p, err = J.print_payload(event_id="E-T-PRINT-NOCUST", kind="INV", occupancy="CI")
        _assert(err is not None and "Will not invent" in err, err)
        refuse = S.h_document_print_error(err)
        _assert("Print refused" in refuse, refuse)
        _assert("8%" not in refuse, refuse)
        _p, err = J.print_payload(event_id="E-T-PRINT-LEFT", kind="PO", occupancy="CI")
        _assert(err is not None and "leftover" in err.lower(), err)
        _p, err = J.print_payload(event_id="E-T-PRINT-INV-OK", kind="INV", occupancy="STARQ")
        _assert(err is not None and "Occupancy mismatch" in err, err)
        payload, err = J.print_payload(
            event_id="E-T-PRINT-INV-OK", kind="INV", occupancy="CI",
        )
        _assert(err is None, err)
        _assert(payload["party"] == "Walk-in", payload)
        _assert(payload["watermark"] == "DRAFT", payload)
        html = S.h_document_print(payload)
        _assert("Walk-in" in html, html)
        _assert("Club Ignition" in html, html)
        _assert("GST-registered" not in html, html)
    finally:
        J.load_events = orig
        J._ISSUED_ROWS = None


def test_print_issued_drops_draft_watermark():
    orig = J.load_events
    J._ISSUED_ROWS = [{
        "event_id": "E-T-PRINT-ISSUED",
        "kind": "INV",
        "occupancy": "STARQ",
        "number": "ST-INV-1",
        "contact_name": "Dynamics client",
        "contact_id": "ST-CT-1",
    }]
    J.load_events = lambda: [{
        "id": "E-T-PRINT-ISSUED",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "CLOSE",
        "fields": {"entity": "STARQ", "amount": "90", "sku": "ST-8211"},
    }]
    try:
        payload, err = J.print_payload(
            event_id="E-T-PRINT-ISSUED", kind="INV", occupancy="STARQ",
        )
        _assert(err is None, err)
        _assert(payload["issued"] is True, payload)
        _assert(payload["watermark"] == "", payload)
        _assert(payload["number"] == "ST-INV-1", payload)
        _assert(payload["party"] == "Dynamics client", payload)
        _assert(payload["letterhead"]["legal_name"] == "Starq Technologies Pvt Ltd", payload)
        html = S.h_document_print(payload)
        _assert('class="wm">' not in html, html)
        _assert("ST-INV-1" in html, html)
        _assert("Starq Technologies Pvt Ltd" in html, html)
        _assert("no shop POS" not in html.lower() or "Starq" in html, html)
        _assert("Club Ignition Pvt Ltd" not in html, "CI letterhead on Starq print")
        _assert("8%" not in html, html)
        _assert(J.preview_next("STARQ", "INV")["issued"] == 0, "print must not increment issued")
    finally:
        J.load_events = orig
        J._ISSUED_ROWS = None


def test_audit_occupancy_and_settings():
    prev = M._AUDIT_ROWS
    M._AUDIT_ROWS = []
    contacts = os.path.join(HERE, "ops", "masters", "contacts.json")
    raw = open(contacts, encoding="utf-8").read()
    try:
        _assert(M.load_audit("CI") == [], "no fake rows")
        row, err = M.create_contact(
            name="Audit Walk-in", kind="customer", occupancy="CI",
            seat="managing_director", person_id="nashid",
        )
        _assert(err is None, err)
        ci = M.load_audit("CI")
        _assert(len(ci) == 1, ci)
        _assert(ci[0]["action"] == "contact.create", ci[0])
        _assert(ci[0]["occupancy"] == "CI", ci[0])
        _assert(ci[0]["record_id"] == row["id"], ci[0])
        st = M.load_audit("STARQ")
        _assert(st == [], "CI create must not appear on Starq audit")
        html_ci = S.h_settings({}, "CI", "", "")
        _assert("Audit log" in html_ci, html_ci[html_ci.find("Audit"):html_ci.find("Audit")+400] if "Audit" in html_ci else html_ci[-400:])
        _assert("contact.create" in html_ci, "CI settings must show the row")
        _assert("Audit Walk-in" in html_ci, html_ci)
        html_st = S.h_settings({}, "STARQ", "", "")
        _assert("Audit log" in html_st, html_st[-500:])
        _assert("Audit Walk-in" not in html_st, "CI name on Starq audit")
        _assert("contact.create" not in html_st, html_st)
        existed = os.path.isfile(AUDIT)
        row, err = M.create_contact(
            name="   ", kind="customer", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "empty name")
        _assert(len(M.load_audit("CI")) == 1, "refuse must not append")
        if not existed and os.path.isfile(AUDIT):
            raise SystemExit("FAIL tests must not write master_audit.jsonl")
    finally:
        M._AUDIT_ROWS = prev
        open(contacts, "w", encoding="utf-8").write(raw)


def test_job_costing_real_amounts_only():
    orig = J.load_events
    J.load_events = lambda: [
        {
            "id": "E-T-JC-1",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "INVOICE_PAYMENT",
            "job_no": "JOB-2026-0099",
            "fields": {"amount": "500", "customer": "Real customer", "sku": "INK-PAINT"},
        },
        {
            "id": "E-T-JC-2",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "PURCHASE",
            "job_no": "JOB-2026-0099",
            "fields": {"scm_step": "award", "amount": "80", "item": "thinner", "supplier": "v"},
        },
        {
            "id": "E-T-JC-LEFT",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "INVOICE_PAYMENT",
            "job_no": "JOB-2026-LEFTOVER",
            "fields": {"amount": "9", "sku": "INK-PAINT-LEFT", "customer": "x"},
        },
        {
            "id": "E-T-JC-ST",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "CLOSE",
            "fields": {"entity": "STARQ", "amount": "90", "sku": "ST-8211", "job_no": "ST-JOB-1"},
        },
        {
            "id": "E-T-JC-NAKED",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "JOB_CARD",
            "job_no": "JOB-2026-NAKED",
            "fields": {"customer": "Name only"},
        },
    ]
    try:
        ci = J.job_costing("CI")
        ids = {r["job_no"] for r in ci}
        _assert("JOB-2026-0099" in ids, ci)
        _assert("JOB-2026-LEFTOVER" not in ids, ci)
        _assert("JOB-2026-NAKED" not in ids, "no amount must not invent a costing row")
        _assert("ST-JOB-1" not in ids, "Starq job on CI costing")
        row = next(r for r in ci if r["job_no"] == "JOB-2026-0099")
        _assert(str(row["revenue"]) == "500", row)
        _assert(str(row["materials"]) == "80", row)
        _assert(row["labour"] is None, "must not invent labour")
        _assert(str(row["profit"]) == "420", row)
        _assert(row["customer"] == "Real customer", row)
        st = J.job_costing("STARQ")
        _assert(all(r["job_no"] != "JOB-2026-0099" for r in st), st)
        _assert(any(r["job_no"] == "ST-JOB-1" for r in st), st)
        st_row = next(r for r in st if r["job_no"] == "ST-JOB-1")
        _assert(st_row["profit"] is None, "revenue without cost must not invent profit")
        html_ci = S.h_sales({}, "CI", "", "")
        _assert("Job costing" in html_ci, html_ci)
        _assert("JOB-2026-0099" in html_ci, html_ci)
        _assert("500.00" in html_ci, html_ci)
        _assert("JOB-2026-NAKED" not in html_ci, html_ci)
        html_st = S.h_sales({}, "STARQ", "", "")
        _assert("JOB-2026-0099" not in html_st, "CI job on Starq Sales")
        _assert("ST-JOB-1" in html_st, html_st)
        _assert("will not invent" in html_st.lower(), html_st)
    finally:
        J.load_events = orig


def test_live_empty_job_cost_and_audit_chrome():
    html = S.h_sales({}, "CI", "", "")
    _assert("Job costing" in html, html)
    if "JOB-2026-0099" in html:
        raise SystemExit("FAIL fixture job leaked onto live Sales")
    st = S.h_sales({}, "STARQ", "", "")
    _assert("Club Ignition garage jobs stay on CI" in st or "No Starq job amounts" in st, st)
    set_ci = S.h_settings({}, "CI", "", "")
    _assert("Audit log" in set_ci, set_ci)
    _assert("method=\"post\" action=\"/audit" not in set_ci, "audit must not be editable")


def main():
    journals = _journal_stamp()
    test_print_po_letterhead_tax0_draft()
    test_print_refuses_missing_amount_or_customer()
    test_print_issued_drops_draft_watermark()
    test_audit_occupancy_and_settings()
    test_job_costing_real_amounts_only()
    test_live_empty_job_cost_and_audit_chrome()
    _assert(_journal_stamp() == journals, "suite must not touch journals/")
    print("OK — printable PO/INV, master audit, job costing from real amounts, journals untouched")


if __name__ == "__main__":
    main()
