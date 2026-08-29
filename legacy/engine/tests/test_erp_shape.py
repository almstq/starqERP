#!/usr/bin/env python3
"""Goal 1 shape: masters on disk, v1 tabs, DEC-008 not violated by outbox."""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import serve as S

NEED = {
    "organizations.json",
    "contacts.json",
    "products.json",
    "tax.json",
    "locations.json",
    "users.json",
    "permissions.json",
    "inventory.json",
    "payroll.json",
    "projects.json",
}
TABS = {"", "sales", "expenses", "banking", "contacts", "products", "reports", "accounting", "settings"}


def main():
    masters = os.path.join(HERE, "ops", "masters")
    missing = [n for n in sorted(NEED) if not os.path.isfile(os.path.join(masters, n))]
    if missing:
        raise SystemExit(f"FAIL missing masters: {missing}")
    miss_tabs = TABS - S.BOOKS_TABS
    if miss_tabs:
        raise SystemExit(f"FAIL missing v1 tabs: {miss_tabs}")
    # Compare RESOLVED paths, not spelled ones. D:\StarqTech and D:\!starq are the same
    # directory joined by a junction, and which name you arrive through depends only on what the
    # caller typed. abspath keeps the spelling and so reported the live tree as not-live whenever
    # the file was reached by the other name; realpath collapses the junction and is correct
    # under either name — including after the folders swap roles in the rename.
    live = os.path.normcase(os.path.realpath(r"D:\StarqTech\the foundation engine"))
    here = os.path.normcase(os.path.realpath(HERE))
    if here != live:
        raise SystemExit(f"FAIL not live tree: {HERE} (resolves to {here}, expected {live})")
    acc_ci = S.h_accounting({}, "CI", "", "")
    if "Occupancy" not in acc_ci or "Copy-ready" not in acc_ci:
        raise SystemExit("FAIL accounting draft review missing occupancy/copy-ready")
    acc_st = S.h_accounting({}, "STARQ", "", "")
    if "Starq occupancy" not in acc_st:
        raise SystemExit("FAIL Starq accounting must name occupancy")
    pos_st = S.h_pos({}, "STARQ", "", "")
    if "no shop POS" not in pos_st:
        raise SystemExit("FAIL Starq POS must refuse shop")
    sales_st = S.h_sales({}, "STARQ", "", "")
    if "4110 is Starq Dynamics" not in sales_st:
        raise SystemExit("FAIL Starq Sales must name 4110 Dynamics drafts")
    if "No shop POS" not in sales_st:
        raise SystemExit("FAIL Starq Sales must refuse shop POS")
    if "Customer invoice" not in sales_st:
        raise SystemExit("FAIL Starq Sales must show Customer invoice")
    if "Capture customer invoice" in sales_st:
        raise SystemExit("FAIL Starq invoice form must not show without a seat")
    if "Job costing" not in sales_st:
        raise SystemExit("FAIL Starq Sales must show Job costing")
    if "Club Ignition garage jobs stay on CI" not in sales_st:
        raise SystemExit("FAIL Starq Job costing must not mix CI garage")
    exp_ci = S.h_expenses({}, "CI", "", "")
    if "unissued PO" not in exp_ci:
        raise SystemExit("FAIL CI Expenses must mention unissued PO drafts")
    if "authorised seat issues" not in exp_ci:
        raise SystemExit("FAIL CI Expenses must say issue increments issued")
    if "GRN" not in exp_ci and "issued PO" not in exp_ci:
        raise SystemExit("FAIL CI Expenses must mention GRN against issued PO")
    if "Three-way match" not in exp_ci:
        raise SystemExit("FAIL CI Expenses must show Three-way match")
    if "Supplier bill" not in exp_ci:
        raise SystemExit("FAIL CI Expenses must show Supplier bill")
    if "will not invent a vendor" not in exp_ci.lower():
        raise SystemExit("FAIL CI Expenses must refuse invented vendor")
    if "Capture supplier bill" in exp_ci:
        raise SystemExit("FAIL supplier bill form must not show without a seat")
    if "issued=0" not in exp_ci and "Empty honest" not in exp_ci:
        raise SystemExit("FAIL CI three-way must be empty honest when issued=0")
    if "<h3>PO</h3>" in exp_ci:
        raise SystemExit("FAIL issued=0 must not render fake PO/GRN/INV match columns")
    sales_ci = S.h_sales({}, "CI", "", "")
    if "next number" not in sales_ci:
        raise SystemExit("FAIL CI Sales must show next INV number")
    if "issued INV" not in sales_ci:
        raise SystemExit("FAIL CI Sales must say cash receipt against issued INV")
    if "Customer invoice" not in sales_ci:
        raise SystemExit("FAIL CI Sales must show Customer invoice")
    if "will not invent a customer" not in sales_ci.lower():
        raise SystemExit("FAIL CI Sales must refuse invented customer")
    if "Capture customer invoice" in sales_ci:
        raise SystemExit("FAIL customer invoice form must not show without a seat")
    if "Job costing" not in sales_ci:
        raise SystemExit("FAIL CI Sales must show Job costing")
    if "will not invent" not in sales_ci.lower() and "No valued job amounts" not in sales_ci:
        raise SystemExit("FAIL CI Job costing must refuse invented amounts")
    pos_ci = S.h_pos({}, "CI", "", "")
    if "Will not invent" not in pos_ci and "No counted SKU" not in pos_ci and "Consume counted stock" not in pos_ci:
        raise SystemExit("FAIL CI POS stub missing")
    prod_ci = S.h_products({}, "CI", "", "")
    if "sell_price_mvr" not in prod_ci and "Sell MVR" not in prod_ci:
        raise SystemExit("FAIL Products must show occupancy sell price column")
    if "Save sell price" in prod_ci:
        raise SystemExit("FAIL Products price form must not show without a seat")
    con_ci = S.h_contacts({}, "CI", "", "")
    if "Ops-derived names (not masters)" not in con_ci and "not the master" not in con_ci:
        raise SystemExit("FAIL Contacts must label ops-derived names as not masters")
    if "Add CALL party to contacts" in con_ci:
        raise SystemExit("FAIL CALL party button must not show without a seat")
    if "Add contact" in con_ci:
        raise SystemExit("FAIL Contacts create form must not show without a seat")
    if "CRM pipeline" not in con_ci:
        raise SystemExit("FAIL Contacts must show CRM pipeline")
    if "will not invent a lead" not in con_ci.lower() and "Empty honest" not in con_ci:
        raise SystemExit("FAIL CRM pipeline must refuse invented leads")
    con_st = S.h_contacts({}, "STARQ", "", "")
    if "Club Ignition occupancy — existing CALL" in con_st:
        raise SystemExit("FAIL Starq CRM must not carry CI occupancy chrome")
    set_ci = S.h_settings({}, "CI", "", "")
    if "Add employee" in set_ci:
        raise SystemExit("FAIL HR create form must not show without a seat")
    if "Add location" in set_ci:
        raise SystemExit("FAIL location create form must not show without a seat")
    if "H. Kiev" not in set_ci:
        raise SystemExit("FAIL CI Settings must keep H. Kiev")
    if "second people" not in set_ci and "not a second people" not in set_ci:
        raise SystemExit("FAIL Settings must say HR is not a second people file")
    acc_pay = S.h_accounting({}, "CI", "", "")
    if "PAYROLL_RUN" not in acc_pay:
        raise SystemExit("FAIL Accounting must show payroll run hold")
    if "Will not invent" not in acc_pay and "Rates empty" not in acc_pay:
        raise SystemExit("FAIL payroll hold must refuse invented pay")
    bank_ci = S.h_banking({}, "CI", "", "")
    if "not_opened" not in bank_ci:
        raise SystemExit("FAIL Banking must show MIB not_opened")
    if "Copy-ready" not in bank_ci and "copy-ready" not in bank_ci:
        raise SystemExit("FAIL Banking must show copy-ready drafts")
    if "not a bank statement" not in bank_ci.lower() and "Not a bank statement" not in bank_ci:
        raise SystemExit("FAIL Banking must refuse pretending a statement")
    if "8%" in bank_ci:
        raise SystemExit("FAIL Banking must not mention 8%")
    rep_ci = S.h_reports({}, "CI", "", "")
    if "AR/AP aging" not in rep_ci:
        raise SystemExit("FAIL Reports must show AR/AP aging")
    if "issued=0" not in rep_ci and "Empty honest" not in rep_ci:
        raise SystemExit("FAIL Reports aging must be empty honest when issued=0")
    if "Current</th>" in rep_ci or "31-60" in rep_ci:
        raise SystemExit("FAIL issued=0 must not render fake aging buckets")
    if "contacts []" not in rep_ci and "Will not invent a customer" not in rep_ci:
        raise SystemExit("FAIL Reports statement must refuse empty contacts")
    if "8%" in rep_ci:
        raise SystemExit("FAIL Reports must not mention 8%")
    acc_age = S.h_accounting({}, "CI", "", "")
    if "AR/AP aging" not in acc_age:
        raise SystemExit("FAIL Accounting must show AR/AP aging")
    if "Statement of account" not in acc_age:
        raise SystemExit("FAIL Accounting must show statement refuse")
    strip_ci = S._engine_strip("CI")
    if "engine-strip" not in strip_ci and "POS till" not in strip_ci:
        raise SystemExit("FAIL Dashboard engine strip missing kind counts")
    if "Receipts" not in strip_ci or "Purchases" not in strip_ci or "Payroll blocked" not in strip_ci:
        raise SystemExit("FAIL Dashboard engine strip must count receipts/purchases/payroll")
    if "INK-CAGE not_counted" not in strip_ci and "qty empty" not in strip_ci:
        raise SystemExit("FAIL Dashboard must not fake cage qty")
    gates_ci = S._draft_gates_panel("CI")
    if "Next draft" not in gates_ci:
        raise SystemExit("FAIL Dashboard checklist missing Next draft")
    if "need issue" not in gates_ci:
        raise SystemExit("FAIL Dashboard checklist must name need issue")
    if "progress_pct" in gates_ci or "% complete" in gates_ci.lower():
        raise SystemExit("FAIL Dashboard must not show fake progress %")
    gates_st = S._draft_gates_panel("STARQ")
    if "no shop POS" not in gates_st:
        raise SystemExit("FAIL Starq checklist must not treat need price as a till gate")
    strip_st = S._engine_strip("STARQ")
    if "Club Ignition" in strip_st:
        raise SystemExit("FAIL Starq engine strip must not mix CI occupancy")
    if "INK-CAGE counted" in strip_st:
        raise SystemExit("FAIL Starq must not show a fake cage count")
    sales_ci2 = S.h_sales({}, "CI", "", "")
    if "POS till" not in sales_ci2:
        raise SystemExit("FAIL Sales must carry the engine strip")
    if "Add SKU" in prod_ci:
        raise SystemExit("FAIL Products SKU form must not show without a seat")
    bank_st = S.h_banking({}, "STARQ", "", "")
    if "Starq occupancy" not in bank_st:
        raise SystemExit("FAIL Starq Banking must name occupancy")
    chk = S.B.check_journals()
    if "entries" not in chk or "postings" not in chk:
        raise SystemExit("FAIL books.py check_journals missing counts")
    if chk.get("ok") and not chk.get("balanced"):
        raise SystemExit("FAIL check ok must be balanced")
    rep_st = S.h_reports({}, "STARQ", "", "")
    if "books.py check" not in rep_st:
        raise SystemExit("FAIL Reports must show books.py check")
    if "entries" not in rep_st or "postings" not in rep_st:
        raise SystemExit("FAIL Reports check must name entries/postings")
    if "DRAFT — not posted" not in rep_st and "No Starq outbox drafts" not in rep_st:
        raise SystemExit("FAIL Reports must label DRAFT — not posted or empty Starq outbox")
    if "Club Ignition occupancy — CI drafts" in rep_st:
        raise SystemExit("FAIL Starq Reports must not carry CI occupancy chrome")
    home_ci = S.h_home(S.B.load_accounts(), "CI", None, "", "", "")
    if "Approvals inbox" not in home_ci:
        raise SystemExit("FAIL Dashboard must show Approvals inbox")
    if "Read-only links — no approve button" in home_ci:
        raise SystemExit("FAIL Dashboard approvals must allow scm approve when seat fits")
    if "Approve" not in home_ci and "No pending SoD" not in home_ci:
        raise SystemExit("FAIL Dashboard approvals must show Approve column or empty honest")
    proj_ci = S.h_projects({}, "CI", "", "", None)
    if "Projects" not in proj_ci and "Jobs on disk" not in proj_ci:
        raise SystemExit("FAIL Projects tab must render")
    if "will not invent" not in proj_ci.lower() and "Empty" not in proj_ci:
        raise SystemExit("FAIL Projects must be empty honest when no jobs")
    home_grp = S.h_home(S.B.load_accounts(), None, None, "", "", "")
    if "intercompany" not in home_grp.lower():
        raise SystemExit("FAIL Group dashboard must show intercompany strip")
    exp_ci3 = S.h_expenses({}, "CI", "", "", None, None)
    if "Approve" not in exp_ci3 and "No purchase events" not in exp_ci3:
        raise SystemExit("FAIL Expenses purchasing must expose approve or empty honest")
    if "Inventory valuation" not in rep_ci:
        raise SystemExit("FAIL Reports must show Inventory valuation")
    if "Sales summary" not in rep_ci:
        raise SystemExit("FAIL Reports must show Sales summary")
    if "Payroll summary" not in rep_ci:
        raise SystemExit("FAIL Reports must show Payroll summary")
    if "not_counted" not in rep_ci and "No counted SKU" not in rep_ci:
        raise SystemExit("FAIL Inventory valuation must be empty honest")
    if "issued=0" not in rep_ci and "Empty honest" not in rep_ci:
        pass  # sales summary covered above for aging; sales panel has its own empty
    rep_sales_empty = "issued=0" in rep_ci or "Empty honest" in rep_ci or "will not invent sales" in rep_ci
    if not rep_sales_empty:
        raise SystemExit("FAIL Sales summary must be empty honest when issued=0")
    if "rate_mvr" not in rep_ci and "Roster empty" not in rep_ci:
        raise SystemExit("FAIL Payroll summary must refuse invented pay")
    acc_st2 = S.h_accounting({}, "STARQ", "", "")
    if "books.py check" not in acc_st2:
        raise SystemExit("FAIL Accounting must show books.py check")
    acc_ci2 = S.h_accounting({}, "CI", "", "")
    if "Draft validate:" not in acc_ci2:
        raise SystemExit("FAIL Accounting must show draft validate")
    if "PASS" not in acc_ci2 and "FAIL" not in acc_ci2 and "copy-ready" not in acc_ci2:
        raise SystemExit("FAIL Accounting validate must show PASS/FAIL or copy-ready count")
    if "Transactions (ops events)" not in acc_ci2 and 'href="/transactions' not in acc_ci2:
        raise SystemExit("FAIL Accounting must link to Ops transactions feed")
    txn_st = S.h_transactions({}, "STARQ", "", "")
    if "Pack smoke" in txn_st:
        raise SystemExit("FAIL CI pack smoke on Starq transactions")
    if "Starq occupancy" not in txn_st:
        raise SystemExit("FAIL Starq Ops feed must name occupancy")
    if "<h1>Ops</h1>" not in txn_st:
        raise SystemExit("FAIL Ops tab must title the transactions feed")
    txn_ci = S.h_transactions({}, "CI", "", "")
    if "transaction log until" not in txn_ci:
        raise SystemExit("FAIL CI Ops feed must say events are the log until GL")
    notes_ci = S.h_notes("CI")
    if "Local notes" not in notes_ci:
        raise SystemExit("FAIL Notes must show local notes file")
    if "No local notes yet" not in notes_ci and "ops/notes/" not in notes_ci:
        raise SystemExit("FAIL Notes must be honest empty or show path")
    dec = S.h_decisions("CI")
    if "the foundation engine / journals inbox" not in dec:
        raise SystemExit("FAIL Decisions must filter to the foundation engine-relevant")
    if "Vercel deployment" in dec or "peopleProfiles" in dec:
        raise SystemExit("FAIL Decisions must not show Nexus deploy items")
    set_mx = S.h_settings({}, "CI", "", "")
    if "Permissions matrix" not in set_mx:
        raise SystemExit("FAIL Settings must show permissions matrix")
    if "Audit log" not in set_mx:
        raise SystemExit("FAIL Settings must show Audit log")
    if "Will not invent history" not in set_mx and "No master-create audit" not in set_mx:
        raise SystemExit("FAIL Settings audit must refuse invented history")
    if "Read-only" not in set_mx and "read-only" not in set_mx:
        raise SystemExit("FAIL Settings matrix must be read-only")
    if "method=\"post\" action=\"/permissions" in set_mx:
        raise SystemExit("FAIL Settings must not post permissions")
    for p in S._review_rows("STARQ", include_counts=True):
        if (p.get("occupancy") or "") == "CI":
            raise SystemExit(f"FAIL CI outbox on Starq chrome: {p}")
    exp_st = S.h_expenses({}, "STARQ", "", "")
    for p in S._review_rows("STARQ", types={"RECEIPT", "BILL", "PURCHASE", "FIN_PAYABLE"}):
        if (p.get("occupancy") or "CI") == "CI":
            raise SystemExit(f"FAIL CI expense draft on Starq: {p}")
    if "Pack smoke" in exp_st:
        raise SystemExit("FAIL CI ops leak onto Starq Expenses")
    prod_st = S.h_products({}, "STARQ", "", "")
    if "INK-CAGE" in prod_st:
        raise SystemExit("FAIL Starq Products must not list CI cage SKU")
    if "INK-PAINT" in prod_st:
        raise SystemExit("FAIL Starq Products must not list CI paint SKUs")
    pos_st2 = S.h_pos({}, "STARQ", "", "")
    if "/pos?entity=CI" in pos_st2:
        raise SystemExit("FAIL Starq POS chrome must not open CI till")
    nested = os.path.join(r"D:\StarqTech\00_STARQ_HQ", "operations", "finance", "the foundation engine")
    if S.tree_guard(here=nested, cwd=nested) is None:
        raise SystemExit("FAIL nested clone must be refused")
    if S.tree_guard(here=HERE, cwd=r"D:\StarqTech") is None:
        raise SystemExit("FAIL wrong cwd must be refused")
    if S.tree_guard(here=HERE, cwd=HERE) is not None:
        raise SystemExit("FAIL live tree+cwd must be allowed")
    import subprocess
    nested_py = os.path.join(
        r"D:\StarqTech\00_STARQ_HQ", "operations", "finance", "the foundation engine", "serve.py"
    )
    if os.path.isfile(nested_py):
        nested_run = subprocess.run(
            [sys.executable, nested_py],
            cwd=os.path.dirname(nested_py),
            capture_output=True,
            text=True,
        )
        blob = (nested_run.stdout or "") + (nested_run.stderr or "")
        if "WRONG TREE" not in blob:
            raise SystemExit("FAIL nested serve.py must print WRONG TREE")
    live_wrong = subprocess.run(
        [sys.executable, os.path.join(HERE, "serve.py")],
        cwd=r"D:\StarqTech",
        capture_output=True,
        text=True,
    )
    if live_wrong.returncode != 2:
        raise SystemExit(f"FAIL live serve.py wrong cwd must exit 2, got {live_wrong.returncode}")
    if "WRONG CWD" not in ((live_wrong.stdout or "") + (live_wrong.stderr or "")):
        raise SystemExit("FAIL live serve.py wrong cwd must name WRONG CWD")
    ci_ev = {
        "id": "E-T-OCC-CI", "type": "PURCHASE", "ts": "2026-08-20T12:00:00+05:00",
        "fields": {"entity": "CI", "supplier": "CI Vendor Leak", "item": "cage", "amount": "1"},
    }
    st_ev = {
        "id": "E-T-OCC-ST", "type": "PURCHASE", "ts": "2026-08-20T12:00:00+05:00",
        "fields": {"entity": "STARQ", "supplier": "Starq Vendor Leak", "item": "licence", "amount": "1"},
    }
    orig_ops = S._ops_events
    S._ops_events = lambda: [ci_ev, st_ev]
    try:
        exp_ci_x = S.h_expenses({}, "CI", "", "")
        exp_st_x = S.h_expenses({}, "STARQ", "", "")
        if "Starq Vendor Leak" in exp_ci_x:
            raise SystemExit("FAIL Starq purchase on CI Expenses")
        if "CI Vendor Leak" in exp_st_x:
            raise SystemExit("FAIL CI purchase on Starq Expenses")
        if "Starq Vendor Leak" not in exp_st_x:
            raise SystemExit("FAIL Starq purchase missing from Starq Expenses")
        if "CI Vendor Leak" not in exp_ci_x:
            raise SystemExit("FAIL CI purchase missing from CI Expenses")
    finally:
        S._ops_events = orig_ops
    print("OK — ERP-shaped masters + v1 chrome on D:\\StarqTech\\the foundation engine")


if __name__ == "__main__":
    main()
