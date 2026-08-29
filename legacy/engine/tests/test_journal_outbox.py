#!/usr/bin/env python3
"""Journal outbox drafts. Never writes journals/."""
from __future__ import annotations

import os
import sys
from datetime import date
from decimal import Decimal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import journal_outbox as J


def _assert(cond, msg):
    if not cond:
        raise SystemExit(f"FAIL: {msg}")


def test_home_receipt_uses_vendor_and_catalog_id():
    p = J.propose_one({
        "id": "E-T-VENDOR",
        "ts": "2026-09-10T10:00:00+05:00",
        "type": "RECEIPT",
        "fields": {"item_id": "ci-kiev-rent", "amount": "42000", "vendor": "landlord"},
    })
    _assert(p["status"] == "draft", p)
    _assert("6200" in p["draft"], p["draft"])
    _assert("landlord" in p["draft"], p["draft"])
    p = J.propose_one({
        "id": "E-T-RENT",
        "ts": "2026-09-10T10:00:00+05:00",
        "type": "RECEIPT",
        "fields": {"kind": "rent", "amount": "42000", "item": "H. Kiev", "supplier": "landlord"},
    })
    _assert(p["status"] == "draft", p)
    _assert("6200    42,000.00" in p["draft"], p["draft"])
    _assert("2100   -42,000.00" in p["draft"], p["draft"])
    _assert("journals/" not in p["draft"], p["draft"])


def test_purchase_still_5100_not_1300():
    p = J.propose_one({
        "id": "E-T-BUY",
        "ts": "2026-08-19T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {"amount": "100", "item": "thinner"},
    })
    _assert(p["status"] == "draft", p)
    lines = [ln for ln in p["draft"].splitlines() if ln.startswith("  ")]
    _assert(any(ln.strip().startswith("5100") for ln in lines), p["draft"])
    _assert(not any(ln.strip().startswith("1300") for ln in lines), p["draft"])


def test_purchase_counted_sku_with_cost_debits_1300():
    orig = J._inventory_lines
    J._inventory_lines = lambda: [{
        "sku": "INK-CAGE",
        "product_id": "sku-cage-stock",
        "qty_status": "counted",
        "qty": 4,
        "unit_cost": 10,
    }]
    try:
        p = J.propose_one({
            "id": "E-T-CAGE",
            "ts": "2026-08-19T12:00:00+05:00",
            "type": "PURCHASE",
            "fields": {"amount": "80", "item": "thinner", "sku": "INK-CAGE"},
        })
        _assert(p["status"] == "draft", p)
        lines = [ln for ln in p["draft"].splitlines() if ln.startswith("  ")]
        _assert(any(ln.strip().startswith("1300") for ln in lines), p["draft"])
        _assert(not any(ln.strip().startswith("5100") for ln in lines), p["draft"])
        _assert("1300    80.00" in p["draft"], p["draft"])
        _assert("40.00" not in p["draft"], p["draft"])
        p2 = J.propose_one({
            "id": "E-T-CAGE-R",
            "ts": "2026-08-19T12:00:00+05:00",
            "type": "RECEIPT",
            "fields": {"kind": "parts", "amount": "80", "sku": "INK-CAGE", "item": "thinner"},
        })
        _assert(p2["status"] == "draft", p2)
        _assert("1300    80.00" in p2["draft"], p2["draft"])
    finally:
        J._inventory_lines = orig


def test_purchase_counted_without_cost_stays_5100():
    orig = J._inventory_lines
    J._inventory_lines = lambda: [{
        "sku": "INK-CAGE",
        "product_id": "sku-cage-stock",
        "qty_status": "counted",
        "qty": 4,
    }]
    try:
        p = J.propose_one({
            "id": "E-T-NOCOST",
            "ts": "2026-08-19T12:00:00+05:00",
            "type": "PURCHASE",
            "fields": {"amount": "80", "sku": "INK-CAGE"},
        })
        _assert(p["status"] == "draft", p)
        lines = [ln for ln in p["draft"].splitlines() if ln.startswith("  ")]
        _assert(any(ln.strip().startswith("5100") for ln in lines), p["draft"])
        _assert(not any(ln.strip().startswith("1300") for ln in lines), p["draft"])
    finally:
        J._inventory_lines = orig


def test_purchase_leftover_blocked():
    orig = J._inventory_lines
    J._inventory_lines = lambda: [{
        "sku": "INK-PAINT-LEFT",
        "product_id": "sku-leftover-paint",
        "qty_status": "counted",
        "qty": 3,
        "unit_cost": 10,
    }]
    try:
        p = J.propose_one({
            "id": "E-T-LEFT",
            "ts": "2026-08-19T12:00:00+05:00",
            "type": "PURCHASE",
            "fields": {"amount": "30", "sku": "INK-PAINT-LEFT"},
        })
        _assert(p["status"] == "blocked", p)
        _assert(not p.get("draft"), p)
    finally:
        J._inventory_lines = orig


def test_4300_blocked():
    p = J.propose_one({
        "id": "E-T-4300",
        "type": "INVOICE_PAYMENT",
        "fields": {"amount": "1", "income_account": "4300"},
    })
    _assert(p["status"] == "blocked", p)
    _assert(not p.get("draft"), p)


def test_call_is_no_gl():
    p = J.propose_one({"id": "E-T-CALL", "type": "CALL", "fields": {}})
    _assert(p["status"] == "no_gl", p)


def test_missing_amount_blocked():
    p = J.propose_one({"id": "E-T-R", "type": "RECEIPT", "fields": {"kind": "water"}})
    _assert(p["status"] == "blocked", p)


def test_does_not_write_journals():
    before = []
    root = os.path.join(HERE, "journals")
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if fn.endswith(".journal"):
                path = os.path.join(dirpath, fn)
                before.append((path, os.path.getmtime(path), os.path.getsize(path)))
    J.propose_one({
        "id": "E-T-WRITE",
        "ts": "2026-08-19T12:00:00+05:00",
        "type": "RECEIPT",
        "fields": {"kind": "parts", "amount": Decimal("50"), "item": "filter"},
    })
    after = []
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if fn.endswith(".journal"):
                path = os.path.join(dirpath, fn)
                after.append((path, os.path.getmtime(path), os.path.getsize(path)))
    _assert(before == after, "outbox must not touch journals/")


def test_close_starq_4110_not_garage():
    p = J.propose_one({
        "id": "E-T-ST-CLOSE",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "CLOSE",
        "job_no": "JOB-ST-1",
        "fields": {"entity": "STARQ", "amount": "500", "sku": "ST-8211"},
    })
    _assert(p["status"] == "draft", p)
    _assert(p["occupancy"] == "STARQ", p)
    _assert(p["accounts_s"] == "1200 4110", p)
    _assert(" STARQ " in p["draft"].split("\n")[0], p["draft"])
    _assert("4200" not in p["draft"], p["draft"])
    _assert("4300" not in p["draft"], p["draft"])
    _assert("8%" not in p["draft"], p["draft"])
    _assert("2200" not in p["draft"], p["draft"])
    _assert("journals/" not in p["draft"], p["draft"])
    p2 = J.propose_one({
        "id": "E-T-ST-4100",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "FIN_RECEIVABLE",
        "fields": {"entity": "STARQ", "amount": "80", "income_account": "4100"},
    })
    _assert(p2["accounts_s"] == "1200 4100", p2)


def test_close_ci_station_and_sku():
    p = J.propose_one({
        "id": "E-T-CI-WRAP",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "INVOICE_PAYMENT",
        "job_no": "JOB-2026-0001",
        "fields": {"amount": "1200", "sku": "INK-WRAP"},
    })
    _assert(p["status"] == "draft", p)
    _assert(p["occupancy"] == "CI", p)
    _assert(p["accounts_s"] == "1200 4220", p)
    _assert("8%" not in p["draft"], p["draft"])
    p2 = J.propose_one({
        "id": "E-T-CI-CASH",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "INVOICE_PAYMENT",
        "fields": {"amount": "100", "tender": "cash", "station": "booth"},
    })
    _assert(p2["accounts_s"] == "1200 4200", p2)
    _assert("1110" not in p2["draft"], p2["draft"])
    p3 = J.propose_one({
        "id": "E-T-CI-STARQ-ACCT",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "CLOSE",
        "fields": {"amount": "10", "income_account": "4110"},
    })
    _assert(p3["status"] == "blocked", p3)
    _assert(not p3.get("draft"), p3)


def test_authorisation_wip_2500():
    p = J.propose_one({
        "id": "E-T-DEP",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "AUTHORISATION",
        "job_no": "JOB-2026-0002",
        "fields": {"amount": "600", "tender": "cash"},
    })
    _assert(p["status"] == "draft", p)
    _assert(p["accounts_s"] == "1110 2500", p)
    _assert("2500" in p["draft"], p["draft"])
    _assert("8%" not in p["draft"], p["draft"])
    empty = J.propose_one({
        "id": "E-T-DEP0",
        "type": "AUTHORISATION",
        "fields": {},
    })
    _assert(empty["status"] == "no_gl", empty)


def test_close_qty_times_rate_not_invented():
    p = J.propose_one({
        "id": "E-T-RATE",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "CLOSE",
        "fields": {"entity": "STARQ", "qty": "2", "rate": "150"},
    })
    _assert(p["status"] == "draft", p)
    _assert("300.00" in p["draft"], p["draft"])
    _assert("4110" in p["draft"], p["draft"])
    missing = J.propose_one({
        "id": "E-T-RATE-ONLY",
        "type": "CLOSE",
        "fields": {"entity": "STARQ", "rate": "150"},
    })
    _assert(missing["status"] == "blocked", missing)


def test_close_uses_estimate_on_job():
    orig = J.load_events
    J.load_events = lambda: [{
        "id": "E-EST",
        "type": "ESTIMATE",
        "job_no": "JOB-2026-0009",
        "fields": {"amount": "900"},
    }]
    try:
        p = J.propose_one({
            "id": "E-CL",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "CLOSE",
            "job_no": "JOB-2026-0009",
            "fields": {},
        })
        _assert(p["status"] == "draft", p)
        _assert("900.00" in p["draft"], p["draft"])
        _assert("4200" in p["draft"], p["draft"])
        _assert("8%" not in p["draft"], p["draft"])
        J.load_events = lambda: [
            {
                "id": "E-EST",
                "type": "ESTIMATE",
                "job_no": "JOB-2026-0010",
                "fields": {"amount": "900"},
            },
            {
                "id": "E-INV",
                "type": "INVOICE_PAYMENT",
                "job_no": "JOB-2026-0010",
                "fields": {"amount": "900"},
            },
        ]
        p2 = J.propose_one({
            "id": "E-CL2",
            "type": "CLOSE",
            "job_no": "JOB-2026-0010",
            "fields": {},
        })
        _assert(p2["status"] == "no_gl", p2)
    finally:
        J.load_events = orig


def test_occupancy_starq_vs_ci():
    p = J.propose_one({
        "id": "E-T-ST",
        "ts": "2026-08-20T10:00:00+05:00",
        "type": "RECEIPT",
        "fields": {"entity": "STARQ", "kind": "fee", "amount": "10", "item": "MED fee"},
    })
    _assert(p["occupancy"] == "STARQ", p)
    _assert(p["copy_ready"] is True, p)
    _assert(p["accounts_s"] == "6300 2100", p)
    _assert("journals/starq/" in p["copy_into"], p)
    _assert(" STARQ " in p["draft"], p["draft"])
    _assert(" CI " not in p["draft"].split("\n")[0], p["draft"])
    p2 = J.propose_one({
        "id": "E-T-CI",
        "ts": "2026-09-10T10:00:00+05:00",
        "type": "RECEIPT",
        "fields": {"item_id": "ci-kiev-rent", "amount": "42000"},
    })
    _assert(p2["occupancy"] == "CI", p2)
    _assert(" CI " in p2["draft"].split("\n")[0], p2["draft"])
    _assert(p2["copy_into"] == "journals/club-ignition/", p2)


def test_award_unissued_po_document():
    org = os.path.join(HERE, "ops", "masters", "organizations.json")
    before = open(org, encoding="utf-8").read()
    p = J.propose_one({
        "id": "E-T-AWARD",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "award",
            "amount": "250",
            "item": "thinner",
            "supplier": "existing-vendor",
        },
    })
    _assert(p["status"] == "draft", p)
    _assert("5100" in p["draft"], p["draft"])
    doc = p.get("document") or ""
    _assert("UNISSUED PO" in doc, doc)
    _assert("CI-PO-" in doc, doc)
    _assert("issued=0" in doc, doc)
    _assert("existing-vendor" in doc, doc)
    _assert("8%" not in doc, doc)
    _assert("Tax: 0" in doc, doc)
    _assert("not allocated" in doc, doc)
    after = open(org, encoding="utf-8").read()
    _assert(before == after, "must not increment issued")
    need = J.propose_one({
        "id": "E-T-NEED",
        "type": "PURCHASE",
        "fields": {"scm_step": "need", "item": "thinner"},
    })
    _assert(need["status"] == "draft", need)
    _assert(need.get("doc_kind") == "PR", need)
    _assert("DRAFT PR" in (need.get("document") or ""), need)
    _assert("not on event — will not invent" in (need.get("document") or ""), need)
    _assert(not need.get("copy_ready"), "PR has no GL draft")
    quote = J.propose_one({
        "id": "E-T-QUOTE",
        "type": "PURCHASE",
        "fields": {"scm_step": "quote", "item": "thinner", "supplier": "known-vendor"},
    })
    _assert(quote["status"] == "draft", quote)
    _assert(quote.get("doc_kind") == "RFQ", quote)
    _assert("known-vendor" in (quote.get("document") or ""), quote)
    _assert("DRAFT RFQ" in (quote.get("document") or ""), quote)
    quote_blank = J.propose_one({
        "id": "E-T-QUOTE-BLANK",
        "type": "PURCHASE",
        "fields": {"scm_step": "quote", "item": "thinner"},
    })
    _assert("Supplier: not on event" in (quote_blank.get("document") or ""), quote_blank)
    left = J.propose_one({
        "id": "E-T-AWARD-LEFT",
        "type": "PURCHASE",
        "fields": {"scm_step": "award", "amount": "1", "sku": "INK-PAINT-LEFT"},
    })
    _assert(left["status"] == "blocked", left)
    _assert(not left.get("document"), left)


def test_procurement_chain_drafts():
    need = {
        "id": "E-T-CHAIN-NEED",
        "ts": "2026-08-20T10:00:00+05:00",
        "type": "PURCHASE",
        "fields": {"scm_step": "need", "item": "thinner", "scm_ref": "CHAIN-1"},
    }
    quote = {
        "id": "E-T-CHAIN-QUOTE",
        "ts": "2026-08-20T11:00:00+05:00",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "quote",
            "item": "thinner",
            "supplier": "known-vendor",
            "scm_ref": "CHAIN-1",
            "need_event_id": "E-T-CHAIN-NEED",
        },
    }
    award = {
        "id": "E-T-CHAIN-AWARD",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "award",
            "amount": "250",
            "item": "thinner",
            "supplier": "known-vendor",
            "scm_ref": "CHAIN-1",
            "need_event_id": "E-T-CHAIN-NEED",
            "quote_event_id": "E-T-CHAIN-QUOTE",
        },
    }
    orig = J.load_events
    J.load_events = lambda: [need, quote, award]
    try:
        chain = J.resolve_procurement_chain(award, "CI")
        _assert(chain.get("need", {}).get("id") == "E-T-CHAIN-NEED", chain)
        _assert(chain.get("quote", {}).get("id") == "E-T-CHAIN-QUOTE", chain)
        po = J.propose_one(award)
        doc = po.get("document") or ""
        _assert("UNISSUED PO" in doc, doc)
        _assert("procurement chain" in doc, doc)
        _assert("E-T-CHAIN-NEED" in doc, doc)
        _assert("E-T-CHAIN-QUOTE" in doc, doc)
        _assert("issued=0" in doc, doc)
        chains = J.procurement_chains("CI")
        _assert(len(chains) == 1, chains)
        _assert(chains[0]["award_proposal"].get("doc_kind") == "PO", chains[0])
    finally:
        J.load_events = orig


def test_valued_close_unissued_invoice_document():
    p = J.propose_one({
        "id": "E-T-INVDOC",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "INVOICE_PAYMENT",
        "job_no": "JOB-2026-0003",
        "fields": {"amount": "700", "sku": "INK-PAINT"},
    })
    doc = p.get("document") or ""
    _assert(p["status"] == "draft", p)
    _assert("UNISSUED INV" in doc, doc)
    _assert("CI-INV-" in doc, doc)
    _assert("issued=0" in doc, doc)
    _assert("8%" not in doc, doc)
    _assert("Tax: 0" in doc, doc)
    _assert("Customer: not on event" in doc, doc)
    gst8 = J.propose_one({
        "id": "E-T-GST8",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "INVOICE_PAYMENT",
        "job_no": "JOB-2026-0003",
        "fields": {"amount": "700", "sku": "INK-PAINT", "tax_rate": "8"},
    })
    _assert(gst8["status"] == "blocked", gst8)
    _assert(not gst8.get("draft"), gst8)
    _assert("Posted tax refused" in (gst8.get("reason") or ""), gst8)
    zero = J.propose_one({
        "id": "E-T-GST0",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "INVOICE_PAYMENT",
        "job_no": "JOB-2026-0003",
        "fields": {"amount": "700", "sku": "INK-PAINT", "tax_rate": "0"},
    })
    _assert(zero["status"] == "draft", zero)
    _assert("Tax: 0" in (zero.get("document") or ""), zero)
    st = J.propose_one({
        "id": "E-T-ST-INV",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "CLOSE",
        "fields": {"entity": "STARQ", "amount": "90", "sku": "ST-8211"},
    })
    sdoc = st.get("document") or ""
    _assert("ST-INV-" in sdoc, sdoc)
    _assert("not shop POS" in sdoc, sdoc)
    _assert("4110" in st["draft"], st["draft"])


def _journal_stamp():
    root = os.path.join(HERE, "journals")
    out = []
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if fn.endswith(".journal"):
                path = os.path.join(dirpath, fn)
                out.append((path, os.path.getmtime(path), os.path.getsize(path)))
    return out


def test_issue_engine_occupancy_and_seats():
    import json
    org = os.path.join(HERE, "ops", "masters", "organizations.json")
    before = open(org, encoding="utf-8").read()
    journals = _journal_stamp()
    orig_load = J.load_events
    J._ISSUED_ROWS = []
    po_ev = {
        "id": "E-T-ISSUE-PO",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "award",
            "amount": "250",
            "item": "thinner",
            "supplier": "existing-vendor",
        },
    }
    inv_ev = {
        "id": "E-T-ISSUE-INV",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "CLOSE",
        "fields": {"entity": "STARQ", "amount": "90", "sku": "ST-8211"},
    }
    left_ev = {
        "id": "E-T-ISSUE-LEFT",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {"scm_step": "award", "amount": "1", "sku": "INK-PAINT-LEFT"},
    }
    bare_ev = {
        "id": "E-T-ISSUE-BARE",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {"scm_step": "award", "item": "thinner"},
    }
    J.load_events = lambda: [po_ev, inv_ev, left_ev, bare_ev]
    try:
        preview = J.preview_next("CI", "PO")
        _assert(preview["shown"] == "CI-PO-1", preview)
        _assert(preview["issued"] == 0, preview)
        rec, err = J.issue_document(
            event_id="E-T-ISSUE-PO", kind="PO", occupancy="CI",
            seat="technician", person_id="nashid",
        )
        _assert(err is not None, "tech must not issue PO")
        rec, err = J.issue_document(
            event_id="E-T-ISSUE-PO", kind="PO", occupancy="CI",
            seat="counter", person_id="ali",
        )
        _assert(err is not None, "counter must not issue PO")
        rec, err = J.issue_document(
            event_id="E-T-ISSUE-PO", kind="PO", occupancy="STARQ",
            seat="financial_controller", person_id="ali",
        )
        _assert(err is not None, "CI award is not Starq occupancy")
        rec, err = J.issue_document(
            event_id="E-T-ISSUE-LEFT", kind="PO", occupancy="CI",
            seat="financial_controller", person_id="ali",
        )
        _assert(err is not None, "leftover must refuse")
        rec, err = J.issue_document(
            event_id="E-T-ISSUE-BARE", kind="PO", occupancy="CI",
            seat="financial_controller", person_id="ali",
        )
        _assert(err is not None, "no amount must refuse")
        rec, err = J.issue_document(
            event_id="E-T-ISSUE-PO", kind="PO", occupancy="CI",
            seat="financial_controller", person_id="ali",
            contact_id="CI-CT-999",
        )
        _assert(err is not None and "contact_id" in err, err)
        _assert(open(org, encoding="utf-8").read() == before, "refused issue must not write orgs")
        rec, err = J.issue_document(
            event_id="E-T-ISSUE-PO", kind="PO", occupancy="CI",
            seat="financial_controller", person_id="ali",
            contact_id="",
        )
        _assert(err is None, err)
        _assert(rec["number"] == "CI-PO-1", rec)
        data = json.loads(open(org, encoding="utf-8").read())
        ci = next(o for o in data["organizations"] if o["entity"] == "CI")
        st = next(o for o in data["organizations"] if o["entity"] == "STARQ")
        _assert(ci["sequences"]["purchase_order"]["issued"] == 1, ci)
        _assert(ci["sequences"]["purchase_order"]["next"] == 2, ci)
        _assert(st["sequences"]["purchase_order"]["issued"] == 0, st)
        _assert(ci["sequences"]["invoice"]["issued"] == 0, ci)
        rec2, err2 = J.issue_document(
            event_id="E-T-ISSUE-PO", kind="PO", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err2 is not None, "double issue")
        rec, err = J.issue_document(
            event_id="E-T-ISSUE-INV", kind="INV", occupancy="STARQ",
            seat="director", person_id="ali",
        )
        _assert(err is None, err)
        _assert(rec["number"] == "ST-INV-1", rec)
        data = json.loads(open(org, encoding="utf-8").read())
        st = next(o for o in data["organizations"] if o["entity"] == "STARQ")
        ci = next(o for o in data["organizations"] if o["entity"] == "CI")
        _assert(st["sequences"]["invoice"]["issued"] == 1, st)
        _assert(st["sequences"]["invoice"]["next"] == 2, st)
        _assert(ci["sequences"]["invoice"]["issued"] == 0, ci)
        stamped = J.propose_one(po_ev)
        _assert("ISSUED PO" in (stamped.get("document") or ""), stamped)
        _assert(stamped.get("doc_number") == "CI-PO-1", stamped)
        _assert(_journal_stamp() == journals, "issue must not touch journals/")
        _assert(not os.path.isfile(J.ISSUED_LOG), "tests must not create issued_documents.jsonl")
    finally:
        J.load_events = orig_load
        J._ISSUED_ROWS = None
        open(org, "w", encoding="utf-8").write(before)


def test_receipt_named_cash_credits_1110():
    p = J.propose_one({
        "id": "E-T-RX-CASH",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "RECEIPT",
        "fields": {"kind": "rent", "amount": "42000", "item": "H. Kiev", "tender": "cash"},
    })
    _assert(p["status"] == "draft", p)
    _assert(p["copy_ready"] is True, p)
    _assert(p["banking"] is True, p)
    _assert(p["accounts_s"] == "6200 1110", p)
    _assert("2100" not in p["draft"], p["draft"])
    _assert("1120" not in p["draft"], p["draft"])
    _assert("8%" not in p["draft"], p["draft"])
    _assert("journals/" not in p["draft"], p["draft"])
    unnamed = J.propose_one({
        "id": "E-T-RX-AP",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "RECEIPT",
        "fields": {"kind": "rent", "amount": "42000"},
    })
    _assert(unnamed["accounts_s"] == "6200 2100", unnamed)
    _assert(not unnamed.get("banking"), unnamed)


def test_mib_not_opened_not_invented():
    p = J.propose_one({
        "id": "E-T-MIB",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "FIN_BANK",
        "fields": {"amount": "100", "tender": "transfer", "contra": "2400", "flow": "out"},
    })
    _assert(p["status"] == "blocked", p)
    _assert(not p.get("draft"), p)
    _assert("not_opened" in p["reason"] or "statement" in p["reason"], p)
    p2 = J.propose_one({
        "id": "E-T-RX-MIB",
        "type": "RECEIPT",
        "fields": {"kind": "rent", "amount": "10", "tender": "1120"},
    })
    _assert(p2["status"] == "blocked", p2)
    _assert(not p2.get("copy_ready"), p2)


def test_pay_named_wallet_settles_ap():
    p = J.propose_one({
        "id": "E-T-PAY",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {"scm_step": "pay", "amount": "80", "item": "thinner", "tender": "1125"},
    })
    _assert(p["status"] == "draft", p)
    _assert(p["banking"] is True, p)
    _assert(p["accounts_s"] == "2100 1125", p)
    _assert("1300" not in p["draft"], p["draft"])
    silent = J.propose_one({
        "id": "E-T-PAY0",
        "type": "PURCHASE",
        "fields": {"scm_step": "pay", "amount": "80", "item": "thinner"},
    })
    _assert(silent["status"] == "no_gl", silent)
    _assert(not silent.get("draft"), silent)


def test_fin_bank_occupancy_and_named_legs():
    p = J.propose_one({
        "id": "E-T-BANK-CI",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "FIN_BANK",
        "fields": {
            "amount": "50", "tender": "cash", "debit": "2400", "credit": "1110",
        },
    })
    _assert(p["status"] == "draft", p)
    _assert(p["occupancy"] == "CI", p)
    _assert(p["accounts_s"] == "2400 1110", p)
    _assert(p["copy_into"] == "journals/club-ignition/", p)
    _assert("statement" in (p.get("reason") or "").lower() or "Not a bank statement" in p["reason"], p)
    st = J.propose_one({
        "id": "E-T-BANK-ST",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "FIN_BANK",
        "fields": {
            "entity": "STARQ", "amount": "25", "tender": "cash",
            "contra": "2400", "flow": "out",
        },
    })
    _assert(st["occupancy"] == "STARQ", st)
    _assert(st["accounts_s"] == "2400 1110", st)
    _assert(" STARQ " in st["draft"].split("\n")[0], st["draft"])
    _assert("8%" not in st["draft"], st["draft"])
    empty = J.propose_one({
        "id": "E-T-BANK0",
        "type": "FIN_BANK",
        "fields": {"tender": "cash"},
    })
    _assert(empty["status"] == "blocked", empty)
    no_contra = J.propose_one({
        "id": "E-T-BANK1",
        "type": "FIN_BANK",
        "fields": {"amount": "10", "tender": "cash"},
    })
    _assert(no_contra["status"] == "no_gl", no_contra)
    leftover = J.propose_one({
        "id": "E-T-BANK-L",
        "type": "FIN_BANK",
        "fields": {"amount": "10", "tender": "cash", "debit": "4300", "credit": "1110"},
    })
    _assert(leftover["status"] == "blocked", leftover)


def test_grn_against_issued_po_only():
    journals = _journal_stamp()
    orig_issued = J._ISSUED_ROWS
    J._ISSUED_ROWS = [{
        "event_id": "E-T-PO-ISS",
        "kind": "PO",
        "occupancy": "CI",
        "number": "CI-PO-1",
    }]
    try:
        bare = J.propose_one({
            "id": "E-T-GRN0",
            "type": "PURCHASE",
            "fields": {"scm_step": "receive", "item": "thinner", "po_event_id": "E-T-PO-ISS"},
        })
        _assert(bare["status"] == "blocked", bare)
        _assert("Qty" in (bare.get("reason") or ""), bare)
        no_po = J.propose_one({
            "id": "E-T-GRN1",
            "type": "PURCHASE",
            "fields": {"scm_step": "receive", "qty": "2", "item": "thinner"},
        })
        _assert(no_po["status"] == "blocked", no_po)
        _assert("issued PO" in (no_po.get("reason") or ""), no_po)
        starq_po = J.propose_one({
            "id": "E-T-GRN-ST",
            "type": "PURCHASE",
            "fields": {
                "entity": "STARQ", "scm_step": "receive", "qty": "2",
                "item": "thinner", "po_event_id": "E-T-PO-ISS",
            },
        })
        _assert(starq_po["status"] == "blocked", starq_po)
        left = J.propose_one({
            "id": "E-T-GRN-L",
            "type": "PURCHASE",
            "fields": {
                "scm_step": "receive", "qty": "1", "sku": "INK-PAINT-LEFT",
                "po_event_id": "E-T-PO-ISS",
            },
        })
        _assert(left["status"] == "blocked", left)
        ok = J.propose_one({
            "id": "E-T-GRN-OK",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "PURCHASE",
            "fields": {
                "scm_step": "receive", "qty": "2", "sku": "INK-CAGE",
                "item": "cage", "po_event_id": "E-T-PO-ISS",
            },
        })
        _assert(ok["status"] == "draft", ok)
        _assert(ok["occupancy"] == "CI", ok)
        _assert(not ok.get("copy_ready"), ok)
        _assert("GRN DRAFT" in (ok.get("document") or ""), ok)
        _assert("CI-PO-1" in (ok.get("document") or ""), ok)
        _assert("5100" not in (ok.get("draft") or ""), ok)
        _assert("8%" not in (ok.get("document") or ""), ok)
        _assert("Tax: 0" in (ok.get("document") or ""), ok)
        _assert(ok.get("qty_action") == "count_link", ok)
        _assert("not_counted" in (ok.get("document") or ""), ok)
        _assert("/products" in (ok.get("document") or ""), ok)
        _assert(_journal_stamp() == journals, "GRN must not write journals/")
    finally:
        J._ISSUED_ROWS = orig_issued


def test_inv_settle_named_cash_issued_only():
    journals = _journal_stamp()
    orig_issued = J._ISSUED_ROWS
    J._ISSUED_ROWS = [{
        "event_id": "E-T-INV-ISS",
        "kind": "INV",
        "occupancy": "CI",
        "number": "CI-INV-1",
        "amount": "100",
    }]
    try:
        unnamed = J.propose_one({
            "id": "E-T-PAY-INV0",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "RECEIPT",
            "fields": {
                "kind": "invoice", "amount": "100",
                "invoice_event_id": "E-T-INV-ISS",
            },
        })
        _assert(unnamed["status"] == "no_gl", unnamed)
        _assert(not unnamed.get("draft"), unnamed)
        _assert("1110" in (unnamed.get("reason") or ""), unnamed)
        no_iss = J.propose_one({
            "id": "E-T-PAY-INV1",
            "type": "RECEIPT",
            "fields": {"kind": "invoice", "amount": "100", "tender": "cash"},
        })
        _assert(no_iss["status"] == "blocked", no_iss)
        no_amt = J.propose_one({
            "id": "E-T-PAY-INV2",
            "type": "RECEIPT",
            "fields": {"kind": "invoice", "tender": "cash", "invoice_event_id": "E-T-INV-ISS"},
        })
        _assert(no_amt["status"] == "blocked", no_amt)
        cross = J.propose_one({
            "id": "E-T-PAY-INV-ST",
            "type": "RECEIPT",
            "fields": {
                "entity": "STARQ", "kind": "invoice", "amount": "100",
                "tender": "cash", "invoice_event_id": "E-T-INV-ISS",
            },
        })
        _assert(cross["status"] == "blocked", cross)
        gst8 = J.propose_one({
            "id": "E-T-PAY-GST",
            "type": "RECEIPT",
            "fields": {
                "kind": "invoice", "amount": "100", "tender": "cash",
                "invoice_event_id": "E-T-INV-ISS", "tax_rate": "8",
            },
        })
        _assert(gst8["status"] == "blocked", gst8)
        ok = J.propose_one({
            "id": "E-T-PAY-INV-OK",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "RECEIPT",
            "fields": {
                "kind": "invoice", "amount": "100", "tender": "cash",
                "invoice_event_id": "E-T-INV-ISS",
            },
        })
        _assert(ok["status"] == "draft", ok)
        _assert(ok["copy_ready"] is True, ok)
        _assert(ok["banking"] is True, ok)
        _assert(ok["accounts_s"] == "1110 1200", ok)
        _assert("8%" not in ok["draft"], ok["draft"])
        _assert("Tax: 0" in ok["draft"], ok["draft"])
        wallet = J.propose_one({
            "id": "E-T-PAY-INV-W",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "RECEIPT",
            "fields": {
                "kind": "invoice", "amount": "100", "tender": "1125",
                "inv_number": "CI-INV-1",
            },
        })
        _assert(wallet["accounts_s"] == "1125 1200", wallet)
        issued_inv = {
            "id": "E-T-INV-ISS",
            "ts": "2026-08-20T12:00:00+05:00",
            "type": "INVOICE_PAYMENT",
            "fields": {"amount": "100", "tender": "cash", "station": "booth"},
        }
        cash_iss = J.propose_one(issued_inv)
        _assert(cash_iss["accounts_s"] == "1110 4200", cash_iss)
        _assert(_journal_stamp() == journals, "settle must not write journals/")
    finally:
        J._ISSUED_ROWS = orig_issued


def test_aging_empty_when_issued_zero():
    journals = _journal_stamp()
    orig = J._ISSUED_ROWS
    J._ISSUED_ROWS = []
    try:
        ci = J.aging("CI", issued=[], events=[], as_of=date(2026, 8, 20))
        _assert(ci["empty"] is True, ci)
        _assert(ci["issued_count"] == 0, ci)
        _assert("issued=0" in ci["reason"], ci)
        _assert(ci["ar"]["lines"] == [], ci)
        _assert(ci["ap"]["lines"] == [], ci)
        _assert(ci["tax"] == "0", ci)
        st = J.aging("STARQ", issued=[{
            "kind": "INV", "occupancy": "CI", "number": "CI-INV-1",
            "amount": "100", "issued_at": "2026-08-01",
        }], events=[], as_of=date(2026, 8, 20))
        _assert(st["empty"] is True, st)
        _assert(st["occupancy"] == "STARQ", st)
        grp = J.aging("", issued=[], events=[])
        _assert(grp["empty"] is True, grp)
        _assert("Group" in grp["reason"] or "occupancy" in grp["reason"], grp)
        _assert(_journal_stamp() == journals, "aging must not write journals/")
    finally:
        J._ISSUED_ROWS = orig


def test_aging_from_issued_minus_named_receipt():
    journals = _journal_stamp()
    issued = [{
        "event_id": "E-T-AGE-INV",
        "kind": "INV",
        "occupancy": "CI",
        "number": "CI-INV-9",
        "amount": "100",
        "tax": "0",
        "issued_at": "2026-07-01T12:00:00+05:00",
        "contact_id": "",
    }, {
        "event_id": "E-T-AGE-PO",
        "kind": "PO",
        "occupancy": "CI",
        "number": "CI-PO-9",
        "amount": "40",
        "tax": "0",
        "issued_at": "2026-08-19T12:00:00+05:00",
    }]
    events = [{
        "id": "E-T-AGE-PAY",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "RECEIPT",
        "fields": {
            "kind": "invoice", "amount": "30", "tender": "cash",
            "invoice_event_id": "E-T-AGE-INV",
        },
    }, {
        "id": "E-T-AGE-GRN",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "receive", "qty": "2", "sku": "INK-CAGE",
            "po_event_id": "E-T-AGE-PO",
        },
    }, {
        "id": "E-T-AGE-AP",
        "ts": "2026-08-20T12:00:00+05:00",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "pay", "amount": "10", "tender": "1125",
            "po_event_id": "E-T-AGE-PO",
        },
    }]
    orig = J._ISSUED_ROWS
    J._ISSUED_ROWS = issued
    try:
        r = J.aging("CI", issued=issued, events=events, as_of=date(2026, 8, 20))
        _assert(r["empty"] is False, r)
        _assert(len(r["ar"]["lines"]) == 1, r)
        _assert(r["ar"]["lines"][0]["remaining"] == "70", r["ar"])
        _assert(r["ar"]["lines"][0]["bucket"] == "31-60", r["ar"])
        _assert(len(r["ap"]["lines"]) == 1, r)
        _assert(r["ap"]["lines"][0]["remaining"] == "30", r["ap"])
        _assert(r["ap"]["lines"][0]["bucket"] == "current", r["ap"])
        unnamed = J.aging("CI", issued=issued, events=[{
            "id": "E-T-AGE-UN",
            "type": "RECEIPT",
            "fields": {"kind": "invoice", "amount": "100", "invoice_event_id": "E-T-AGE-INV"},
        }], as_of=date(2026, 8, 20))
        _assert(unnamed["ar"]["lines"][0]["remaining"] == "100", unnamed)
        leftover = J.aging("CI", issued=[{
            "kind": "INV", "occupancy": "CI", "number": "CI-INV-L",
            "amount": "5", "issued_at": "2026-08-01",
        }], events=[{
            "id": "E-T-AGE-L",
            "type": "RECEIPT",
            "fields": {
                "kind": "invoice", "amount": "5", "tender": "cash",
                "invoice_event_id": "missing", "sku": "INK-PAINT-LEFT",
            },
        }], as_of=date(2026, 8, 20))
        _assert(leftover["ar"]["lines"][0]["remaining"] == "5", leftover)
        _assert(_journal_stamp() == journals, "aging must not write journals/")
    finally:
        J._ISSUED_ROWS = orig


def test_statement_refuses_empty_contacts():
    journals = _journal_stamp()
    stmt, err = J.statement_of_account("CI", "CI-CT-1", contacts=[], issued=[], events=[])
    _assert(stmt is None, stmt)
    _assert("contacts []" in (err or ""), err)
    stmt, err = J.statement_of_account("CI", "", contacts=[{
        "id": "CI-CT-1", "entity": "CI", "name": "Walk-in", "kind": "customer",
    }], issued=[], events=[])
    _assert(stmt is None, stmt)
    _assert("contact_id required" in (err or ""), err)
    stmt, err = J.statement_of_account("CI", "NOPE", contacts=[{
        "id": "CI-CT-1", "entity": "CI", "name": "Walk-in", "kind": "customer",
    }], issued=[], events=[])
    _assert(stmt is None, stmt)
    _assert("not on this occupancy" in (err or ""), err)
    stmt, err = J.statement_of_account("STARQ", "CI-CT-1", contacts=[{
        "id": "CI-CT-1", "entity": "CI", "name": "Walk-in", "kind": "customer",
    }], issued=[], events=[])
    _assert(stmt is None, stmt)
    issued = [{
        "kind": "INV", "occupancy": "CI", "number": "CI-INV-2",
        "amount": "50", "tax": "0", "contact_id": "CI-CT-1",
        "issued_at": "2026-08-18", "event_id": "E-T-ST-INV",
    }]
    stmt, err = J.statement_of_account(
        "CI", "CI-CT-1",
        contacts=[{"id": "CI-CT-1", "entity": "CI", "name": "Walk-in", "kind": "customer"}],
        issued=issued, events=[], as_of=date(2026, 8, 20),
    )
    _assert(err is None, err)
    _assert(stmt["contact_name"] == "Walk-in", stmt)
    _assert(stmt["open"] == "50", stmt)
    _assert(stmt["tax"] == "0", stmt)
    _assert("8%" not in str(stmt), stmt)
    empty_ok, err = J.statement_of_account(
        "CI", "CI-CT-1",
        contacts=[{"id": "CI-CT-1", "entity": "CI", "name": "Walk-in", "kind": "customer"}],
        issued=[], events=[],
    )
    _assert(err is None, err)
    _assert(empty_ok["empty"] is True, empty_ok)
    _assert(_journal_stamp() == journals, "statement must not write journals/")


def test_three_way_empty_when_issued_zero():
    journals = _journal_stamp()
    orig = J._ISSUED_ROWS
    J._ISSUED_ROWS = []
    try:
        ci = J.three_way_match("CI", issued=[], events=[])
        _assert(ci["empty"] is True, ci)
        _assert(ci["issued_count"] == 0, ci)
        _assert("issued=0" in ci["reason"], ci)
        _assert(ci["po"] == [] and ci["grn"] == [] and ci["inv"] == [], ci)
        _assert(ci["tax"] == "0", ci)
        st = J.three_way_match("STARQ", issued=[{
            "kind": "PO", "occupancy": "CI", "number": "CI-PO-1", "amount": "10",
        }], events=[])
        _assert(st["empty"] is True, st)
        _assert(st["occupancy"] == "STARQ", st)
        grp = J.three_way_match("", issued=[], events=[])
        _assert(grp["empty"] is True, grp)
        _assert("Group" in grp["reason"] or "occupancy" in grp["reason"], grp)
        _assert(_journal_stamp() == journals, "three-way must not write journals/")
    finally:
        J._ISSUED_ROWS = orig


def test_three_way_from_issued_and_grn():
    journals = _journal_stamp()
    orig = J._ISSUED_ROWS
    issued = [{
        "event_id": "E-T-3W-PO",
        "kind": "PO",
        "occupancy": "CI",
        "number": "CI-PO-3W",
        "amount": "40",
        "tax": "0",
        "issued_at": "2026-08-19",
    }, {
        "event_id": "E-T-3W-INV",
        "kind": "INV",
        "occupancy": "CI",
        "number": "CI-INV-3W",
        "amount": "90",
        "tax": "0",
        "issued_at": "2026-08-19",
    }]
    events = [{
        "id": "E-T-3W-GRN",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "receive", "qty": "2", "sku": "INK-CAGE",
            "item": "cage", "po_event_id": "E-T-3W-PO",
        },
    }, {
        "id": "E-T-3W-BARE",
        "type": "PURCHASE",
        "fields": {"scm_step": "receive", "item": "thinner", "po_event_id": "E-T-3W-PO"},
    }, {
        "id": "E-T-3W-LEFT",
        "type": "PURCHASE",
        "fields": {
            "scm_step": "receive", "qty": "1", "sku": "INK-PAINT-LEFT",
            "po_event_id": "E-T-3W-PO",
        },
    }]
    J._ISSUED_ROWS = issued
    try:
        r = J.three_way_match("CI", issued=issued, events=events)
        _assert(r["empty"] is False, r)
        _assert(r["occupancy"] == "CI", r)
        _assert(any(p.get("number") == "CI-PO-3W" for p in r["po"]), r["po"])
        _assert(any(g.get("number") == "CI-PO-3W" for g in r["grn"]), r["grn"])
        _assert(any(i.get("number") == "CI-INV-3W" for i in r["inv"]), r["inv"])
        _assert(all(row.get("matched") is False for row in r["rows"]), r["rows"])
        _assert(r["tax"] == "0", r)
        _assert("8%" not in str(r), r)
        st = J.three_way_match("STARQ", issued=issued, events=events)
        _assert(st["empty"] is True, st)
        _assert(st["po"] == [] and st["grn"] == [] and st["inv"] == [], st)
        _assert(_journal_stamp() == journals, "three-way must not write journals/")
    finally:
        J._ISSUED_ROWS = orig


def test_crm_pipeline_existing_ops_only():
    journals = _journal_stamp()
    events = [
        {"id": "E-T-CRM-0", "type": "CALL", "fields": {"channel": "phone"}},
        {"id": "E-T-CRM-SMOKE", "type": "CALL", "fields": {"customer": "pack smoke"}},
        {
            "id": "E-T-CRM-1",
            "type": "CALL",
            "fields": {"customer": "Real party", "phone": "7"},
        },
        {
            "id": "E-T-CRM-2",
            "type": "INTAKE",
            "job_no": "JOB-2026-0888",
            "fields": {"customer": "Real party"},
        },
        {
            "id": "E-T-CRM-NEED",
            "type": "PURCHASE",
            "fields": {"scm_step": "need", "item": "thinner", "customer": "Should not lead"},
        },
        {
            "id": "E-T-CRM-LEFT",
            "type": "CALL",
            "fields": {"customer": "x", "sku": "INK-PAINT-LEFT"},
        },
        {
            "id": "E-T-CRM-ST",
            "type": "CALL",
            "fields": {"entity": "STARQ", "customer": "Starq party"},
        },
    ]
    ci = J.crm_pipeline("CI", events=events)
    _assert(ci["empty"] is False, ci)
    _assert(ci["occupancy"] == "CI", ci)
    cards = ci["cards"]
    intake_names = [c.get("customer") for c in cards["INTAKE"]]
    _assert("Real party" in intake_names, cards)
    call_names = [c.get("customer") for c in cards["CALL"]]
    _assert("Real party" not in call_names, "later INTAKE must move the card")
    _assert("pack smoke" not in str(cards), cards)
    _assert("Should not lead" not in str(cards), cards)
    _assert("Starq party" not in str(cards), cards)
    _assert(not any(c.get("customer") == "x" for col in cards.values() for c in col), cards)
    empty = J.crm_pipeline("CI", events=[])
    _assert(empty["empty"] is True, empty)
    _assert("invent a lead" in empty["reason"], empty)
    st = J.crm_pipeline("STARQ", events=events)
    _assert(any(c.get("customer") == "Starq party" for c in st["cards"]["CALL"]), st)
    _assert(all(c.get("customer") != "Real party" for col in st["cards"].values() for c in col), st)
    grp = J.crm_pipeline("", events=events)
    _assert(grp["empty"] is True, grp)
    _assert(_journal_stamp() == journals, "CRM pipeline must not write journals/")


def test_inventory_valuation_empty_honest():
    rep = J.inventory_valuation("CI")
    _assert(rep["empty"] is True, rep)
    _assert("not_counted" in rep["reason"] or "No counted" in rep["reason"], rep)
    orig = J._inventory_lines
    J._inventory_lines = lambda: [{
        "sku": "INK-CAGE",
        "product_id": "sku-cage-stock",
        "qty_status": "counted",
        "qty": 2,
        "unit_cost": 50,
    }]
    try:
        rep2 = J.inventory_valuation("CI")
        _assert(rep2["empty"] is False, rep2)
        _assert(rep2["total"] == Decimal("100"), rep2)
        rep_st = J.inventory_valuation("STARQ")
        _assert(rep_st["empty"] is True, "CI SKU must not appear on Starq")
    finally:
        J._inventory_lines = orig


def test_sales_summary_empty_when_issued_zero():
    rep = J.sales_summary("CI")
    _assert(rep["empty"] is True, rep)
    _assert("issued=0" in rep["reason"] or "Empty honest" in rep["reason"], rep)


def test_payroll_summary_empty_without_rates():
    rep = J.payroll_summary("CI")
    _assert(rep["empty"] is True, rep)
    _assert("rate_mvr" in rep["reason"], rep)


def test_scm_approve_from_need():
    events = [
        {
            "id": "E-T-NEED",
            "type": "PURCHASE",
            "ts": "2026-08-20T10:00:00+05:00",
            "fields": {"entity": "CI", "scm_step": "need", "item": "thinner", "amount": "80"},
        },
    ]
    orig = J.load_events
    J.load_events = lambda: events
    try:
        form, err = J.prepare_scm_approve(
            event_id="E-T-NEED",
            scm_step="award",
            occupancy="CI",
            seat="financial_controller",
            events=events,
        )
        _assert(err is None, err)
        _assert(form["scm_step"] == "award", form)
        _assert(form["need_event_id"] == "E-T-NEED", form)
        _assert(form["amount"] == "80", form)
        form2, err2 = J.prepare_scm_approve(
            event_id="E-T-NEED",
            scm_step="award",
            occupancy="CI",
            seat="quartermaster",
            events=events,
        )
        _assert(form2 is None and err2, err2)
        events.append({
            "id": "E-T-AWD",
            "type": "PURCHASE",
            "ts": "2026-08-20T11:00:00+05:00",
            "fields": {"entity": "CI", "scm_step": "award", "item": "thinner", "approve_of": "E-T-NEED"},
        })
        form3, err3 = J.prepare_scm_approve(
            event_id="E-T-NEED",
            scm_step="award",
            occupancy="CI",
            seat="financial_controller",
            events=events,
        )
        _assert(form3 is None and "already" in (err3 or "").lower(), err3)
    finally:
        J.load_events = orig


def test_scm_approve_match_from_award():
    events = [
        {
            "id": "E-T-A1",
            "type": "PURCHASE",
            "ts": "2026-08-20T10:00:00+05:00",
            "fields": {"entity": "CI", "scm_step": "award", "item": "thinner"},
        },
    ]
    form, err = J.prepare_scm_approve(
        event_id="E-T-A1",
        scm_step="match",
        occupancy="CI",
        seat="financial_controller",
        events=events,
    )
    _assert(err is None, err)
    _assert(form["scm_step"] == "match", form)


def test_projects_index_empty_honest():
    import ops as Ops
    orig = Ops.load_state
    Ops.load_state = lambda: {"jobs": {}}
    orig_jc = J.job_costing
    J.job_costing = lambda _occ: []
    try:
        rep = J.projects_index("CI")
        _assert(rep["empty"] is True, rep)
        _assert("will not invent" in rep["reason"].lower(), rep)
    finally:
        Ops.load_state = orig
        J.job_costing = orig_jc


def test_projects_index_from_state():
    import ops as Ops
    orig = Ops.load_state
    Ops.load_state = lambda: {
        "jobs": {
            "JOB-0001": {
                "customer": "Real party",
                "vehicle": "LC200",
                "status": "in workshop",
            }
        }
    }
    try:
        rep = J.projects_index("CI")
        _assert(rep["empty"] is False, rep)
        _assert(len(rep["items"]) == 1, rep)
        _assert(rep["items"][0]["job_no"] == "JOB-0001", rep)
        _assert(rep["items"][0]["writable"] is True, rep)
    finally:
        Ops.load_state = orig


def test_intercompany_mirror_hint_empty():
    orig = J.load_events
    J.load_events = lambda: []
    try:
        hint = J.intercompany_mirror_hint()
        _assert(hint.get("empty") is True or not hint.get("hints"), hint)
    finally:
        J.load_events = orig


def test_sod_approvals_from_purchase_steps():
    events = [
        {
            "id": "E-T-NEED",
            "type": "PURCHASE",
            "ts": "2026-08-20T10:00:00+05:00",
            "fields": {"entity": "CI", "scm_step": "need", "item": "thinner"},
        },
        {
            "id": "E-T-ST",
            "type": "PURCHASE",
            "ts": "2026-08-20T10:00:00+05:00",
            "fields": {"entity": "STARQ", "scm_step": "match", "item": "licence", "amount": "1"},
        },
    ]
    orig = J.load_events
    J.load_events = lambda: events
    try:
        ci = J.sod_approvals_inbox("CI")
        _assert(ci["empty"] is False, ci)
        _assert(len(ci["items"]) == 1, ci)
        _assert(ci["items"][0]["step"] == "need", ci)
        st = J.sod_approvals_inbox("STARQ")
        _assert(len(st["items"]) == 1, st)
        _assert("CI Vendor" not in str(st), st)
    finally:
        J.load_events = orig


def test_estimate_quo_draft_unissued():
    events = [
        {
            "id": "E-T-EST",
            "ts": "2026-08-20T10:00:00+05:00",
            "type": "ESTIMATE",
            "fields": {"entity": "CI", "customer": "Real party", "job_no": "JOB-1", "amount": "1500"},
        },
        {
            "id": "E-T-EST2",
            "ts": "2026-08-20T11:00:00+05:00",
            "type": "ESTIMATE",
            "fields": {"entity": "CI", "customer": "Real party", "job_no": "JOB-1", "amount": "2000"},
        },
    ]
    orig = J.load_events
    J.load_events = lambda: events
    try:
        p = J.propose_one(events[0])
        _assert(p["status"] == "draft", p)
        _assert(p.get("doc_kind") == "QUO", p)
        _assert(p.get("doc_unissued") is True, p)
        _assert("UNISSUED QUO" in (p.get("document") or ""), p)
        _assert("Tax: 0" in (p.get("document") or ""), p)
        dup = J.propose_one(events[1])
        _assert(
            "duplicate" in dup.get("reason", "").lower()
            or "already on job" in dup.get("reason", "").lower(),
            dup,
        )
    finally:
        J.load_events = orig


if __name__ == "__main__":
    test_home_receipt_uses_vendor_and_catalog_id()
    test_purchase_still_5100_not_1300()
    test_purchase_counted_sku_with_cost_debits_1300()
    test_purchase_counted_without_cost_stays_5100()
    test_purchase_leftover_blocked()
    test_4300_blocked()
    test_call_is_no_gl()
    test_missing_amount_blocked()
    test_does_not_write_journals()
    test_close_starq_4110_not_garage()
    test_close_ci_station_and_sku()
    test_authorisation_wip_2500()
    test_close_qty_times_rate_not_invented()
    test_close_uses_estimate_on_job()
    test_occupancy_starq_vs_ci()
    test_award_unissued_po_document()
    test_procurement_chain_drafts()
    test_valued_close_unissued_invoice_document()
    test_issue_engine_occupancy_and_seats()
    test_receipt_named_cash_credits_1110()
    test_mib_not_opened_not_invented()
    test_pay_named_wallet_settles_ap()
    test_fin_bank_occupancy_and_named_legs()
    test_grn_against_issued_po_only()
    test_inv_settle_named_cash_issued_only()
    test_aging_empty_when_issued_zero()
    test_aging_from_issued_minus_named_receipt()
    test_statement_refuses_empty_contacts()
    test_three_way_empty_when_issued_zero()
    test_three_way_from_issued_and_grn()
    test_crm_pipeline_existing_ops_only()
    test_inventory_valuation_empty_honest()
    test_sales_summary_empty_when_issued_zero()
    test_payroll_summary_empty_without_rates()
    test_sod_approvals_from_purchase_steps()
    test_scm_approve_from_need()
    test_scm_approve_match_from_award()
    test_projects_index_empty_honest()
    test_projects_index_from_state()
    test_intercompany_mirror_hint_empty()
    test_estimate_quo_draft_unissued()
    print("OK — journal_outbox drafts, occupancy income/WIP, unissued PO/INV/QUO, GRN/INV settle, AR/AP aging, statement refuse, three-way empty honest, CRM pipeline, sub-reports, approvals inbox, scm approve, projects index, journals untouched")
