"""DEC-008 journal outbox — draft text from ops events.

Never writes journals/. Ali (ledger_poster) copies a draft into the entity
journal and runs `python books.py check`. A PURCHASE of a counted SKU that
already has unit cost drafts 1300; otherwise expense 5100. Never invent cost.
Leftover paint stays blocked. Ops never posts.
"""
from __future__ import annotations

import json
import os
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

HERE = os.path.dirname(os.path.abspath(__file__))
EVENTS = os.path.join(HERE, "ops", "events.jsonl")
INVENTORY = os.path.join(HERE, "ops", "masters", "inventory.json")
PRODUCTS = os.path.join(HERE, "ops", "masters", "products.json")
CATALOG = os.path.join(HERE, "ops", "catalog", "items.json")
ORGS = os.path.join(HERE, "ops", "masters", "organizations.json")
TAX = os.path.join(HERE, "ops", "masters", "tax.json")
POS_DRAFTS = os.path.join(HERE, "ops", "pos_drafts.jsonl")
ISSUED_LOG = os.path.join(HERE, "ops", "issued_documents.jsonl")

# Tests set this to a list so they never create ops/issued_documents.jsonl.
_ISSUED_ROWS = None

ISSUE_PO_SEATS = frozenset({
    "director", "financial_controller", "managing_director",
})
ISSUE_INV_SEATS = frozenset({
    "director", "financial_controller", "managing_director", "counter",
})
BILL_SEATS = frozenset({
    "director", "financial_controller", "payer", "managing_director",
})
INV_SEATS = ISSUE_INV_SEATS

COPY_INTO = {
    "STARQ": "journals/starq/",
    "CI": "journals/club-ignition/",
}
OCCUPANCY_LABEL = {
    "STARQ": "Starq",
    "CI": "Club Ignition",
}

LEFTOVER_KEYS = frozenset({
    "INK-PAINT-LEFT",
    "SKU-LEFTOVER-PAINT",
    "LEFTOVER",
    "RETAIL",
})

NO_GL = frozenset({
    "CALL", "BOOKING", "INTAKE", "ESTIMATE", "JOB_CARD",
    "WORK", "QC", "HANDOVER", "STOCK", "EXCEPTION",
    "auth.login", "auth.logout", "auth.denied",
})

CI_INCOME = frozenset({"4200", "4210", "4220", "4230"})
STARQ_INCOME = frozenset({"4100", "4110"})
STATION_INCOME = {
    "booth": "4200",
    "paint": "4200",
    "spec": "4200",
    "wrap": "4220",
    "wrap bay": "4220",
    "body": "4210",
    "detail": "4230",
    "detailing": "4230",
}

RECEIPT_DEBIT = {
    "rent": "6200",
    "electricity": "6210",
    "water": "6210",
    "purchase": "5100",
    "parts": "5100",
    "consumable": "5100",
    "fee": "6300",
    "other": "6900",
}


def _fields(ev: dict) -> dict:
    f = ev.get("fields")
    return f if isinstance(f, dict) else {}


def _val(ev: dict, key: str):
    f = _fields(ev)
    if f.get(key) not in (None, ""):
        return f.get(key)
    return ev.get(key)


def _valued_amount(ev: dict) -> Decimal | None:
    """Amount on the event, or qty × rate when both already exist. Never invents either."""
    amt = _amount(_val(ev, "amount"))
    if amt is not None:
        return amt
    rate = _amount(_val(ev, "rate"))
    qty = _amount(_val(ev, "qty"))
    if rate is not None and qty is not None:
        return qty * rate
    return None


MONEY_CODES = frozenset({"1110", "1120", "1121", "1125"})
CASH_WALLET = {
    "cash": "1110",
    "1110": "1110",
    "petty": "1110",
    "petty cash": "1110",
    "cash on hand": "1110",
    "1125": "1125",
    "bandeyri": "1125",
    "wallet": "1125",
    "bandeyri pay": "1125",
}
MIB_INTENT = frozenset({
    "1120", "1121", "mib", "mib mvr", "mib usd", "transfer", "bank",
    "bank transfer", "iban",
})


def _org_money_status(occ: str) -> dict[str, str]:
    """Cash/bank codes and statuses from the occupancy org record. Never invents openings."""
    out: dict[str, str] = {}
    if not os.path.isfile(ORGS):
        return out
    try:
        with open(ORGS, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return out
    want = "STARQ" if occ == "STARQ" else "CI"
    for org in data.get("organizations") or []:
        if not isinstance(org, dict) or org.get("entity") != want:
            continue
        for row in list(org.get("cash_accounts") or []) + list(org.get("bank_accounts") or []):
            if not isinstance(row, dict):
                continue
            code = str(row.get("code") or "").strip()
            if code:
                out[code] = str(row.get("status") or "").strip()
        break
    return out


def _cash_wallet_or_block(ev: dict, occ: str) -> tuple[str | None, str | None]:
    """Named open cash/wallet only. MIB/transfer stays not_opened. Unnamed → (None, None)."""
    raw = str(
        _val(ev, "account")
        or _val(ev, "cash_account")
        or _val(ev, "bank_account")
        or _val(ev, "tender")
        or ""
    ).strip().lower()
    if not raw:
        return None, None
    if raw in MIB_INTENT or raw in ("1120", "1121"):
        code = "1121" if raw in ("1121", "mib usd") else "1120"
        st = _org_money_status(occ).get(code) or "not_opened"
        return None, (
            f"{code} is {st} on this occupancy. Will not invent a bank statement or opening."
        )
    code = CASH_WALLET.get(raw)
    if raw in MONEY_CODES:
        code = raw
    if code is None:
        return None, f"Unknown cash/bank {raw!r}. Will not invent an account."
    if code in ("1120", "1121"):
        st = _org_money_status(occ).get(code) or "not_opened"
        return None, (
            f"{code} is {st} on this occupancy. Will not invent a bank statement or opening."
        )
    st = _org_money_status(occ).get(code)
    if st != "open":
        return None, (
            f"{code} is {st or 'missing'} on this occupancy. Will not invent a cash balance."
        )
    return code, None


def _ar_or_cash(ev: dict, occ: str) -> tuple[str | None, str | None]:
    """1110/1125 only when the event already names an open cash/wallet. Transfer stays 1200."""
    money, err = _cash_wallet_or_block(ev, occ)
    if err:
        return None, err
    if money:
        return money, None
    return "1200", None


def _product_income(sku: str) -> str:
    sku_u = (sku or "").strip().upper()
    if not sku_u or not os.path.isfile(PRODUCTS):
        return ""
    try:
        with open(PRODUCTS, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return ""
    for p in data.get("products") or []:
        if isinstance(p, dict) and str(p.get("sku") or "").strip().upper() == sku_u:
            return str(p.get("income_account") or "").strip()
    return ""


def _resolve_income(ev: dict, occ: str) -> tuple[str | None, str | None]:
    """Occupancy-correct income. CI 4200–4230 / Starq 4110 (8211) or 4100 (6201). Never 4300."""
    if _is_leftover(ev):
        return None, "4300 / leftover paint is not product (DEC-023)."
    raw = str(_val(ev, "income_account") or "").strip()
    sku = str(_val(ev, "sku") or "").strip()
    from_sku = _product_income(sku)
    station = str(_val(ev, "station") or "").strip().lower()
    from_station = STATION_INCOME.get(station)
    if occ == "STARQ":
        acct = raw or from_sku or "4110"
        if acct == "4300" or acct in CI_INCOME:
            return None, "Starq occupancy credits 4110 (BN 8211) or 4100 (6201). Not garage 42xx / 4300."
        if acct not in STARQ_INCOME:
            return None, f"Unknown Starq income {acct!r}. Will not invent an account."
        gate = income_credit_gate(acct, occ)
        if gate:
            return None, gate
        return acct, None
    acct = raw or from_sku or from_station or "4200"
    if acct == "4300":
        return None, "4300 blocked (DEC-023)."
    if acct in STARQ_INCOME:
        return None, "Garage 4520 uses 4200–4230. Not Starq 4100/4110."
    if acct not in CI_INCOME:
        return None, f"Unknown garage income {acct!r}. Will not invent 42xx split."
    gate = income_credit_gate(acct, occ)
    if gate:
        return None, gate
    return acct, None


def _job_key(ev: dict) -> str:
    return str(ev.get("job_no") or _val(ev, "job_no") or "").strip().upper()


def _close_amount(ev: dict) -> tuple[Decimal | None, str]:
    """CLOSE may reuse ESTIMATE amount already on the job. Never invent. Never double INVOICE_PAYMENT."""
    amt = _valued_amount(ev)
    if amt is not None:
        return amt, "self"
    if (ev.get("type") or "") != "CLOSE":
        return None, "missing"
    job = _job_key(ev)
    if not job:
        return None, "missing"
    invoice = None
    estimate = None
    for other in load_events():
        if _job_key(other) != job or other.get("id") == ev.get("id"):
            continue
        a = _valued_amount(other)
        if a is None:
            continue
        t = other.get("type") or ""
        if t == "INVOICE_PAYMENT":
            invoice = a
        elif t == "ESTIMATE":
            estimate = a
    if invoice is not None:
        return None, "on_invoice"
    if estimate is not None:
        return estimate, "estimate"
    return None, "missing"


def _amount(raw) -> Decimal | None:
    if raw in (None, "", "-"):
        return None
    try:
        return Decimal(str(raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None


def _date(ev: dict) -> str:
    ts = str(ev.get("ts") or "")
    return ts[:10] if len(ts) >= 10 else "YYYY-MM-DD"


def _fmt(amount: Decimal) -> str:
    return f"{amount:,.2f}"


def live_invoice_rate() -> Decimal:
    """From tax.json. GST not Active → 0. Never invents 8."""
    status = "not_registered"
    raw = 0
    if os.path.isfile(TAX):
        try:
            with open(TAX, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                status = str(data.get("gst_status") or status).strip().lower()
                raw = data.get("live_invoice_rate", 0)
        except (OSError, json.JSONDecodeError):
            pass
    if status not in ("active",):
        return Decimal("0")
    amt = _amount(raw)
    return amt if amt is not None else Decimal("0")


def rate_on(supply_date: date, code: str = "DEFAULT") -> Decimal:
    """Resolve date-effective tax rate from masters/tax.json by time of supply."""
    if not os.path.isfile(TAX):
        return Decimal("0")
    try:
        with open(TAX, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return Decimal("0")

    target_code = str(code or "DEFAULT").strip().upper()
    codes = data.get("codes", []) if isinstance(data, dict) else []

    for c in codes:
        c_code = str(c.get("code") or c.get("id") or "").strip().upper()
        if target_code != "DEFAULT" and c_code != target_code:
            continue
        v_from_str = c.get("valid_from")
        v_to_str = c.get("valid_to")
        v_from = date.fromisoformat(v_from_str) if v_from_str else date.min
        v_to = date.fromisoformat(v_to_str) if v_to_str else date.max
        if v_from <= supply_date <= v_to:
            amt = _amount(c.get("rate", 0))
            return amt if amt is not None else Decimal("0")

    return Decimal("0")


def rate_for_supply(supply_date: date, code: str = "DEFAULT") -> Decimal:
    """MIRA time-of-supply rate resolution."""
    return rate_on(supply_date, code)


def tax_master_line() -> str:
    rate = live_invoice_rate()
    status = "not_registered"
    if os.path.isfile(TAX):
        try:
            with open(TAX, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                status = str(data.get("gst_status") or status)
        except (OSError, json.JSONDecodeError):
            pass
    return f"Tax: {rate} (tax master). GST {status}."


def _posted_tax(ev: dict) -> Decimal | None:
    for key in ("tax_rate", "gst_rate", "gst", "tax"):
        raw = _val(ev, key)
        if raw in (None, ""):
            continue
        s = str(raw).strip().lower()
        if s in ("none", "n/a", "na", "zero"):
            return Decimal("0")
        s = s.replace("%", "").strip()
        amt = _amount(s)
        if amt is None:
            continue
        if amt > Decimal("0") and amt < Decimal("1"):
            return amt * Decimal("100")
        return amt
    return None


def _gst_posted_block(ev: dict) -> str | None:
    posted = _posted_tax(ev)
    if posted is None:
        return None
    live = live_invoice_rate()
    if posted != live:
        return (
            f"GST not Active on tax master. Live invoice rate is {live}. "
            "Posted tax refused. Will not invent GST."
        )
    return None


def occupancy_of(ev: dict) -> str:
    """Starq vs Club Ignition. Garage ops default CI. Do not guess a third org."""
    raw = str(_val(ev, "entity") or ev.get("entity") or "").strip().upper().replace("_", "-")
    if raw in ("STARQ", "ST"):
        return "STARQ"
    if raw in ("CI", "CLUB-IGNITION"):
        return "CI"
    item_id = str(_val(ev, "item_id") or "").strip()
    cat = _catalog_entity(item_id)
    if cat in ("STARQ", "CI"):
        return cat
    sku = str(_val(ev, "sku") or "").strip().upper()
    if sku.startswith("ST-"):
        return "STARQ"
    if sku.startswith("INK-"):
        return "CI"
    kind = str(_val(ev, "kind") or "").strip().lower()
    if kind in ("rent", "electricity", "water", "parts", "purchase", "consumable", "pos_consume"):
        return "CI"
    return "CI"


def _catalog_entity(item_id: str) -> str | None:
    if not item_id or not os.path.isfile(CATALOG):
        return None
    try:
        with open(CATALOG, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    for it in data.get("items") or []:
        if isinstance(it, dict) and str(it.get("id") or "") == item_id:
            ent = it.get("entity")
            return ent if ent in ("STARQ", "CI") else None
    return None


def _entry(date: str, narration: str, debit: str, credit: str, amount: Decimal, memo: str,
           occupancy: str = "CI") -> str:
    token = "STARQ" if occupancy == "STARQ" else "CI"
    return (
        f'{date} {token} "{narration}"\n'
        f"  {debit}    {_fmt(amount)}   # {memo}\n"
        f"  {credit}   -{_fmt(amount)}\n"
    )


def _finish(row: dict, occupancy: str, debit: str = "", credit: str = "") -> dict:
    occ = occupancy if occupancy in ("STARQ", "CI") else "CI"
    draft = row.get("draft") or ""
    copy_ready = row.get("status") == "draft" and bool(str(draft).strip())
    accounts = [c for c in (debit, credit) if c]
    row["occupancy"] = occ
    row["occupancy_label"] = OCCUPANCY_LABEL[occ]
    row["debit"] = debit
    row["credit"] = credit
    row["accounts"] = accounts
    row["accounts_s"] = " ".join(accounts)
    row["copy_into"] = COPY_INTO[occ] if copy_ready else ""
    row["copy_ready"] = copy_ready
    row["banking"] = any(c in MONEY_CODES for c in accounts)
    if row.get("document") and row.get("doc_issued"):
        row["doc_unissued"] = False
    elif row.get("document") and not row.get("doc_unissued"):
        row["doc_unissued"] = True
    return row


def load_issued() -> list[dict]:
    if _ISSUED_ROWS is not None:
        return list(_ISSUED_ROWS)
    if not os.path.isfile(ISSUED_LOG):
        return []
    rows = []
    with open(ISSUED_LOG, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict):
                rows.append(row)
    return rows


def _issued_for(event_id: str, kind: str) -> dict | None:
    eid = str(event_id or "")
    want = str(kind or "").upper()
    if not eid or want not in ("PO", "INV", "QUO"):
        return None
    for row in load_issued():
        if str(row.get("event_id") or "") == eid and str(row.get("kind") or "").upper() == want:
            return row
    return None


def _issued_match(kind: str, occupancy: str, *, event_id: str = "",
                  number: str = "") -> tuple[dict | None, str | None]:
    """Issued PO/INV on this occupancy only. Cross-occupancy is a refuse, not a guess."""
    want = str(kind or "").upper()
    occ = str(occupancy or "").strip().upper()
    eid = str(event_id or "").strip()
    num = str(number or "").strip()
    if want not in ("PO", "INV") or occ not in ("STARQ", "CI"):
        return None, "Occupancy required."
    if not eid and not num:
        return None, None
    other = None
    for row in load_issued():
        if str(row.get("kind") or "").upper() != want:
            continue
        hit = False
        if eid and str(row.get("event_id") or "") == eid:
            hit = True
        if num and str(row.get("number") or "") == num:
            hit = True
        if not hit:
            continue
        row_occ = str(row.get("occupancy") or "").upper()
        if row_occ == occ:
            return row, None
        other = row_occ
    if other:
        return None, f"{want} occupancy is {other}, not {occ}."
    return None, None


INVOICE_SETTLE_KINDS = frozenset({"invoice", "inv", "sale"})


def _is_invoice_settle(ev: dict) -> bool:
    kind = str(_val(ev, "kind") or "").strip().lower()
    if kind in INVOICE_SETTLE_KINDS:
        return True
    if _val(ev, "invoice_event_id") or _val(ev, "inv_event_id"):
        return True
    if _val(ev, "inv_number") or _val(ev, "invoice_number"):
        return True
    return False


def _issued_po_for_receive(ev: dict, occ: str) -> tuple[dict | None, str | None]:
    eid = str(_val(ev, "po_event_id") or _val(ev, "award_event_id") or "").strip()
    num = str(_val(ev, "po_number") or _val(ev, "po") or "").strip()
    rec, err = _issued_match("PO", occ, event_id=eid, number=num)
    if err:
        return None, err
    if rec:
        return rec, None
    return None, (
        "GRN only against an issued PO on this occupancy. "
        "Need po_event_id or po_number of an issued PO. Will not invent a receipt."
    )


def _issued_inv_for_settle(ev: dict, occ: str) -> tuple[dict | None, str | None]:
    eid = str(_val(ev, "invoice_event_id") or _val(ev, "inv_event_id") or "").strip()
    num = str(_val(ev, "inv_number") or _val(ev, "invoice_number") or "").strip()
    rec, err = _issued_match("INV", occ, event_id=eid, number=num)
    if err:
        return None, err
    if rec:
        return rec, None
    return None, (
        "Payment/receipt only against an issued INV on this occupancy. "
        "Need invoice_event_id or inv_number of an issued INV. Will not invent 1110."
    )


def may_capture_bill(seat: str, occupancy: str | None) -> bool:
    return occupancy in ("STARQ", "CI") and seat in BILL_SEATS


def may_capture_invoice(seat: str, occupancy: str | None) -> bool:
    return occupancy in ("STARQ", "CI") and seat in INV_SEATS


def _org_dict(occupancy: str, orgs=None) -> dict | None:
    occ = str(occupancy or "").strip().upper()
    rows = orgs
    if rows is None:
        if not os.path.isfile(ORGS):
            return None
        try:
            with open(ORGS, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            return None
        rows = data.get("organizations") if isinstance(data, dict) else None
    if isinstance(rows, dict):
        rows = rows.get("organizations")
    for org in rows or []:
        if isinstance(org, dict) and str(org.get("entity") or "").strip().upper() == occ:
            return org
    return None


def income_credit_gate(acct: str, occupancy: str, *, accounts: dict | None = None,
                       orgs=None) -> str | None:
    """Refuse live income credit when CoA or BAR on disk still forbids it.

    Never invents BAR clearance. 4110 needs Starq Dynamics 8211 + a BAR on
    the occupancy org master *and* accounts.csv not blocked.
    """
    occ = str(occupancy or "").strip().upper()
    code = str(acct or "").strip()
    if occ not in ("STARQ", "CI"):
        return "Pick Starq or Club Ignition occupancy. Group is not a company."
    if not code:
        return "Income account required. Will not invent one."
    if accounts is None:
        import books as B
        accounts = B.load_accounts()
    acc = accounts.get(code) if isinstance(accounts, dict) else None
    if not isinstance(acc, dict):
        return f"{code} is not in accounts.csv. Will not invent an income account."
    if str(acc.get("status") or "active").strip().lower() == "blocked":
        return (
            f"{code} is BLOCKED on accounts.csv. "
            "Will not invent BAR clearance or credit it."
        )
    note = str(acc.get("note") or "")
    note_l = note.lower()
    if "blocked" in note_l and "unblocked" not in note_l:
        return (
            f"{code} is still blocked on the CoA note. "
            "Will not invent BAR clearance."
        )
    org = _org_dict(occ, orgs)
    if not org:
        return f"No organization master for {occ}. Will not invent a BAR."
    if code == "4110":
        ok = False
        for bn in org.get("business_names") or []:
            if not isinstance(bn, dict):
                continue
            isic = str(bn.get("isic") or "").strip()
            bar = bn.get("bar")
            incomes = [str(x) for x in (bn.get("income_accounts") or [])]
            if isic == "8211" and bar not in (None, "") and "4110" in incomes:
                ok = True
                break
        if not ok:
            return (
                "4110 is Starq Dynamics 8211. BAR/8211 is not on this occupancy org master "
                "(or is still empty). Will not invent BAR clearance. Do not credit 4110."
            )
    if code == "4100":
        cbar = org.get("company_bar") if isinstance(org.get("company_bar"), dict) else {}
        isic = str(cbar.get("isic") or "").strip()
        bp = cbar.get("bp")
        incomes = [str(x) for x in (cbar.get("income_accounts") or [])]
        if isic != "6201" or bp in (None, "") or "4100" not in incomes:
            return (
                "4100 is company 6201. Company BAR is not on this occupancy org master. "
                "Will not invent BAR clearance."
            )
    if code in CI_INCOME:
        ok = False
        for bn in org.get("business_names") or []:
            if not isinstance(bn, dict):
                continue
            isic = str(bn.get("isic") or "").strip()
            bar = bn.get("bar")
            incomes = [str(x) for x in (bn.get("income_accounts") or [])]
            if isic == "4520" and bar not in (None, "") and code in incomes:
                ok = True
                break
        if not ok:
            return (
                f"{code} needs Club Ignition 4520 BAR on the occupancy org master. "
                "Will not invent BAR clearance."
            )
    return None


def occupancy_vendors(occupancy: str, *, contacts: list[dict] | None = None,
                      events: list[dict] | None = None) -> list[dict]:
    """Vendor contacts if they exist, else name strings already on ops. Never invent."""
    occ = str(occupancy or "").strip().upper()
    if occ not in ("STARQ", "CI"):
        return []
    import masters as M
    rows: list[dict] = []
    seen: set[str] = set()
    src = contacts if contacts is not None else M.contacts(occ)
    for c in src:
        if not isinstance(c, dict):
            continue
        if str(c.get("entity") or "").strip().upper() != occ:
            continue
        kind = str(c.get("kind") or "").strip().lower()
        if kind not in ("vendor", "supplier"):
            continue
        name = str(c.get("name") or "").strip()
        if not name or "@" in name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "source": "contact",
            "contact_id": str(c.get("id") or "").strip(),
            "name": name,
            "occupancy": occ,
        })
    if rows:
        return rows
    evs = events if events is not None else load_events()
    for ev in evs:
        if occupancy_of(ev) != occ:
            continue
        if _is_leftover(ev):
            continue
        blob = " ".join(
            str(x) for x in (ev.get("summary"), ev.get("actor"), ev.get("type")) if x
        ).lower()
        if any(n in blob for n in M._SKIP_CONTACT):
            continue
        name = str(_val(ev, "supplier") or _val(ev, "vendor") or "").strip()
        if not name or "@" in name:
            continue
        if any(n in name.lower() for n in M._SKIP_CONTACT):
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "source": "ops",
            "contact_id": "",
            "name": name,
            "occupancy": occ,
        })
    return rows


def resolve_vendor(occupancy: str, *, contact_id: str = "", vendor_name: str = "",
                   contacts: list[dict] | None = None,
                   events: list[dict] | None = None) -> tuple[dict | None, str | None]:
    vendors = occupancy_vendors(occupancy, contacts=contacts, events=events)
    if not vendors:
        return None, (
            "No occupancy vendor. Add a vendor contact, or use a name already on ops. "
            "Will not invent a vendor."
        )
    cid = str(contact_id or "").strip()
    name = str(vendor_name or "").strip()
    if cid:
        for v in vendors:
            if v.get("contact_id") == cid:
                return v, None
        return None, "contact_id is not a vendor on this occupancy. Will not invent a vendor."
    if name:
        for v in vendors:
            if v["name"].casefold() == name.casefold():
                return v, None
        return None, "Vendor name is not on this occupancy. Will not invent a vendor."
    return None, "Vendor required. Contact if exists, else ops name. Will not invent a vendor."


def prepare_supplier_bill(form: dict, *, occupancy: str, seat: str,
                          contacts: list[dict] | None = None,
                          events: list[dict] | None = None,
                          issued: list[dict] | None = None) -> tuple[dict | None, str | None]:
    """Authorised seat + typed amount + occupancy vendor. Optional issued PO. Never invents."""
    form = form if isinstance(form, dict) else {}
    occ = str(occupancy or form.get("entity") or "").strip().upper()
    if occ not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy. Group is not a company."
    if not may_capture_bill(seat, occ):
        return None, "Seat cannot type a supplier bill amount."
    probe = {"type": "BILL", "fields": form}
    if _is_leftover(probe):
        return None, "4300 / leftover paint is not product (DEC-023)."
    amt = _amount(form.get("amount"))
    if amt is None:
        return None, "Amount required. Type a real figure. Will not invent one."
    gst = _gst_posted_block(probe)
    if gst:
        return None, gst
    vendor, verr = resolve_vendor(
        occ,
        contact_id=str(form.get("contact_id") or ""),
        vendor_name=str(form.get("vendor") or form.get("supplier") or ""),
        contacts=contacts,
        events=events,
    )
    if verr or not vendor:
        return None, verr or "Vendor required. Will not invent a vendor."
    po_eid = str(form.get("po_event_id") or "").strip()
    po_num = str(form.get("po_number") or "").strip()
    rec = None
    if po_eid or po_num:
        rec, err = _issued_po_for_bill(occ, po_eid, po_num, issued=issued)
        if err:
            return None, err
        if not rec:
            return None, (
                "Optional PO link only against an issued PO on this occupancy. "
                "issued=0 is empty honest. Will not invent a PO."
            )
    fields = {
        "entity": occ,
        "kind": "supplier_bill",
        "amount": str(amt),
        "vendor": vendor["name"],
        "supplier": vendor["name"],
        "tax_rate": str(live_invoice_rate()),
    }
    if vendor.get("contact_id"):
        fields["contact_id"] = vendor["contact_id"]
    item = str(form.get("item") or "").strip()
    if item:
        fields["item"] = item
    sku = str(form.get("sku") or "").strip()
    if sku:
        fields["sku"] = sku
    if rec:
        fields["po_event_id"] = str(rec.get("event_id") or po_eid)
        fields["po_number"] = str(rec.get("number") or po_num)
    return fields, None


def _issued_po_for_bill(occ: str, event_id: str, number: str,
                        issued: list[dict] | None = None) -> tuple[dict | None, str | None]:
    global _ISSUED_ROWS
    orig = _ISSUED_ROWS
    if issued is not None:
        _ISSUED_ROWS = list(issued)
    try:
        rec, err = _issued_match("PO", occ, event_id=event_id, number=number)
        if err:
            return None, err
        if rec:
            return rec, None
        return None, (
            "Optional PO link only against an issued PO on this occupancy. "
            "issued=0 is empty honest. Will not invent a PO."
        )
    finally:
        if issued is not None:
            _ISSUED_ROWS = orig


def occupancy_customers(occupancy: str, *, contacts: list[dict] | None = None,
                        events: list[dict] | None = None) -> list[dict]:
    """Customer contacts if they exist, else name strings already on ops. Never invent."""
    occ = str(occupancy or "").strip().upper()
    if occ not in ("STARQ", "CI"):
        return []
    import masters as M
    rows: list[dict] = []
    seen: set[str] = set()
    src = contacts if contacts is not None else M.contacts(occ)
    for c in src:
        if not isinstance(c, dict):
            continue
        if str(c.get("entity") or "").strip().upper() != occ:
            continue
        kind = str(c.get("kind") or "").strip().lower()
        if kind not in ("customer",):
            continue
        name = str(c.get("name") or "").strip()
        if not name or "@" in name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "source": "contact",
            "contact_id": str(c.get("id") or "").strip(),
            "name": name,
            "occupancy": occ,
        })
    if rows:
        return rows
    evs = events if events is not None else load_events()
    for ev in evs:
        if occupancy_of(ev) != occ:
            continue
        if _is_leftover(ev):
            continue
        blob = " ".join(
            str(x) for x in (ev.get("summary"), ev.get("actor"), ev.get("type")) if x
        ).lower()
        if any(n in blob for n in M._SKIP_CONTACT):
            continue
        name = str(_val(ev, "customer") or "").strip()
        if not name or "@" in name:
            continue
        if any(n in name.lower() for n in M._SKIP_CONTACT):
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "source": "ops",
            "contact_id": "",
            "name": name,
            "occupancy": occ,
        })
    return rows


def resolve_customer(occupancy: str, *, contact_id: str = "", customer_name: str = "",
                     contacts: list[dict] | None = None,
                     events: list[dict] | None = None) -> tuple[dict | None, str | None]:
    customers = occupancy_customers(occupancy, contacts=contacts, events=events)
    if not customers:
        return None, (
            "No occupancy customer. Add a customer contact, or use a name already on ops. "
            "Will not invent a customer."
        )
    cid = str(contact_id or "").strip()
    name = str(customer_name or "").strip()
    if cid:
        for c in customers:
            if c.get("contact_id") == cid:
                return c, None
        return None, "contact_id is not a customer on this occupancy. Will not invent a customer."
    if name:
        for c in customers:
            if c["name"].casefold() == name.casefold():
                return c, None
        return None, "Customer name is not on this occupancy. Will not invent a customer."
    return None, "Customer required. Contact if exists, else ops name. Will not invent a customer."


def prepare_customer_invoice(form: dict, *, occupancy: str, seat: str,
                             contacts: list[dict] | None = None,
                             events: list[dict] | None = None,
                             accounts: dict | None = None,
                             orgs=None) -> tuple[dict | None, str | None]:
    """Authorised seat + typed amount + occupancy customer. AR 1200. Never invents.
    Issue is a separate click. issued stays 0 until then."""
    form = form if isinstance(form, dict) else {}
    occ = str(occupancy or form.get("entity") or "").strip().upper()
    if occ not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy. Group is not a company."
    if not may_capture_invoice(seat, occ):
        return None, "Seat cannot type a customer invoice amount."
    probe = {"type": "INVOICE", "fields": form}
    if _is_leftover(probe):
        return None, "4300 / leftover paint is not product (DEC-023)."
    amt = _amount(form.get("amount"))
    if amt is None:
        return None, "Amount required. Type a real figure. Will not invent one."
    gst = _gst_posted_block(probe)
    if gst:
        return None, gst
    customer, cerr = resolve_customer(
        occ,
        contact_id=str(form.get("contact_id") or ""),
        customer_name=str(form.get("customer") or ""),
        contacts=contacts,
        events=events,
    )
    if cerr or not customer:
        return None, cerr or "Customer required. Will not invent a customer."
    acct, why = _resolve_income(probe, occ)
    if acct is None:
        return None, why or "Income account refused. Will not invent one."
    extra = income_credit_gate(acct, occ, accounts=accounts, orgs=orgs)
    if extra:
        return None, extra
    fields = {
        "entity": occ,
        "kind": "customer_invoice",
        "amount": str(amt),
        "customer": customer["name"],
        "tax_rate": str(live_invoice_rate()),
        "income_account": acct,
    }
    if customer.get("contact_id"):
        fields["contact_id"] = customer["contact_id"]
    item = str(form.get("item") or "").strip()
    if item:
        fields["item"] = item
    sku = str(form.get("sku") or "").strip()
    if sku:
        fields["sku"] = sku
    return fields, None


def grn_qty_plan(ev: dict) -> dict:
    """Counted path bump vs Products count link. Never invents opening qty."""
    qty = _amount(_val(ev, "qty"))
    sku = str(_val(ev, "sku") or _val(ev, "item") or "").strip()
    if qty is None:
        return {
            "action": "refuse_qty",
            "sku": sku,
            "note": "Qty missing on receive. Will not invent it.",
        }
    if _is_leftover(ev):
        return {
            "action": "blocked",
            "sku": sku,
            "note": "4300 / leftover paint is not product (DEC-023).",
        }
    stock = _matched_stock(ev)
    if not stock:
        return {
            "action": "none",
            "sku": sku,
            "note": "No inventory SKU on this event. GRN text only. Will not invent a stock line.",
        }
    sku = str(stock.get("sku") or sku).strip()
    st = stock.get("qty_status")
    if st in ("not_for_sale",):
        return {
            "action": "blocked",
            "sku": sku,
            "note": "Leftover / not for sale. Will not bump qty.",
        }
    if st == "service":
        return {
            "action": "none",
            "sku": sku,
            "note": "Service SKU. No qty bump.",
        }
    if st != "counted" or stock.get("qty") in (None, ""):
        return {
            "action": "count_link",
            "sku": sku,
            "note": (
                f"{sku} not_counted. Count on Products. "
                "Will not invent opening qty."
            ),
        }
    return {
        "action": "bump",
        "sku": sku,
        "qty": qty,
        "on_hand": stock.get("qty"),
        "note": f"Counted path {sku}. Qty bump +{qty} (not posted, not a journal).",
    }


def preview_next(occ: str, kind: str) -> dict:
    kind = str(kind or "").upper()
    if kind == "PO":
        key = "purchase_order"
    elif kind == "QUO":
        key = "quotation"
    else:
        key = "invoice"
    seq = _sequence(occ, key)
    prefix = str(seq.get("prefix") or "")
    nxt = seq.get("next")
    shown = f"{prefix}{nxt}" if prefix and nxt not in (None, "") else ""
    return {
        "prefix": prefix,
        "next": nxt,
        "issued": seq.get("issued", 0),
        "shown": shown,
    }


def _append_issued(row: dict) -> None:
    if _ISSUED_ROWS is not None:
        _ISSUED_ROWS.append(row)
        return
    with open(ISSUED_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _allocate_sequence(occ: str, key: str) -> tuple[dict | None, str | None]:
    """Increment issued + next for this occupancy only. Never journals/."""
    want = "STARQ" if occ == "STARQ" else "CI"
    if not os.path.isfile(ORGS):
        return None, "No organization master."
    try:
        with open(ORGS, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None, "Organization master unreadable."
    seq_row = None
    for org in data.get("organizations") or []:
        if isinstance(org, dict) and org.get("entity") == want:
            seqs = org.setdefault("sequences", {})
            cand = seqs.get(key)
            if isinstance(cand, dict):
                seq_row = cand
            break
    if not isinstance(seq_row, dict):
        return None, "No sequence for this occupancy."
    prefix = str(seq_row.get("prefix") or "")
    try:
        nxt_i = int(seq_row.get("next"))
    except (TypeError, ValueError):
        return None, "Sequence next is not a number."
    if not prefix:
        return None, "Sequence prefix missing."
    number = f"{prefix}{nxt_i}"
    seq_row["issued"] = int(seq_row.get("issued") or 0) + 1
    seq_row["next"] = nxt_i + 1
    tmp = ORGS + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, ORGS)
    return {
        "number": number,
        "prefix": prefix,
        "n": nxt_i,
        "issued": seq_row["issued"],
        "next": seq_row["next"],
    }, None


def _document_amount(ev: dict) -> Decimal | None:
    amt = _valued_amount(ev)
    if amt is not None:
        return amt
    if (ev.get("type") or "") == "CLOSE":
        got, src = _close_amount(ev)
        if src == "on_invoice":
            return None
        return got
    return None


def issue_seats(kind: str) -> frozenset:
    kind = str(kind or "").upper()
    if kind == "PO":
        return ISSUE_PO_SEATS
    return ISSUE_INV_SEATS


def _optional_contact(contact_id: str, occupancy: str) -> tuple[dict | None, str | None]:
    """Link only if the occupancy master already has that row. Never creates one."""
    cid = str(contact_id or "").strip()
    if not cid:
        return None, None
    import masters as M
    row = M.contact_on_occupancy(cid, occupancy)
    if row is None:
        return None, (
            "contact_id is not on this occupancy master. "
            "Will not create a contact to satisfy the link."
        )
    return row, None


def issue_document(*, event_id: str, kind: str, occupancy: str, seat: str,
                   person_id: str, contact_id: str = "") -> tuple[dict | None, str | None]:
    """Allocate a PO/INV/QUO number. Award itself never calls this. Never journals/."""
    kind = str(kind or "").upper()
    occ = str(occupancy or "").strip().upper()
    if kind not in ("PO", "INV", "QUO"):
        return None, "Unknown document kind."
    if occ not in ("STARQ", "CI"):
        return None, "Occupancy required."
    if seat not in issue_seats(kind):
        return None, "Seat cannot issue this document."
    eid = str(event_id or "").strip()
    if not eid:
        return None, "Event id required."
    if _issued_for(eid, kind):
        return None, "Already issued."
    ev = None
    for row in load_events():
        if str(row.get("id") or "") == eid:
            ev = row
            break
    if ev is None:
        return None, "Unknown ops event."
    if occupancy_of(ev) != occ:
        return None, "Occupancy mismatch."
    if _is_leftover(ev):
        return None, "4300 / leftover paint is not product (DEC-023)."
    gst_err = _gst_posted_block(ev)
    if gst_err:
        return None, gst_err
    contact, cerr = _optional_contact(contact_id, occ)
    if cerr:
        return None, cerr
    proposal = propose_one(ev)
    if not proposal or proposal.get("doc_kind") != kind:
        return None, "Event has no PO/INV/QUO document."
    if proposal.get("status") != "draft":
        return None, "Amount missing on ops. Will not invent a figure."
    amt = _document_amount(ev)
    if amt is None:
        return None, "Amount missing on ops. Will not invent a figure."
    if kind == "PO":
        key = "purchase_order"
    elif kind == "QUO":
        key = "quotation"
    else:
        key = "invoice"
    allocated, err = _allocate_sequence(occ, key)
    if err:
        return None, err
    rec = {
        "event_id": eid,
        "kind": kind,
        "occupancy": occ,
        "number": allocated["number"],
        "prefix": allocated["prefix"],
        "issued": allocated["issued"],
        "next": allocated["next"],
        "amount": str(amt),
        "tax": str(live_invoice_rate()),
        "contact_id": (contact or {}).get("id") or "",
        "contact_name": (contact or {}).get("name") or "",
        "seat": seat,
        "person_id": person_id,
        "issued_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
    }
    _append_issued(rec)
    return rec, None


def may_issue(proposal: dict | None, seat: str, occupancy: str) -> bool:
    if not isinstance(proposal, dict):
        return False
    if proposal.get("doc_issued"):
        return False
    kind = proposal.get("doc_kind")
    if kind not in ("PO", "INV", "QUO"):
        return False
    if proposal.get("occupancy") != occupancy:
        return False
    if proposal.get("status") != "draft":
        return False
    return seat in issue_seats(kind)


def _org_letterhead(occ: str) -> dict | None:
    """Letterhead from the occupancy org master. Never invents TIN/GST numbers."""
    import masters as M
    org = M.org_for_entity(occ)
    if not isinstance(org, dict):
        return None
    bns = []
    for bn in org.get("business_names") or []:
        if isinstance(bn, dict) and (bn.get("name") or bn.get("bn")):
            bns.append({
                "name": str(bn.get("name") or ""),
                "bn": str(bn.get("bn") or ""),
            })
    tin = org.get("tin")
    gst_no = org.get("gst_number")
    return {
        "legal_name": str(org.get("legal_name") or ""),
        "registry_c": str(org.get("registry_c") or ""),
        "gst_status": str(org.get("gst_status") or "not_registered"),
        "tin": "" if tin in (None, "") else str(tin),
        "gst_number": "" if gst_no in (None, "") else str(gst_no),
        "currency": str(org.get("base_currency") or "MVR"),
        "business_names": bns,
    }


def _print_party(kind: str, ev: dict, rec: dict | None) -> str:
    if rec:
        name = str(rec.get("contact_name") or "").strip()
        if name:
            return name
    if kind == "INV":
        return str(_val(ev, "customer") or "").strip()
    if kind == "QUO":
        return str(_val(ev, "customer") or "").strip()
    return str(_val(ev, "supplier") or _val(ev, "vendor") or "").strip()


def print_payload(*, event_id: str, kind: str, occupancy: str) -> tuple[dict | None, str | None]:
    """HTML-print facts only. Local. Never allocates. Never invents amount/party. Never journals/."""
    kind = str(kind or "").upper()
    occ = str(occupancy or "").strip().upper()
    if kind not in ("PO", "INV", "QUO"):
        return None, "Unknown document kind."
    if occ not in ("STARQ", "CI"):
        return None, "Occupancy required."
    eid = str(event_id or "").strip()
    if not eid:
        return None, "Event id required."
    ev = None
    for row in load_events():
        if str(row.get("id") or "") == eid:
            ev = row
            break
    if ev is None:
        return None, "Unknown ops event."
    if occupancy_of(ev) != occ:
        return None, "Occupancy mismatch."
    if _is_leftover(ev):
        return None, "4300 / leftover paint is not product (DEC-023)."
    gst_err = _gst_posted_block(ev)
    if gst_err:
        return None, gst_err
    proposal = propose_one(ev)
    if not proposal or proposal.get("doc_kind") != kind:
        return None, "Event has no PO/INV/QUO document."
    amt = _document_amount(ev)
    rec = _issued_for(eid, kind)
    party = _print_party(kind, ev, rec)
    if amt is None or not party:
        return None, "Amount or customer missing on ops. Will not invent."
    head = _org_letterhead(occ)
    if not head or not head.get("legal_name"):
        return None, "No organization letterhead on this occupancy."
    rate = live_invoice_rate()
    if rate != Decimal("0"):
        return None, "Live invoice tax is not 0. Will not print GST."
    issued = bool(rec)
    number = str((rec or {}).get("number") or "")
    item = str(_val(ev, "item") or _val(ev, "sku") or "").strip()
    qty = _val(ev, "qty")
    job = str(_val(ev, "job_no") or ev.get("job_no") or "").strip()
    return {
        "event_id": eid,
        "kind": kind,
        "occupancy": occ,
        "occupancy_label": OCCUPANCY_LABEL[occ],
        "issued": issued,
        "watermark": "" if issued else "DRAFT",
        "number": number,
        "title": (f"{kind} {number}" if issued else f"UNISSUED {kind}"),
        "date": _date(ev),
        "party_label": "Customer" if kind == "INV" else "Supplier",
        "party": party,
        "amount": _fmt(amt),
        "currency": head["currency"],
        "tax": "0",
        "tax_line": tax_master_line(),
        "item": item,
        "qty": "" if qty in (None, "") else str(qty),
        "job_no": job,
        "letterhead": head,
        "contact_id": str((rec or {}).get("contact_id") or ""),
    }, None


def may_print(proposal: dict | None, occupancy: str) -> bool:
    if not isinstance(proposal, dict):
        return False
    kind = proposal.get("doc_kind")
    if kind not in ("PO", "INV", "QUO"):
        return False
    if proposal.get("occupancy") != occupancy:
        return False
    payload, err = print_payload(
        event_id=str(proposal.get("event_id") or ""),
        kind=kind,
        occupancy=occupancy,
    )
    return err is None and payload is not None


def job_costing(occupancy: str) -> list[dict]:
    """Job amounts already on occupancy events. Never invents labour, materials, or profit."""
    if occupancy not in ("STARQ", "CI"):
        return []
    buckets: dict[str, dict] = {}
    for ev in load_events():
        if not isinstance(ev, dict):
            continue
        if occupancy_of(ev) != occupancy:
            continue
        if _is_leftover(ev):
            continue
        job = _job_key(ev)
        if not job:
            continue
        b = buckets.setdefault(job, {
            "job_no": job,
            "occupancy": occupancy,
            "occupancy_label": OCCUPANCY_LABEL[occupancy],
            "customer": "",
            "quoted": None,
            "deposit": None,
            "revenue": None,
            "materials": None,
            "labour": None,
            "profit": None,
        })
        cust = str(_val(ev, "customer") or "").strip()
        if cust and not b["customer"]:
            b["customer"] = cust
        t = str(ev.get("type") or "")
        amt = _valued_amount(ev)
        if t == "CLOSE":
            got, src = _close_amount(ev)
            if src != "self":
                amt = None
            else:
                amt = got
        if amt is None:
            continue
        if t == "ESTIMATE":
            b["quoted"] = (b["quoted"] or Decimal("0")) + amt
        elif t == "AUTHORISATION":
            b["deposit"] = (b["deposit"] or Decimal("0")) + amt
        elif t in ("INVOICE_PAYMENT", "CLOSE", "FIN_RECEIVABLE"):
            b["revenue"] = (b["revenue"] or Decimal("0")) + amt
        elif t in ("PURCHASE", "PARTS_PROCUREMENT"):
            b["materials"] = (b["materials"] or Decimal("0")) + amt
        elif t == "WORK":
            b["labour"] = (b["labour"] or Decimal("0")) + amt
    out = []
    for b in buckets.values():
        if all(b[k] is None for k in ("quoted", "deposit", "revenue", "materials", "labour")):
            continue
        if b["revenue"] is not None and (
            b["materials"] is not None or b["labour"] is not None
        ):
            cost = (b["materials"] or Decimal("0")) + (b["labour"] or Decimal("0"))
            b["profit"] = b["revenue"] - cost
        out.append(b)
    out.sort(key=lambda r: r.get("job_no") or "")
    return out


def _sequence(occ: str, key: str) -> dict:
    """Read prefixes. Issue path writes; award / propose_one never increment."""
    empty = {"prefix": "", "next": None, "issued": 0}
    if not os.path.isfile(ORGS):
        return empty
    try:
        with open(ORGS, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return empty
    want = "STARQ" if occ == "STARQ" else "CI"
    for org in data.get("organizations") or []:
        if not isinstance(org, dict) or org.get("entity") != want:
            continue
        row = (org.get("sequences") or {}).get(key) or {}
        if not isinstance(row, dict):
            return empty
        return {
            "prefix": str(row.get("prefix") or ""),
            "next": row.get("next"),
            "issued": row.get("issued", 0),
        }
    return empty


def _blank(val, label: str) -> str:
    s = str(val or "").strip()
    return s if s else f"{label}: not on event — will not invent"


def _commercial_document(occ: str, kind: str, ev: dict, lines: list[str]) -> str:
    rec = _issued_for(ev.get("id") or "", kind)
    if kind == "PO":
        key = "purchase_order"
    elif kind == "QUO":
        key = "quotation"
    else:
        key = "invoice"
    seq = _sequence(occ, key)
    if kind == "PO":
        prefix = seq.get("prefix") or ("ST-PO-" if occ == "STARQ" else "CI-PO-")
    elif kind == "QUO":
        prefix = seq.get("prefix") or ("ST-QUO-" if occ == "STARQ" else "CI-QUO-")
    else:
        prefix = seq.get("prefix") or ("ST-INV-" if occ == "STARQ" else "CI-INV-")
    issued = seq.get("issued", 0)
    nxt = seq.get("next")
    if rec:
        head = [
            f"ISSUED {kind}",
            f"Number: {rec.get('number')}",
            f"Prefix: {rec.get('prefix') or prefix}  next={rec.get('next', nxt)}  issued={rec.get('issued', issued)}",
            f"Occupancy: {OCCUPANCY_LABEL.get(occ, occ)}",
            f"Source event: {ev.get('id') or ''}",
            f"Date: {_date(ev)}",
            f"Issued by seat: {rec.get('seat') or ''}",
        ]
        if rec.get("contact_id"):
            head.append(
                f"Contact: {rec.get('contact_id')} {rec.get('contact_name') or ''}".strip()
            )
        tail = [
            tax_master_line(),
            "Not a journal. DEC-008. Ops did not post.",
        ]
        return "\n".join(head + lines + tail)
    shown = f"{prefix}{nxt}" if prefix and nxt not in (None, "") else prefix
    head = [
        f"UNISSUED {kind}",
        f"Prefix: {prefix}  next={nxt}  issued={issued} (not allocated)",
        f"Next number: {shown}",
        f"Occupancy: {OCCUPANCY_LABEL.get(occ, occ)}",
        f"Source event: {ev.get('id') or ''}",
        f"Date: {_date(ev)}",
    ]
    tail = [
        tax_master_line(),
        "Not a journal. DEC-008. Ops did not post. issued stays 0 until an authorised seat issues.",
    ]
    return "\n".join(head + lines + tail)


def _scm_step(ev: dict) -> str:
    f = ev.get("fields") if isinstance(ev.get("fields"), dict) else {}
    return str(f.get("scm_step") or "").strip().lower()


def _chain_key(ev: dict) -> str:
    f = ev.get("fields") if isinstance(ev.get("fields"), dict) else {}
    return str(f.get("scm_ref") or "").strip()


def _event_index(events: list[dict] | None = None) -> dict[str, dict]:
    rows = events if events is not None else load_events()
    return {str(e.get("id") or ""): e for e in rows if e.get("id")}


def resolve_procurement_chain(ev: dict, occ: str, events: list[dict] | None = None) -> dict:
    """Link need / quote / award by explicit event ids or shared scm_ref. No invention."""
    rows = events if events is not None else load_events()
    by_id = _event_index(rows)
    f = ev.get("fields") if isinstance(ev.get("fields"), dict) else {}
    step = _scm_step(ev)
    need_id = str(f.get("need_event_id") or "").strip()
    quote_id = str(f.get("quote_event_id") or "").strip()
    ref = _chain_key(ev)
    need = by_id.get(need_id) if need_id else None
    quote = by_id.get(quote_id) if quote_id else None
    award = ev if step == "award" else None
    if ref:
        for e in rows:
            if occupancy_of(e) != occ or _chain_key(e) != ref:
                continue
            s = _scm_step(e)
            if s == "need":
                need = need or e
            elif s == "quote":
                quote = quote or e
            elif s == "award":
                award = award or e
    if step == "award":
        award = ev
    return {"need": need, "quote": quote, "award": award}


def _chain_document_lines(chain: dict) -> list[str]:
    lines: list[str] = []
    need = chain.get("need")
    quote = chain.get("quote")
    if need:
        lines.append(f"PR source event: {need.get('id') or ''}")
    if quote:
        lines.append(f"RFQ source event: {quote.get('id') or ''}")
    if not lines:
        return []
    return ["--- procurement chain (linked events on disk) ---", *lines]


def procurement_chains(occupancy: str, limit: int = 10) -> list[dict]:
    """Award events with real amount that chain to need/quote drafts on the same occupancy."""
    occ = str(occupancy or "").strip().upper()
    if occ not in ("STARQ", "CI"):
        return []
    rows = load_events()
    out: list[dict] = []
    seen: set[str] = set()
    for ev in reversed(rows):
        if occupancy_of(ev) != occ or _scm_step(ev) != "award":
            continue
        if _valued_amount(ev) is None:
            continue
        eid = str(ev.get("id") or "")
        if not eid or eid in seen:
            continue
        chain = resolve_procurement_chain(ev, occ, rows)
        if not chain.get("need") and not chain.get("quote"):
            continue
        seen.add(eid)
        out.append({
            "chain": chain,
            "need_proposal": propose_one(chain["need"]) if chain.get("need") else None,
            "quote_proposal": propose_one(chain["quote"]) if chain.get("quote") else None,
            "award_proposal": propose_one(ev),
        })
        if len(out) >= limit:
            break
    return out


def _with_po_document(row: dict, ev: dict, occ: str) -> dict:
    item = _val(ev, "item") or _val(ev, "sku") or ""
    supplier = _val(ev, "supplier") or _val(ev, "vendor") or ""
    amt = _valued_amount(ev)
    qty = _val(ev, "qty")
    lines = [
        _blank(supplier, "Supplier"),
        _blank(item, "Item"),
        f"Qty: {qty}" if qty not in (None, "") else "Qty: not on event — will not invent",
        f"Amount MVR: {_fmt(amt)}" if amt is not None else "Amount: not on event — will not invent",
        tax_master_line(),
        "Job: " + (str(_val(ev, "job_no") or ev.get("job_no") or "not on event")),
    ]
    doc = _commercial_document(occ, "PO", ev, lines)
    chain = resolve_procurement_chain(ev, occ)
    chain_extra = _chain_document_lines(chain)
    if chain_extra:
        doc = doc + "\n" + "\n".join(chain_extra)
        if chain.get("need"):
            row["chain_need_id"] = chain["need"].get("id")
        if chain.get("quote"):
            row["chain_quote_id"] = chain["quote"].get("id")
    row["document"] = doc
    row["doc_kind"] = "PO"
    row["doc_prefix"] = _sequence(occ, "purchase_order").get("prefix") or ""
    rec = _issued_for(ev.get("id") or "", "PO")
    row["doc_issued"] = bool(rec)
    row["doc_unissued"] = not rec
    row["doc_number"] = (rec or {}).get("number") or ""
    return row


def _procurement_ladder_document(occ: str, kind: str, ev: dict, lines: list[str]) -> str:
    """Ceremonial PR/RFQ before PO. No sequence, no issue. Will not invent vendor or amount."""
    prefix = f"{'ST' if occ == 'STARQ' else 'CI'}-{kind}-"
    head = [
        f"DRAFT {kind}",
        f"Prefix: {prefix} (ceremonial — not issued, no sequence)",
        f"Occupancy: {OCCUPANCY_LABEL.get(occ, occ)}",
        f"Source event: {ev.get('id') or ''}",
        f"Date: {_date(ev)}",
        "Ladder step before PO. Will not invent vendor or amount.",
    ]
    tail = [
        tax_master_line(),
        "Not a journal. DEC-008. Ops did not post.",
    ]
    return "\n".join(head + lines + tail)


def _with_pr_document(row: dict, ev: dict, occ: str) -> dict:
    item = _val(ev, "item") or _val(ev, "sku") or ""
    qty = _val(ev, "qty")
    lines = [
        _blank(item, "Item"),
        f"Qty: {qty}" if qty not in (None, "") else "Qty: not on event — will not invent",
        "Amount: not on event — will not invent",
        "Supplier: not on event — will not invent",
        "Job: " + (str(_val(ev, "job_no") or ev.get("job_no") or "not on event")),
    ]
    row["document"] = _procurement_ladder_document(occ, "PR", ev, lines)
    row["doc_kind"] = "PR"
    row["doc_issued"] = False
    row["doc_unissued"] = True
    row["doc_number"] = ""
    return row


def _with_rfq_document(row: dict, ev: dict, occ: str) -> dict:
    item = _val(ev, "item") or _val(ev, "sku") or ""
    supplier = _val(ev, "supplier") or _val(ev, "vendor") or ""
    qty = _val(ev, "qty")
    lines = [
        _blank(supplier, "Supplier"),
        _blank(item, "Item"),
        f"Qty: {qty}" if qty not in (None, "") else "Qty: not on event — will not invent",
        "Amount: not on event — will not invent",
        "Job: " + (str(_val(ev, "job_no") or ev.get("job_no") or "not on event")),
    ]
    row["document"] = _procurement_ladder_document(occ, "RFQ", ev, lines)
    row["doc_kind"] = "RFQ"
    row["doc_issued"] = False
    row["doc_unissued"] = True
    row["doc_number"] = ""
    return row


def _with_inv_document(row: dict, ev: dict, occ: str, income: str = "") -> dict:
    job = _val(ev, "job_no") or ev.get("job_no") or ""
    customer = _val(ev, "customer") or ""
    amt = _valued_amount(ev)
    if amt is None and (ev.get("type") or "") == "CLOSE":
        got, _src = _close_amount(ev)
        amt = got
    lines = [
        _blank(customer, "Customer"),
        f"Job: {job}" if job else "Job: not on event",
        f"Income account: {income}" if income else "Income account: occupancy default",
        f"Amount MVR: {_fmt(amt)}" if amt is not None else "Amount: not on event — will not invent",
        tax_master_line(),
        "Starq: books invoice, not shop POS." if occ == "STARQ" else "Club Ignition 4520 service invoice. Not retail 4300.",
    ]
    row["document"] = _commercial_document(occ, "INV", ev, lines)
    row["doc_kind"] = "INV"
    row["doc_prefix"] = _sequence(occ, "invoice").get("prefix") or ""
    rec = _issued_for(ev.get("id") or "", "INV")
    row["doc_issued"] = bool(rec)
    row["doc_unissued"] = not rec
    row["doc_number"] = (rec or {}).get("number") or ""
    return row


def _quo_source_for_job(job: str, occ: str) -> str | None:
    """First ESTIMATE/CALL with amount on this job owns the QUO draft. No duplicate."""
    if not job:
        return None
    candidates: list[dict] = []
    for ev in load_events():
        if _job_key(ev) != job or occupancy_of(ev) != occ:
            continue
        if str(ev.get("type") or "") not in ("ESTIMATE", "CALL"):
            continue
        if _valued_amount(ev) is None:
            continue
        candidates.append(ev)
    if not candidates:
        return None
    candidates.sort(key=lambda e: str(e.get("ts") or ""))
    return str(candidates[0].get("id") or "") or None


def _with_quo_document(row: dict, ev: dict, occ: str) -> dict:
    job = _val(ev, "job_no") or ev.get("job_no") or ""
    customer = _val(ev, "customer") or ""
    amt = _valued_amount(ev)
    lines = [
        _blank(customer, "Customer"),
        f"Job: {job}" if job else "Job: not on event",
        f"Amount MVR: {_fmt(amt)}" if amt is not None else "Amount: not on event — will not invent",
        tax_master_line(),
        "Quotation only. Tax 0. Not an invoice until INV issue.",
        "Starq: books quote, not shop POS." if occ == "STARQ" else "Club Ignition 4520 service quote. Not retail 4300.",
    ]
    row["document"] = _commercial_document(occ, "QUO", ev, lines)
    row["doc_kind"] = "QUO"
    row["doc_prefix"] = _sequence(occ, "quotation").get("prefix") or ""
    rec = _issued_for(ev.get("id") or "", "QUO")
    row["doc_issued"] = bool(rec)
    row["doc_unissued"] = not rec
    row["doc_number"] = (rec or {}).get("number") or ""
    return row


def _sku_occupancy(sku: str) -> str | None:
    s = str(sku or "").strip().upper()
    if s.startswith("ST-"):
        return "STARQ"
    if s.startswith("INK-"):
        return "CI"
    return None


def inventory_valuation(occupancy: str) -> dict:
    """Counted SKUs with unit cost on this occupancy only. No invented qty or totals."""
    occ = str(occupancy or "").strip().upper()
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": True,
        "reason": "",
        "rows": [],
        "total": None,
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    rows: list[dict] = []
    total = Decimal("0")
    has_partial = False
    for ln in _inventory_lines():
        if not isinstance(ln, dict):
            continue
        sku = str(ln.get("sku") or "").strip().upper()
        if _sku_occupancy(sku) != occ:
            continue
        if ln.get("qty_status") != "counted":
            continue
        cost = ln.get("unit_cost")
        if cost in (None, ""):
            continue
        try:
            unit = Decimal(str(cost))
        except (InvalidOperation, ValueError):
            continue
        qty_raw = ln.get("qty")
        ext = None
        if qty_raw not in (None, ""):
            try:
                qty = Decimal(str(qty_raw))
                ext = qty * unit
                total += ext
            except (InvalidOperation, ValueError):
                has_partial = True
        else:
            has_partial = True
        rows.append({
            "sku": sku,
            "product_id": str(ln.get("product_id") or ""),
            "qty": qty_raw,
            "unit_cost": unit,
            "extension": ext,
            "uom": ln.get("uom"),
        })
    if not rows:
        empty["reason"] = (
            "No counted SKU with unit cost on this occupancy. "
            "INK-CAGE is still not_counted. Will not invent opening qty or cost."
        )
        return empty
    reason = ""
    if has_partial:
        reason = "Some lines lack qty on disk — extension omitted. Will not invent qty."
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": False,
        "reason": reason,
        "rows": rows,
        "total": total if not has_partial else None,
        "partial": has_partial,
    }


def sales_summary(occupancy: str) -> dict:
    """Issued INV plus capture events with amounts already on disk. No invented sales."""
    occ = str(occupancy or "").strip().upper()
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": True,
        "reason": "",
        "issued": [],
        "captures": [],
        "total_issued": None,
        "total_captures": None,
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    issued: list[dict] = []
    total_issued = Decimal("0")
    for rec in load_issued():
        if str(rec.get("kind") or "").upper() != "INV":
            continue
        if str(rec.get("occupancy") or "").upper() != occ:
            continue
        amt = _amount(rec.get("amount"))
        if amt is None:
            continue
        issued.append({
            "number": rec.get("number") or "",
            "event_id": rec.get("event_id") or "",
            "amount": amt,
            "contact_name": rec.get("contact_name") or "",
            "issued_at": rec.get("issued_at") or "",
        })
        total_issued += amt
    captures: list[dict] = []
    total_captures = Decimal("0")
    capture_types = frozenset({"INVOICE", "INVOICE_PAYMENT", "CLOSE", "FIN_RECEIVABLE"})
    for ev in load_events():
        if occupancy_of(ev) != occ:
            continue
        if _is_leftover(ev):
            continue
        et = str(ev.get("type") or "")
        if et == "RECEIPT" and not _is_invoice_settle(ev):
            continue
        if et not in capture_types and not (et == "RECEIPT" and _is_invoice_settle(ev)):
            continue
        amt = _valued_amount(ev)
        if et == "CLOSE":
            got, src = _close_amount(ev)
            if src != "self":
                amt = None
            else:
                amt = got
        if amt is None:
            continue
        if et in capture_types and _issued_for(ev.get("id") or "", "INV"):
            continue
        captures.append({
            "event_id": ev.get("id") or "",
            "type": et,
            "date": _date(ev),
            "job_no": _job_key(ev) or "",
            "customer": str(_val(ev, "customer") or ""),
            "amount": amt,
        })
        total_captures += amt
    if not issued and not captures:
        empty["reason"] = (
            "issued=0 and no valued invoice/capture events on this occupancy. "
            "Empty honest — will not invent sales."
        )
        return empty
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": False,
        "reason": "",
        "issued": issued,
        "captures": captures,
        "total_issued": total_issued if issued else None,
        "total_captures": total_captures if captures else None,
    }


def payroll_summary(occupancy: str) -> dict:
    """Employees with rate_mvr on this occupancy only. No invented pay."""
    import masters as M
    occ = str(occupancy or "").strip().upper()
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": True,
        "reason": "",
        "rows": [],
        "total_rates": None,
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    rows: list[dict] = []
    total = Decimal("0")
    for emp in M.employees(occ):
        raw = emp.get("rate_mvr")
        if raw in (None, ""):
            continue
        try:
            rate = Decimal(str(raw))
        except (InvalidOperation, ValueError):
            continue
        rows.append({
            "id": emp.get("id") or "",
            "name": emp.get("name") or "",
            "seat": emp.get("seat") or "",
            "rate_mvr": rate,
        })
        total += rate
    if not rows:
        empty["reason"] = (
            "No employee with rate_mvr on this occupancy. "
            "Roster empty or rates blank — will not invent salaries."
        )
        return empty
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": False,
        "reason": "Sum of monthly rates on disk only. Not a pay run and not posted.",
        "rows": rows,
        "total_rates": total,
    }


SOD_APPROVAL_STEPS = (
    "need", "quote", "award", "receive", "match", "pay",
)
SOD_STEP_SEATS = {
    "need": "counter / stores / quartermaster",
    "quote": "quartermaster",
    "award": "financial_controller",
    "receive": "receiver",
    "match": "financial_controller",
    "pay": "payer",
    "issue_inv": "director / financial_controller / counter",
    "issue_quo": "director / financial_controller / counter",
}


def sod_approvals_inbox(occupancy: str) -> dict:
    """Pending SoD steps from ops events on this occupancy. Read-only queue."""
    occ = str(occupancy or "").strip().upper()
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": True,
        "reason": "",
        "items": [],
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    items: list[dict] = []
    for ev in load_events():
        if occupancy_of(ev) != occ:
            continue
        if _is_leftover(ev):
            continue
        et = str(ev.get("type") or "")
        step = ""
        link = ""
        if et in ("PURCHASE", "FIN_PAYABLE", "PARTS_PROCUREMENT"):
            step = _scm_step(ev) or "need"
            if step not in SOD_APPROVAL_STEPS:
                continue
            link = "expenses"
        elif et == "INVOICE":
            prop = propose_one(ev)
            if not prop or prop.get("doc_kind") != "INV" or prop.get("doc_issued"):
                continue
            if prop.get("status") != "draft":
                continue
            step = "issue_inv"
            link = "sales"
        elif et in ("ESTIMATE", "CALL"):
            prop = propose_one(ev)
            if not prop or prop.get("doc_kind") != "QUO" or prop.get("doc_issued"):
                continue
            step = "issue_quo"
            link = "sales"
        else:
            continue
        amt = _valued_amount(ev)
        items.append({
            "event_id": ev.get("id") or "",
            "type": et,
            "step": step,
            "seat_hint": SOD_STEP_SEATS.get(step, "authorised seat"),
            "date": _date(ev),
            "summary": str(ev.get("summary") or _val(ev, "item") or _val(ev, "customer") or et),
            "amount": str(amt) if amt is not None else "",
            "link": link,
        })
    items.sort(key=lambda r: (r.get("date") or "", r.get("event_id") or ""), reverse=True)
    if not items:
        empty["reason"] = (
            "No pending SoD steps on this occupancy. "
            "Purchasing queue empty until need/quote/award/receive/match/pay events exist."
        )
        return empty
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": False,
        "reason": "Read-only. SoD seats act in Ops or issue on Sales/Expenses.",
        "items": items,
    }


SCM_APPROVE_FROM = {
    "award": frozenset({"need", "quote"}),
    "receive": frozenset({"award"}),
    "match": frozenset({"receive", "award"}),
    "pay": frozenset({"match"}),
}
SCM_APPROVE_STEPS = frozenset(SCM_APPROVE_FROM)


def scm_approve_target(current_step: str) -> str | None:
    """Default next scm_step when approving from the inbox."""
    step = str(current_step or "").strip().lower()
    return {
        "need": "award",
        "quote": "award",
        "award": "receive",
        "receive": "match",
        "match": "pay",
    }.get(step)


def _chain_already_has(events: list[dict], source: dict, target_step: str, occ: str) -> bool:
    src_id = str(source.get("id") or "")
    ref = _chain_key(source) or src_id
    for e in events:
        if occupancy_of(e) != occ:
            continue
        if _scm_step(e) != target_step:
            continue
        if e.get("id") == src_id:
            continue
        f = e.get("fields") if isinstance(e.get("fields"), dict) else {}
        if f.get("need_event_id") == src_id or f.get("approve_of") == src_id:
            return True
        if f.get("quote_event_id") == src_id:
            return True
        if ref and (_chain_key(e) == ref or str(f.get("scm_ref") or "") == ref):
            return True
    return False


def prepare_scm_approve(
    *,
    event_id: str,
    scm_step: str,
    occupancy: str,
    seat: str,
    events: list[dict] | None = None,
) -> tuple[dict | None, str | None]:
    """Build ops form for one scm approval. Appends via record_event only — no journals."""
    occ = str(occupancy or "").strip().upper()
    if occ not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy. Group is not a company."
    target = str(scm_step or "").strip().lower()
    if target not in SCM_APPROVE_STEPS:
        return None, "Approve step must be award, receive, match, or pay."
    import auth as A
    if not A.seat_may_scm_step(seat, target):
        return None, f"Seat cannot approve SCM step '{target}'."
    eid = str(event_id or "").strip()
    if not eid:
        return None, "event_id is required."
    rows = events if events is not None else load_events()
    by_id = _event_index(rows)
    source = by_id.get(eid)
    if not source:
        return None, "Event not on disk — will not invent a queue item."
    if occupancy_of(source) != occ:
        return None, "Event is on another occupancy."
    if _is_leftover(source):
        return None, "Leftover paint refused."
    et = str(source.get("type") or "")
    if et not in ("PURCHASE", "FIN_PAYABLE", "PARTS_PROCUREMENT"):
        return None, "Only purchase-chain events can be scm-approved here."
    current = _scm_step(source) or "need"
    allowed_from = SCM_APPROVE_FROM.get(target) or frozenset()
    if current not in allowed_from:
        return None, f"Cannot approve {target} from step '{current}'."
    if _chain_already_has(rows, source, target, occ):
        return None, f"Chain already has {target} on disk."
    f = source.get("fields") if isinstance(source.get("fields"), dict) else {}
    item = str(f.get("item") or source.get("summary") or "item").strip()
    supplier = str(f.get("supplier") or f.get("vendor") or "").strip()
    amount = str(f.get("amount") or "").strip()
    ref = _chain_key(source) or eid
    form = {
        "type": "PURCHASE",
        "entity": occ,
        "scm_step": target,
        "summary": f"Approved {target}: {item}",
        "item": item,
        "approve_of": eid,
        "scm_ref": ref,
    }
    if supplier:
        form["supplier"] = supplier
    if amount:
        form["amount"] = amount
    if current == "need":
        form["need_event_id"] = eid
    elif current == "quote":
        form["quote_event_id"] = eid
        need_id = str(f.get("need_event_id") or "").strip()
        if need_id:
            form["need_event_id"] = need_id
    elif current == "award" and target == "match":
        form["need_event_id"] = str(f.get("need_event_id") or "").strip() or ""
        form["quote_event_id"] = str(f.get("quote_event_id") or "").strip() or ""
    job = source.get("job_no")
    if job:
        form["job_no"] = job
    if form.get("need_event_id") == "":
        form.pop("need_event_id", None)
    if form.get("quote_event_id") == "":
        form.pop("quote_event_id", None)
    return form, None


def projects_index(occupancy: str) -> dict:
    """Occupancy job list from ops/state + event job keys. No invented jobs."""
    occ = str(occupancy or "").strip().upper()
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": True,
        "reason": "",
        "items": [],
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    import ops as O
    st = O.load_state()
    state_jobs = st.get("jobs") if isinstance(st.get("jobs"), dict) else {}
    buckets: dict[str, dict] = {}
    for jno, job in state_jobs.items():
        if not jno or not isinstance(job, dict):
            continue
        buckets[str(jno)] = {
            "job_no": str(jno),
            "customer": str(job.get("customer") or ""),
            "vehicle": str(job.get("vehicle") or ""),
            "status": str(job.get("status") or job.get("stage") or ""),
            "writable": True,
            "source": "state",
        }
    for row in job_costing(occ):
        jno = str(row.get("job_no") or "").strip()
        if not jno:
            continue
        b = buckets.setdefault(jno, {
            "job_no": jno,
            "customer": str(row.get("customer") or ""),
            "vehicle": "",
            "status": "",
            "writable": False,
            "source": "events",
        })
        if row.get("customer") and not b.get("customer"):
            b["customer"] = str(row["customer"])
        if b.get("source") != "state":
            b["writable"] = True
            b["source"] = "events"
        b["revenue"] = row.get("revenue")
        b["materials"] = row.get("materials")
    if not buckets:
        empty["reason"] = (
            "No jobs on disk. Empty bay is honest — will not invent a vehicle or customer."
        )
        return empty
    items = sorted(buckets.values(), key=lambda r: r.get("job_no") or "")
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": False,
        "reason": "Read-only list. Job costing on Sales when amounts exist on events.",
        "items": items,
    }


def intercompany_mirror_hint() -> dict:
    """Read-only intercompany hints from existing drafts on disk. No consolidation journal."""
    hints: list[dict] = []
    for occ in ("STARQ", "CI"):
        for ev in load_events():
            if occupancy_of(ev) != occ:
                continue
            if _is_leftover(ev):
                continue
            prop = propose_one(ev)
            if not prop or prop.get("status") != "draft":
                continue
            accounts = set(prop.get("accounts") or [])
            draft = str(prop.get("draft") or "")
            ic = accounts & {"1290", "2490", "2495", "1600"}
            if not ic and ("1290" in draft or "2490" in draft):
                ic = {c for c in ("1290", "2490") if c in draft}
            if not ic:
                continue
            hints.append({
                "occupancy": occ,
                "event_id": ev.get("id") or "",
                "accounts": sorted(ic),
                "narration": str(ev.get("summary") or _val(ev, "item") or ev.get("type") or ""),
                "copy_into": prop.get("copy_into") or "",
            })
    import books as B
    chk = B.check_journals()
    mirror_ok = bool(chk.get("ok"))
    mirror_note = chk.get("line") or chk.get("error") or ""
    if not hints:
        return {
            "empty": True,
            "reason": (
                "No intercompany draft legs on disk. Posted journals: "
                + (mirror_note if mirror_note else "books.py check not run.")
            ),
            "mirror_ok": mirror_ok,
            "hints": [],
        }
    return {
        "empty": False,
        "reason": (
            "Draft mirror hints from outbox only — not a consolidation post. "
            "Group view drops 1290/2490 when consolidated."
        ),
        "mirror_ok": mirror_ok,
        "hints": hints,
    }


def _inventory_lines() -> list[dict]:
    if not os.path.isfile(INVENTORY):
        return []
    try:
        with open(INVENTORY, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return []
    rows = data.get("lines") if isinstance(data, dict) else None
    return list(rows) if isinstance(rows, list) else []


def _lookup_keys(ev: dict) -> list[str]:
    out = []
    for key in ("sku", "item_id", "product_id", "item"):
        raw = str(_val(ev, key) or "").strip()
        if raw:
            out.append(raw.upper())
    return out


def _is_leftover(ev: dict) -> bool:
    kind = str(_val(ev, "kind") or "").strip().lower()
    if kind in ("leftover", "retail"):
        return True
    for key in _lookup_keys(ev):
        if key in LEFTOVER_KEYS:
            return True
    return False


def _matched_stock(ev: dict) -> dict | None:
    keys = set(_lookup_keys(ev))
    if not keys:
        return None
    for ln in _inventory_lines():
        if not isinstance(ln, dict):
            continue
        sku = str(ln.get("sku") or "").strip().upper()
        pid = str(ln.get("product_id") or "").strip().upper()
        if sku in keys or pid in keys:
            return ln
    return None


def _purchase_debit(ev: dict) -> tuple[str, str]:
    """Return (debit_account, memo). Never invents a unit cost."""
    stock = _matched_stock(ev)
    if not stock:
        return (
            "5100",
            "Still expense 5100. No counted SKU with unit cost. Do not invent 1300.",
        )
    if stock.get("qty_status") in ("not_for_sale", "service"):
        return (
            "5100",
            "SKU is not countable stock. Keep 5100. Do not invent 1300.",
        )
    if stock.get("qty_status") != "counted":
        return (
            "5100",
            "SKU not counted. Still expense 5100. Do not debit 1300 until first count.",
        )
    cost = stock.get("unit_cost")
    if cost in (None, ""):
        return (
            "5100",
            "SKU counted but no unit cost. Keep 5100. Will not invent a 1300 amount.",
        )
    return (
        "1300",
        "Counted SKU has unit cost. Debit 1300 inventory. DEC-008 draft. Not posted.",
    )


VALUED_TYPES = frozenset({
    "RECEIPT", "BILL", "PURCHASE", "FIN_PAYABLE", "PARTS_PROCUREMENT",
    "AUTHORISATION", "INVOICE", "INVOICE_PAYMENT", "CLOSE", "FIN_RECEIVABLE", "FIN_BANK",
})


def _propose_grn(ev: dict, occ: str, eid: str) -> dict:
    """GRN draft against issued PO only. Qty required. No second AP journal."""
    dest = COPY_INTO[occ]
    if _is_leftover(ev):
        return _finish({
            "event_id": eid, "type": ev.get("type") or "PURCHASE", "status": "blocked",
            "reason": "4300 / leftover paint is not product (DEC-023).",
            "draft": "",
        }, occ)
    qty = _amount(_val(ev, "qty"))
    if qty is None:
        return _finish({
            "event_id": eid, "type": ev.get("type") or "PURCHASE", "status": "blocked",
            "reason": "Qty missing on receive. Will not invent a GRN count.",
            "draft": "",
        }, occ)
    rec, err = _issued_po_for_receive(ev, occ)
    if err or not rec:
        return _finish({
            "event_id": eid, "type": ev.get("type") or "PURCHASE", "status": "blocked",
            "reason": err or "GRN only against an issued PO.",
            "draft": "",
        }, occ)
    plan = grn_qty_plan(ev)
    if plan.get("action") == "blocked":
        return _finish({
            "event_id": eid, "type": ev.get("type") or "PURCHASE", "status": "blocked",
            "reason": plan.get("note") or "GRN blocked.",
            "draft": "",
        }, occ)
    item = _val(ev, "item") or _val(ev, "sku") or rec.get("contact_name") or "goods"
    supplier = _val(ev, "supplier") or _val(ev, "vendor") or ""
    lines = [
        "GRN DRAFT",
        f"Against issued PO: {rec.get('number')}",
        f"Occupancy: {OCCUPANCY_LABEL.get(occ, occ)}",
        f"Source event: {eid}",
        f"PO event: {rec.get('event_id') or ''}",
        f"Date: {_date(ev)}",
        _blank(supplier, "Supplier"),
        _blank(item, "Item"),
        f"Qty: {qty}",
        plan.get("note") or "",
        tax_master_line(),
        "Not a journal. DEC-008. Award holds the AP draft. Ops did not post.",
        "No GRN sequence. issued PO/INV stay as they are.",
    ]
    if plan.get("action") == "count_link":
        lines.append("Count link: /products (will not invent opening qty).")
    doc = "\n".join(x for x in lines if x)
    row = {
        "event_id": eid,
        "type": ev.get("type") or "PURCHASE",
        "status": "draft",
        "reason": (
            f"GRN against issued {rec.get('number')}. Occupancy {OCCUPANCY_LABEL.get(occ, occ)}. "
            f"{plan.get('note') or ''} Not posted from ops. {dest} unused until Ali copies a journal."
        ),
        "draft": "",
        "document": doc,
        "doc_kind": "GRN",
        "doc_issued": False,
        "doc_unissued": False,
        "doc_number": rec.get("number") or "",
        "qty_action": plan.get("action") or "none",
        "qty_sku": plan.get("sku") or "",
        "qty_add": str(plan.get("qty") or ""),
    }
    return _finish(row, occ)


def _propose_inv_settle(ev: dict, occ: str, eid: str, dest: str) -> dict:
    """Cash/wallet receipt against issued INV. Unnamed refuses inventing 1110. Tax 0."""
    if _is_leftover(ev):
        return _finish({
            "event_id": eid, "type": ev.get("type") or "RECEIPT", "status": "blocked",
            "reason": "4300 / leftover paint is not product (DEC-023).",
            "draft": "",
        }, occ)
    gst_err = _gst_posted_block(ev)
    if gst_err:
        return _finish({
            "event_id": eid, "type": ev.get("type") or "RECEIPT", "status": "blocked",
            "reason": gst_err, "draft": "",
        }, occ)
    amt = _valued_amount(ev)
    if amt is None:
        return _finish({
            "event_id": eid, "type": ev.get("type") or "RECEIPT", "status": "blocked",
            "reason": "Amount missing on ops. Will not invent a receipt figure.",
            "draft": "",
        }, occ)
    rec, err = _issued_inv_for_settle(ev, occ)
    if err or not rec:
        return _finish({
            "event_id": eid, "type": ev.get("type") or "RECEIPT", "status": "blocked",
            "reason": err or "Payment/receipt only against an issued INV.",
            "draft": "",
        }, occ)
    money, merr = _cash_wallet_or_block(ev, occ)
    if merr:
        return _finish({
            "event_id": eid, "type": ev.get("type") or "RECEIPT", "status": "blocked",
            "reason": merr, "draft": "",
        }, occ)
    if money is None:
        return _finish({
            "event_id": eid, "type": ev.get("type") or "RECEIPT", "status": "no_gl",
            "reason": (
                "Cash/wallet not named. Will not invent 1110 against issued "
                f"{rec.get('number') or 'INV'}."
            ),
            "draft": "",
        }, occ)
    nar = f"Receipt {rec.get('number')}".strip()
    memo = (
        f"Settle issued INV {rec.get('number')} from named cash/wallet. "
        + tax_master_line()
        + " DEC-008 draft. Not posted."
    )
    return _finish({
        "event_id": eid, "type": ev.get("type") or "RECEIPT", "status": "draft",
        "reason": f"Copy into {dest}. Against issued {rec.get('number')}. Ops did not post.",
        "draft": _entry(_date(ev), nar, money, "1200", amt, memo, occ),
        "doc_kind": "INV",
        "doc_issued": True,
        "doc_number": rec.get("number") or "",
    }, occ, money, "1200")


def _propose_supplier_bill(ev: dict, occ: str, eid: str, dest: str) -> dict:
    """AP bill: typed amount, occupancy vendor, credit 2100. Tax 0. Optional issued PO."""
    if _is_leftover(ev):
        return _finish({
            "event_id": eid, "type": "BILL", "status": "blocked",
            "reason": "4300 / leftover paint is not product (DEC-023).",
            "draft": "",
        }, occ)
    amt = _valued_amount(ev)
    if amt is None:
        return _finish({
            "event_id": eid, "type": "BILL", "status": "blocked",
            "reason": "Amount missing. Type a real figure. Will not invent one.",
            "draft": "",
        }, occ)
    vendor = str(_val(ev, "supplier") or _val(ev, "vendor") or "").strip()
    if not vendor:
        return _finish({
            "event_id": eid, "type": "BILL", "status": "blocked",
            "reason": "Vendor missing. Contact if exists, else ops name. Will not invent a vendor.",
            "draft": "",
        }, occ)
    po_eid = str(_val(ev, "po_event_id") or "").strip()
    po_num = str(_val(ev, "po_number") or "").strip()
    po_rec = None
    if po_eid or po_num:
        po_rec, err = _issued_match("PO", occ, event_id=po_eid, number=po_num)
        if err or not po_rec:
            return _finish({
                "event_id": eid, "type": "BILL", "status": "blocked",
                "reason": err or (
                    "Optional PO link only against an issued PO on this occupancy. "
                    "Will not invent a PO."
                ),
                "draft": "",
            }, occ)
    debit, pmemo = _purchase_debit(ev)
    item = _val(ev, "item") or _val(ev, "sku") or "supplier bill"
    nar = f"Supplier bill - {item} - {vendor}"
    if po_rec:
        nar += f" - {po_rec.get('number')}"
    memo = (
        f"Credit AP 2100. {pmemo} {tax_master_line()} DEC-008 draft. Not posted."
    )
    extra = ""
    if po_rec:
        extra = f" Against issued {po_rec.get('number')}."
    return _finish({
        "event_id": eid, "type": "BILL", "status": "draft",
        "reason": f"Copy into {dest}.{extra} Tax 0. Ops did not post.",
        "draft": _entry(_date(ev), nar, debit, "2100", amt, memo, occ),
        "doc_kind": "BILL",
        "doc_issued": False,
        "doc_number": (po_rec or {}).get("number") or "",
    }, occ, debit, "2100")


def _propose_customer_invoice(ev: dict, occ: str, eid: str, dest: str) -> dict:
    """AR invoice: typed amount, occupancy customer, debit 1200. Tax 0. Unissued until Issue."""
    if _is_leftover(ev):
        return _finish({
            "event_id": eid, "type": "INVOICE", "status": "blocked",
            "reason": "4300 / leftover paint is not product (DEC-023).",
            "draft": "",
        }, occ)
    amt = _valued_amount(ev)
    if amt is None:
        return _finish({
            "event_id": eid, "type": "INVOICE", "status": "blocked",
            "reason": "Amount missing. Type a real figure. Will not invent one.",
            "draft": "",
        }, occ)
    customer = str(_val(ev, "customer") or "").strip()
    if not customer:
        return _finish({
            "event_id": eid, "type": "INVOICE", "status": "blocked",
            "reason": "Customer missing. Contact if exists, else ops name. Will not invent a customer.",
            "draft": "",
        }, occ)
    acct, why = _resolve_income(ev, occ)
    if acct is None:
        return _finish({
            "event_id": eid, "type": "INVOICE", "status": "blocked",
            "reason": why or "Income account refused. Will not invent BAR clearance.",
            "draft": "",
        }, occ)
    item = _val(ev, "item") or _val(ev, "sku") or "customer invoice"
    if occ == "STARQ":
        nar = (
            f"Starq Dynamics 8211 - {item} - {customer}"
            if acct == "4110" else
            f"Starq software 6201 - {item} - {customer}"
        )
        memo = (
            "Debit AR 1200. BN 8211 credits 4110; company 6201 credits 4100. "
            + tax_master_line()
            + " DEC-008 draft. Not posted. issued stays 0 until Issue."
        )
        if acct == "4100":
            memo = (
                "Debit AR 1200. Company BAR 6201 credits 4100. "
                + tax_master_line()
                + " DEC-008 draft. Not posted. issued stays 0 until Issue."
            )
    else:
        nar = f"Customer invoice - {item} - {customer}"
        memo = (
            "Debit AR 1200. 4520 stations 4200-4230. "
            + tax_master_line()
            + " DEC-008 draft. Not posted. issued stays 0 until Issue."
        )
    row = {
        "event_id": eid, "type": "INVOICE", "status": "draft",
        "reason": (
            f"Copy into {dest}. Tax 0. AR 1200. Unissued INV prefix, issued=0 until Issue. "
            "Ops did not post."
        ),
        "draft": _entry(_date(ev), nar, "1200", acct, amt, memo, occ),
    }
    row = _with_inv_document(row, ev, occ, acct)
    return _finish(row, occ, "1200", acct)


def propose_one(ev: dict) -> dict | None:
    et = ev.get("type") or ""
    eid = ev.get("id") or ""
    occ = occupancy_of(ev)
    dest = COPY_INTO[occ]
    if et.startswith("auth."):
        return None
    if et in VALUED_TYPES:
        gst_err = _gst_posted_block(ev)
        if gst_err:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": gst_err, "draft": "",
            }, occ)
    if et == "STOCK":
        kind = str(_val(ev, "kind") or "").strip().lower()
        if kind != "pos_consume":
            return _finish({
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": "Ops cycle — no journal until a valued RECEIPT / PURCHASE / invoice.",
                "draft": "",
            }, occ)
        if occ == "STARQ" or _is_leftover(ev):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "Starq has no shop POS. Leftover paint 4300 is not a till item.",
                "draft": "",
            }, occ)
        qty = _amount(_val(ev, "qty"))
        stock = _matched_stock(ev)
        cost = None if not stock else stock.get("unit_cost")
        if qty is None:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "POS consume qty missing. Will not invent it.",
                "draft": "",
            }, "CI")
        if cost in (None, ""):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "Counted SKU has no unit cost. No 1300 consume draft. Do not invent cost.",
                "draft": "",
            }, "CI")
        try:
            amt = qty * Decimal(str(cost))
        except (InvalidOperation, ValueError):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "Could not multiply qty x unit cost.",
                "draft": "",
            }, "CI")
        sku = _val(ev, "sku") or "stock"
        memo = "POS consume. COGS 5100 / credit 1300. DEC-008 draft. Not posted."
        return _finish({
            "event_id": eid, "type": et, "status": "draft",
            "reason": f"Copy into {COPY_INTO['CI']} then books.py check. Ops did not post.",
            "draft": _entry(_date(ev), f"POS consume - {sku}", "5100", "1300", amt, memo, "CI"),
        }, "CI", "5100", "1300")
    if et == "BILL":
        return _propose_supplier_bill(ev, occ, eid, dest)
    if et == "INVOICE":
        return _propose_customer_invoice(ev, occ, eid, dest)
    if et == "RECEIPT":
        if _is_invoice_settle(ev):
            return _propose_inv_settle(ev, occ, eid, dest)
        kind = str(_val(ev, "kind") or "").lower()
        item_id = str(_val(ev, "item_id") or "")
        if not kind:
            if item_id == "ci-kiev-rent":
                kind = "rent"
            elif "water" in item_id:
                kind = "water"
            elif "electric" in item_id:
                kind = "electricity"
            else:
                kind = "other"
        debit = RECEIPT_DEBIT.get(kind)
        amt = _amount(_val(ev, "amount"))
        if debit == "4300" or kind in ("retail", "leftover") or _is_leftover(ev):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "4300 / leftover paint is not product (DEC-023).",
                "draft": "",
            }, occ)
        if not debit:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": f"Unknown receipt kind {kind!r} — will not invent an account.",
                "draft": "",
            }, occ)
        if amt is None:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "Amount missing. Capture the figure; do not invent it.",
                "draft": "",
            }, occ)
        item = _val(ev, "item") or _val(ev, "item_id") or kind
        supplier = _val(ev, "supplier") or _val(ev, "vendor") or ""
        nar = f"Receipt - {item}" + (f" - {supplier}" if supplier else "")
        money, merr = _cash_wallet_or_block(ev, occ)
        if merr:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": merr, "draft": "",
            }, occ)
        credit = money or "2100"
        memo = (
            "DEC-008 draft. Named open cash/wallet. Not posted."
            if money
            else "DEC-008 draft. Credit AP until payer names cash/wallet. Not posted."
        )
        if debit == "5100":
            inv_debit, inv_memo = _purchase_debit(ev)
            if inv_debit == "1300":
                debit = "1300"
                memo = inv_memo
        return _finish({
            "event_id": eid, "type": et, "status": "draft",
            "reason": f"Copy into {dest} then books.py check.",
            "draft": _entry(_date(ev), nar, debit, credit, amt, memo, occ),
        }, occ, debit, credit)
    if et == "PARTS_PROCUREMENT":
        if _is_leftover(ev):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "4300 / leftover paint is not product (DEC-023).",
                "draft": "",
            }, occ)
        amt = _valued_amount(ev)
        if amt is None:
            row = {
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": "Cage need. No amount on event — no PO and no journal. Will not invent.",
                "draft": "",
            }
            return _finish(row, occ)
        debit, memo = _purchase_debit(ev)
        item = _val(ev, "item") or _val(ev, "sku") or "materials"
        row = {
            "event_id": eid, "type": et, "status": "draft",
            "reason": f"Copy into {dest}. Cage line with amount. Not a PO until award.",
            "draft": _entry(_date(ev), f"Cage - {item}", debit, "2100", amt, memo, occ),
        }
        return _finish(row, occ, debit, "2100")
    if et in ("PURCHASE", "FIN_PAYABLE"):
        if _is_leftover(ev):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "4300 / leftover paint is not product (DEC-023).",
                "draft": "",
            }, occ)
        step = str(_val(ev, "scm_step") or "").strip().lower()
        amt = _valued_amount(ev)
        if step == "receive":
            return _propose_grn(ev, occ, eid)
        if step == "pay":
            if amt is None:
                return _finish({
                    "event_id": eid, "type": et, "status": "no_gl",
                    "reason": "Pay without amount. Will not invent a cash figure.",
                    "draft": "",
                }, occ)
            money, merr = _cash_wallet_or_block(ev, occ)
            if merr:
                return _finish({
                    "event_id": eid, "type": et, "status": "blocked",
                    "reason": merr, "draft": "",
                }, occ)
            if money is None:
                return _finish({
                    "event_id": eid, "type": et, "status": "no_gl",
                    "reason": (
                        "Pay did not name cash/wallet. MIB not_opened. "
                        "Will not invent 1110 or a bank statement."
                    ),
                    "draft": "",
                }, occ)
            item = _val(ev, "item") or _val(ev, "sku") or "materials"
            memo = "Settle AP from named cash/wallet. DEC-008 draft. Not posted."
            return _finish({
                "event_id": eid, "type": et, "status": "draft",
                "reason": f"Copy into {dest}. Payment. Ops did not post.",
                "draft": _entry(_date(ev), f"Pay - {item}", "2100", money, amt, memo, occ),
            }, occ, "2100", money)
        if amt is None:
            if step == "need":
                row = {
                    "event_id": eid, "type": et, "status": "draft",
                    "reason": "Purchase request draft. No amount — will not invent. Before PO.",
                    "draft": "",
                }
                return _finish(_with_pr_document(row, ev, occ), occ)
            if step == "quote":
                row = {
                    "event_id": eid, "type": et, "status": "draft",
                    "reason": "RFQ draft. No amount — will not invent. Before award/PO.",
                    "draft": "",
                }
                return _finish(_with_rfq_document(row, ev, occ), occ)
            row = {
                "event_id": eid, "type": et, "status": "blocked",
                "reason": (
                    "Award without amount. Unissued PO not copy-ready — will not invent a figure."
                    if step == "award"
                    else "Amount missing. Will not invent a 1300 or 5100 figure."
                ),
                "draft": "",
            }
            if step == "award":
                row = _with_po_document(row, ev, occ)
            return _finish(row, occ)
        debit, memo = _purchase_debit(ev)
        item = _val(ev, "item") or _val(ev, "sku") or "materials"
        nar = f"Purchase - {item}"
        extra = " Debit 1300." if debit == "1300" else ""
        money, merr = _cash_wallet_or_block(ev, occ)
        if merr:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": merr, "draft": "",
            }, occ)
        credit = "2100"
        if money and et == "FIN_PAYABLE":
            credit = money
            memo = "Named open cash/wallet. DEC-008 draft. Not posted."
        row = {
            "event_id": eid, "type": et, "status": "draft",
            "reason": f"Copy into {dest}.{extra} Not posted from ops.",
            "draft": _entry(_date(ev), nar, debit, credit, amt, memo, occ),
        }
        if step == "award":
            row["reason"] = f"Copy into {dest}.{extra} Unissued PO prefix, issued=0. Not posted from ops."
            row = _with_po_document(row, ev, occ)
        return _finish(row, occ, debit, credit)
    if et == "AUTHORISATION":
        amt = _valued_amount(ev)
        if amt is None:
            return _finish({
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": "Deposit not on the event. Will not invent 50% or a WIP figure.",
                "draft": "",
            }, occ)
        if _is_leftover(ev):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "4300 / leftover paint is not product (DEC-023).",
                "draft": "",
            }, occ)
        debit, derr = _ar_or_cash(ev, occ)
        if derr or not debit:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": derr or "Cash/bank unnamed.", "draft": "",
            }, occ)
        job = _val(ev, "job_no") or ev.get("job_no") or ""
        nar = f"Job deposit {job}".strip()
        memo = "WIP / deferred 2500. DEC-008 draft. Not earned until CLOSE. " + tax_master_line() + " Not posted."
        return _finish({
            "event_id": eid, "type": et, "status": "draft",
            "reason": f"Copy into {dest}. Deposit held on 2500 until the bay closes.",
            "draft": _entry(_date(ev), nar, debit, "2500", amt, memo, occ),
        }, occ, debit, "2500")
    if et in ("INVOICE_PAYMENT", "CLOSE", "FIN_RECEIVABLE"):
        amt, src = _close_amount(ev)
        if src == "on_invoice":
            return _finish({
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": "Revenue draft sits on INVOICE_PAYMENT for this job. CLOSE emptied the bay.",
                "draft": "",
            }, occ)
        if amt is None:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "No amount or rate on this event (or ESTIMATE). Do not invent a job figure.",
                "draft": "",
            }, occ)
        acct, why = _resolve_income(ev, occ)
        if acct is None:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": why, "draft": "",
            }, occ)
        debit, derr = _ar_or_cash(ev, occ)
        if derr or not debit:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": derr or "Cash/bank unnamed.", "draft": "",
            }, occ)
        money, _merr = _cash_wallet_or_block(ev, occ)
        if money and not _issued_for(eid, "INV"):
            debit = "1200"
        job = _val(ev, "job_no") or ev.get("job_no") or ""
        if occ == "STARQ":
            nar = f"Starq Dynamics 8211 {job}".strip() if acct == "4110" else f"Starq software 6201 {job}".strip()
            memo = "BN 8211 credits 4110; company 6201 credits 4100. " + tax_master_line() + " DEC-008 draft. Not posted."
            if acct == "4100":
                memo = "Company BAR 6201 credits 4100. " + tax_master_line() + " DEC-008 draft. Not posted."
        else:
            nar = f"Garage income {job}".strip()
            memo = "4520 stations 4200-4230. " + tax_master_line() + " DEC-008 draft. Not posted."
        if src == "estimate":
            memo = "Amount from ESTIMATE on this job. " + memo
        row = {
            "event_id": eid, "type": et, "status": "draft",
            "reason": f"Copy into {dest}. {tax_master_line()} Unissued INV prefix, issued=0. Ops did not post.",
            "draft": _entry(_date(ev), nar, debit, acct, amt, memo, occ),
        }
        row = _with_inv_document(row, ev, occ, acct)
        return _finish(row, occ, debit, acct)
    if et == "FIN_BANK":
        if _is_leftover(ev):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "4300 / leftover paint is not product (DEC-023).",
                "draft": "",
            }, occ)
        amt = _valued_amount(ev)
        if amt is None:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "Amount missing. Will not invent a cash or bank figure.",
                "draft": "",
            }, occ)
        money, merr = _cash_wallet_or_block(ev, occ)
        if merr:
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": merr, "draft": "",
            }, occ)
        if money is None:
            return _finish({
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": (
                    "Cash/wallet not named. MIB not_opened. "
                    "Will not invent 1110, an opening, or a bank statement."
                ),
                "draft": "",
            }, occ)
        contra = str(_val(ev, "contra") or "").strip()
        debit_c = str(_val(ev, "debit") or "").strip()
        credit_c = str(_val(ev, "credit") or "").strip()
        if debit_c and credit_c:
            sides = {debit_c, credit_c}
            if money not in sides:
                return _finish({
                    "event_id": eid, "type": et, "status": "blocked",
                    "reason": "Debit/credit on event must include the named cash/wallet.",
                    "draft": "",
                }, occ)
            if sides & {"4300"}:
                return _finish({
                    "event_id": eid, "type": et, "status": "blocked",
                    "reason": "4300 / leftover paint is not product (DEC-023).",
                    "draft": "",
                }, occ)
            memo = "DEC-008 draft. Named cash/wallet movement. Not posted. Not a statement."
            nar = f"Banking - {_val(ev, 'item') or _val(ev, 'who_paid') or money}"
            return _finish({
                "event_id": eid, "type": et, "status": "draft",
                "reason": f"Copy into {dest}. Not a bank statement. Ops did not post.",
                "draft": _entry(_date(ev), nar, debit_c, credit_c, amt, memo, occ),
            }, occ, debit_c, credit_c)
        if not contra:
            return _finish({
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": "Contra account not on event. Will not invent 2400 or an opening.",
                "draft": "",
            }, occ)
        if contra == "4300":
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "4300 / leftover paint is not product (DEC-023).",
                "draft": "",
            }, occ)
        flow = str(_val(ev, "flow") or _val(ev, "direction") or "").strip().lower()
        if flow in ("in", "deposit", "inflow"):
            debit_c, credit_c = money, contra
        elif flow in ("out", "pay", "withdrawal", "outflow"):
            debit_c, credit_c = contra, money
        else:
            return _finish({
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": "Direction not on event. Will not invent deposit vs withdrawal.",
                "draft": "",
            }, occ)
        memo = "DEC-008 draft. Named cash/wallet movement. Not posted. Not a statement."
        nar = f"Banking - {_val(ev, 'item') or _val(ev, 'who_paid') or money}"
        return _finish({
            "event_id": eid, "type": et, "status": "draft",
            "reason": f"Copy into {dest}. Not a bank statement. Ops did not post.",
            "draft": _entry(_date(ev), nar, debit_c, credit_c, amt, memo, occ),
        }, occ, debit_c, credit_c)
    if et in ("ESTIMATE", "CALL"):
        if _is_leftover(ev):
            return _finish({
                "event_id": eid, "type": et, "status": "blocked",
                "reason": "4300 / leftover paint is not product (DEC-023).",
                "draft": "",
            }, occ)
        amt = _valued_amount(ev)
        if amt is None:
            return _finish({
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": "No amount or rate on this event. Will not invent a quotation figure.",
                "draft": "",
            }, occ)
        if _issued_for(eid, "QUO") or _issued_for(eid, "INV"):
            return _finish({
                "event_id": eid, "type": et, "status": "no_gl",
                "reason": "QUO or INV already issued for this event.",
                "draft": "",
            }, occ)
        job = _job_key(ev)
        if job:
            owner = _quo_source_for_job(job, occ)
            if owner and owner != eid:
                return _finish({
                    "event_id": eid, "type": et, "status": "no_gl",
                    "reason": (
                        f"QUO draft already on job {job} (event {owner}). "
                        "Will not duplicate."
                    ),
                    "draft": "",
                }, occ)
        row = {
            "event_id": eid, "type": et, "status": "draft",
            "reason": (
                f"Unissued QUO prefix, issued=0 until an authorised seat issues. "
                f"{tax_master_line()} Not posted from ops."
            ),
            "draft": "",
        }
        row = _with_quo_document(row, ev, occ)
        return _finish(row, occ)
    if et in NO_GL:
        return _finish({
            "event_id": eid, "type": et, "status": "no_gl",
            "reason": "Ops cycle — no journal until a valued RECEIPT / PURCHASE / invoice.",
            "draft": "",
        }, occ)
    return _finish({
        "event_id": eid, "type": et, "status": "no_gl",
        "reason": f"No posting rule for {et}.",
        "draft": "",
    }, occ)


def load_events() -> list[dict]:
    if not os.path.isfile(EVENTS):
        return []
    rows = []
    with open(EVENTS, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


AGING_BUCKETS = (
    ("current", 0, 30),
    ("31-60", 31, 60),
    ("61-90", 61, 90),
    ("90+", 91, None),
)


def _empty_buckets() -> dict[str, Decimal]:
    return {name: Decimal("0") for name, _a, _b in AGING_BUCKETS}


def _parse_issued_date(raw) -> date | None:
    s = str(raw or "").strip()
    if len(s) < 10:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def _bucket_for_days(days: int | None) -> str:
    if days is None:
        return "undated"
    if days < 0:
        days = 0
    for name, lo, hi in AGING_BUCKETS:
        if hi is None:
            if days >= lo:
                return name
        elif lo <= days <= hi:
            return name
    return "undated"


def _pay_targets_issued_po(ev: dict, occ: str, rec: dict) -> bool:
    et = ev.get("type") or ""
    if et not in ("PURCHASE", "FIN_PAYABLE", "RECEIPT"):
        return False
    step = str(_val(ev, "scm_step") or "").strip().lower()
    if step not in ("pay", "payment"):
        return False
    eid = str(_val(ev, "po_event_id") or _val(ev, "award_event_id") or "").strip()
    num = str(_val(ev, "po_number") or _val(ev, "po") or "").strip()
    if not eid and not num:
        return False
    hit, err = _issued_match("PO", occ, event_id=eid, number=num)
    if err or not hit:
        return False
    return str(hit.get("number") or "") == str(rec.get("number") or "")


def _applied_named_money(rec: dict, events: list[dict]) -> Decimal:
    """Named cash/wallet drafts already on disk. Unnamed / GRN qty never settle money."""
    kind = str(rec.get("kind") or "").upper()
    occ = str(rec.get("occupancy") or "").upper()
    applied = Decimal("0")
    for ev in events:
        if occupancy_of(ev) != occ:
            continue
        if _is_leftover(ev):
            continue
        proposal = propose_one(ev)
        if not proposal or proposal.get("status") != "draft" or not proposal.get("copy_ready"):
            continue
        amt = _valued_amount(ev)
        if amt is None:
            continue
        if kind == "INV":
            if not _is_invoice_settle(ev):
                continue
            hit, err = _issued_inv_for_settle(ev, occ)
            if err or not hit:
                continue
            if str(hit.get("number") or "") != str(rec.get("number") or ""):
                continue
            applied += amt
        elif kind == "PO":
            if not _pay_targets_issued_po(ev, occ, rec):
                continue
            applied += amt
    return applied


def _aging_line(rec: dict, events: list[dict], as_of: date) -> dict | None:
    kind = str(rec.get("kind") or "").upper()
    if kind not in ("PO", "INV"):
        return None
    amt = _amount(rec.get("amount"))
    if amt is None:
        return None
    issued_on = _parse_issued_date(rec.get("issued_at") or rec.get("date"))
    days = (as_of - issued_on).days if issued_on else None
    applied = _applied_named_money(rec, events)
    remaining = amt - applied
    if remaining < 0:
        remaining = Decimal("0")
    return {
        "kind": kind,
        "side": "AR" if kind == "INV" else "AP",
        "number": rec.get("number") or "",
        "event_id": rec.get("event_id") or "",
        "occupancy": rec.get("occupancy") or "",
        "contact_id": rec.get("contact_id") or "",
        "contact_name": rec.get("contact_name") or "",
        "issued_on": issued_on.isoformat() if issued_on else "",
        "days": days,
        "bucket": _bucket_for_days(days),
        "amount": str(amt),
        "applied": str(applied),
        "remaining": str(remaining),
        "tax": str(rec.get("tax") if rec.get("tax") not in (None, "") else live_invoice_rate()),
    }


def aging(occupancy: str, *, as_of: date | None = None,
          issued: list[dict] | None = None,
          events: list[dict] | None = None,
          contact_id: str = "") -> dict:
    """AR from issued INV, AP from issued PO, minus named receipts/pays on disk.

    issued=0 → empty honest (no fake bucket figures). Occupancy-correct.
    GRN qty does not settle AP. Never invents amount, customer, or 8% GST.
    """
    occ = str(occupancy or "").strip().upper()
    as_of = as_of or date.today()
    cid = str(contact_id or "").strip()
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "as_of": as_of.isoformat(),
        "empty": True,
        "issued_count": 0,
        "reason": "",
        "tax": str(live_invoice_rate()),
        "ar": {"lines": [], "buckets": {k: "0" for k in _empty_buckets()}, "total": "0"},
        "ap": {"lines": [], "buckets": {k: "0" for k in _empty_buckets()}, "total": "0"},
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    rows = issued if issued is not None else load_issued()
    evs = events if events is not None else load_events()
    own = [
        r for r in rows
        if isinstance(r, dict)
        and str(r.get("occupancy") or "").upper() == occ
        and str(r.get("kind") or "").upper() in ("PO", "INV")
    ]
    if cid:
        own = [r for r in own if str(r.get("contact_id") or "") == cid]
    empty["issued_count"] = len(own)
    if not own:
        empty["reason"] = (
            "issued=0 on this occupancy. No issued PO/INV to age. "
            "Empty honest — not fake aging."
            if not cid else
            "No issued PO/INV for this contact_id. Empty honest."
        )
        return empty
    ar_b = _empty_buckets()
    ap_b = _empty_buckets()
    ar_lines: list[dict] = []
    ap_lines: list[dict] = []
    ar_tot = Decimal("0")
    ap_tot = Decimal("0")
    for rec in own:
        line = _aging_line(rec, evs, as_of)
        if line is None:
            continue
        rem = Decimal(line["remaining"])
        if rem <= 0:
            continue
        bname = line["bucket"]
        if line["side"] == "AR":
            ar_lines.append(line)
            ar_tot += rem
            if bname in ar_b:
                ar_b[bname] += rem
        else:
            ap_lines.append(line)
            ap_tot += rem
            if bname in ap_b:
                ap_b[bname] += rem
    if not ar_lines and not ap_lines:
        empty["reason"] = (
            "Issued documents are settled or have no amount on disk. "
            "Empty honest — will not invent outstanding."
        )
        return empty
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "as_of": as_of.isoformat(),
        "empty": False,
        "issued_count": len(own),
        "reason": "",
        "tax": str(live_invoice_rate()),
        "ar": {
            "lines": ar_lines,
            "buckets": {k: str(v) for k, v in ar_b.items()},
            "total": str(ar_tot),
        },
        "ap": {
            "lines": ap_lines,
            "buckets": {k: str(v) for k, v in ap_b.items()},
            "total": str(ap_tot),
        },
    }


def statement_of_account(occupancy: str, contact_id: str, *,
                         contacts: list[dict] | None = None,
                         issued: list[dict] | None = None,
                         events: list[dict] | None = None,
                         as_of: date | None = None) -> tuple[dict | None, str | None]:
    """Statement for a master contact_id only. Refuse if contacts []. Never invents a customer."""
    import masters as M
    occ = str(occupancy or "").strip().upper()
    if occ not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy. Group is not a company."
    rows = contacts if contacts is not None else M.contacts(occ)
    if not rows:
        return None, "contacts []. Will not invent a customer or a statement."
    cid = str(contact_id or "").strip()
    if not cid:
        return None, "contact_id required. Will not invent a customer."
    hit = None
    for r in rows:
        if isinstance(r, dict) and str(r.get("id") or "") == cid:
            hit = r
            break
    if hit is None:
        return None, "contact_id is not on this occupancy master. Will not invent a customer."
    if str(hit.get("entity") or "").upper() != occ:
        return None, "contact occupancy mismatch. Will not invent a customer."
    as_of = as_of or date.today()
    evs = events if events is not None else load_events()
    src = issued if issued is not None else load_issued()
    lines = []
    open_amt = Decimal("0")
    for rec in src:
        if not isinstance(rec, dict):
            continue
        if str(rec.get("occupancy") or "").upper() != occ:
            continue
        if str(rec.get("contact_id") or "") != cid:
            continue
        line = _aging_line(rec, evs, as_of)
        if line is None:
            continue
        lines.append(line)
        open_amt += Decimal(line["remaining"])
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "as_of": as_of.isoformat(),
        "contact_id": cid,
        "contact_name": hit.get("name") or "",
        "contact_kind": hit.get("kind") or "",
        "lines": lines,
        "open": str(open_amt),
        "empty": not lines,
        "tax": str(live_invoice_rate()),
        "reason": (
            "No issued PO/INV for this contact. Empty honest."
            if not lines else ""
        ),
    }, None


def _issued_cards(rows: list[dict], occupancy: str, kind: str) -> list[dict]:
    want = str(kind or "").upper()
    occ = str(occupancy or "").upper()
    out = []
    for rec in rows:
        if not isinstance(rec, dict):
            continue
        if str(rec.get("occupancy") or "").upper() != occ:
            continue
        if str(rec.get("kind") or "").upper() != want:
            continue
        amt = rec.get("amount")
        out.append({
            "kind": want,
            "number": rec.get("number") or "",
            "event_id": rec.get("event_id") or "",
            "occupancy": occ,
            "amount": "" if amt in (None, "") else str(amt),
            "tax": str(rec.get("tax") if rec.get("tax") not in (None, "") else live_invoice_rate()),
            "issued_on": str(rec.get("issued_at") or rec.get("date") or "")[:10],
        })
    return out


def _grn_draft_cards(occupancy: str, events: list[dict]) -> list[dict]:
    """GRN drafts already on disk (issued PO + qty). Never invents a receipt."""
    out = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        if occupancy_of(ev) != occupancy:
            continue
        if str(_val(ev, "scm_step") or "").strip().lower() != "receive":
            continue
        p = propose_one(ev)
        if not p or p.get("doc_kind") != "GRN" or p.get("status") != "draft":
            continue
        qty = _val(ev, "qty")
        out.append({
            "kind": "GRN",
            "number": p.get("doc_number") or "",
            "event_id": p.get("event_id") or ev.get("id") or "",
            "occupancy": occupancy,
            "qty": "" if qty in (None, "") else str(qty),
            "item": str(_val(ev, "item") or _val(ev, "sku") or ""),
            "status": "draft",
            "tax": str(live_invoice_rate()),
        })
    return out


def three_way_match(occupancy: str, *, issued: list[dict] | None = None,
                    events: list[dict] | None = None) -> dict:
    """PO / GRN / INV columns from issued docs + GRN drafts. issued=0 empty honest.

    Does not invent documents, qty, prices, or a fake PO–GRN–INV triple.
    Sales INV is listed, not paired onto a PO. Occupancy-correct. Tax 0.
    """
    occ = str(occupancy or "").strip().upper()
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": True,
        "issued_count": 0,
        "reason": "",
        "tax": str(live_invoice_rate()),
        "po": [],
        "grn": [],
        "inv": [],
        "rows": [],
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    src = issued if issued is not None else load_issued()
    evs = events if events is not None else load_events()
    po = _issued_cards(src, occ, "PO")
    inv = _issued_cards(src, occ, "INV")
    grn = _grn_draft_cards(occ, evs)
    issued_count = len(po) + len(inv)
    empty["issued_count"] = issued_count
    if not po and not grn and not inv:
        empty["reason"] = (
            "issued=0 on this occupancy. No issued PO/INV and no GRN draft. "
            "Empty honest — not fake matches."
        )
        return empty
    rows = []
    for rec in po:
        num = rec.get("number") or ""
        ghit = [g for g in grn if num and g.get("number") == num]
        rows.append({
            "po": rec.get("number") or "",
            "grn": (ghit[0].get("event_id") if ghit else ""),
            "inv": "",
            "matched": False,
            "note": (
                "PO + GRN on disk. Supplier bill not issued — will not fake INV match."
                if ghit else
                "Issued PO on disk. GRN/INV missing — will not fake a match."
            ),
        })
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": False,
        "issued_count": issued_count,
        "reason": "",
        "tax": str(live_invoice_rate()),
        "po": po,
        "grn": grn,
        "inv": inv,
        "rows": rows,
    }


CRM_COLUMNS = (
    "CALL", "BOOKING", "INTAKE", "ESTIMATE", "AUTHORISATION",
    "JOB_CARD", "WORK", "QC", "HANDOVER", "INVOICE_PAYMENT", "CLOSE",
)
_CRM_ALIAS = {
    "CRM_LEAD": "CALL",
    "CRM_FOLLOWUP": "CALL",
    "CRM_COMPLAINT": "CALL",
}


def _crm_skip(ev: dict) -> bool:
    import masters as M
    blob = " ".join(
        str(x) for x in (
            ev.get("summary"), ev.get("actor"), ev.get("type"),
            _val(ev, "customer"), _val(ev, "phone"),
        ) if x
    ).lower()
    return any(n in blob for n in M._SKIP_CONTACT)


def crm_pipeline(occupancy: str, *, events: list[dict] | None = None) -> dict:
    """Existing CALL / garage ops steps as columns. No invented leads."""
    occ = str(occupancy or "").strip().upper()
    cols = {c: [] for c in CRM_COLUMNS}
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": True,
        "reason": "",
        "columns": CRM_COLUMNS,
        "cards": cols,
        "count": 0,
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    evs = events if events is not None else load_events()
    buckets: dict[str, dict] = {}
    for ev in evs:
        if not isinstance(ev, dict):
            continue
        if occupancy_of(ev) != occ:
            continue
        if _is_leftover(ev):
            continue
        if _crm_skip(ev):
            continue
        t = str(ev.get("type") or "").strip().upper()
        if t.startswith("AUTH"):
            continue
        col = _CRM_ALIAS.get(t, t)
        if col not in CRM_COLUMNS:
            continue
        name = str(_val(ev, "customer") or "").strip()
        job = _job_key(ev)
        if not name and not job:
            continue
        key = job or name.casefold()
        if job and name:
            prior = buckets.pop(name.casefold(), None)
            if prior and prior.get("key") != key:
                b = buckets.setdefault(key, prior)
                b["key"] = key
                b["job_no"] = job
                if prior.get("customer") and not b.get("customer"):
                    b["customer"] = prior["customer"]
        b = buckets.setdefault(key, {
            "key": key,
            "job_no": job,
            "customer": name,
            "column": col,
            "occupancy": occ,
            "event_id": ev.get("id") or "",
        })
        if name and not b.get("customer"):
            b["customer"] = name
        if job and not b.get("job_no"):
            b["job_no"] = job
        # Later cycle wins when both exist on disk. Do not invent a next step.
        if CRM_COLUMNS.index(col) >= CRM_COLUMNS.index(b["column"]):
            b["column"] = col
            b["event_id"] = ev.get("id") or b.get("event_id") or ""
    for b in buckets.values():
        cols[b["column"]].append(b)
    n = sum(len(v) for v in cols.values())
    if n == 0:
        empty["reason"] = (
            "No CALL / ops party on this occupancy. Empty honest — will not invent a lead."
        )
        empty["cards"] = cols
        return empty
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "empty": False,
        "reason": "",
        "columns": CRM_COLUMNS,
        "cards": cols,
        "count": n,
    }


def load_pos_drafts() -> list[dict]:
    if not os.path.isfile(POS_DRAFTS):
        return []
    rows = []
    with open(POS_DRAFTS, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict):
                rows.append(row)
    return rows


def engine_counts(occupancy: str | None) -> list[dict]:
    """Honest outbox kind counts. No 40-cap. Occupancy-correct. Never invents qty."""
    occs = [occupancy] if occupancy in ("STARQ", "CI") else ["STARQ", "CI"]
    buckets = []
    for occ in occs:
        n = {
            "occupancy": occ,
            "label": OCCUPANCY_LABEL[occ],
            "receipts": 0,
            "purchases": 0,
            "banking": 0,
            "pos_consume": 0,
            "pos_till": 0,
            "docs_unissued": 0,
            "docs_issued": 0,
            "payroll_blocked": 0,
            "drafts": 0,
            "blocked": 0,
            "no_gl": 0,
        }
        seen = set()
        for row in load_pos_drafts():
            if (row.get("occupancy") or "CI") != occ:
                continue
            eid = str(row.get("event_id") or "")
            if eid:
                seen.add(eid)
            _tally_engine(n, row)
        for ev in load_events():
            p = propose_one(ev)
            if p is None or p.get("occupancy") != occ:
                continue
            eid = str(p.get("event_id") or ev.get("id") or "")
            if eid and eid in seen:
                continue
            _tally_engine(n, p)
        n["docs_issued"] = int(preview_next(occ, "PO").get("issued") or 0) + int(
            preview_next(occ, "INV").get("issued") or 0
        )
        import masters as M
        for h in M.payroll_gl_holds(occ):
            if h.get("status") == "blocked":
                n["payroll_blocked"] += 1
            _tally_engine(n, h)
        buckets.append(n)
    return buckets


def draft_gates(occupancy: str, *, events: list[dict] | None = None) -> dict:
    """What is blocking the next draft. Honest codes, never a fake progress %."""
    occ = str(occupancy or "").strip().upper()
    empty = {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL.get(occ, occ),
        "items": [],
        "blocking": [],
        "progress_pct": None,
        "reason": "",
    }
    if occ not in ("STARQ", "CI"):
        empty["reason"] = "Pick Starq or Club Ignition occupancy. Group is not a company."
        return empty
    import masters as M
    evs = events if events is not None else load_events()
    items: list[dict] = []

    n_ready = 0
    n_unissued = 0
    n_need_amount = 0
    for ev in evs:
        if not isinstance(ev, dict):
            continue
        if occupancy_of(ev) != occ:
            continue
        p = propose_one(ev)
        if not p:
            continue
        if p.get("copy_ready"):
            n_ready += 1
        if p.get("document") and not p.get("doc_issued") and p.get("doc_kind") in ("PO", "INV"):
            n_unissued += 1
        et = str(ev.get("type") or "")
        if et in VALUED_TYPES and _valued_amount(ev) is None:
            reason = str(p.get("reason") or "").lower()
            if "amount" in reason or p.get("status") in ("blocked", "no_gl"):
                n_need_amount += 1

    issued_n = int(preview_next(occ, "PO").get("issued") or 0) + int(
        preview_next(occ, "INV").get("issued") or 0
    )
    if n_unissued or issued_n == 0:
        note = (
            f"{n_unissued} unissued PO/INV on disk. issued={issued_n}. "
            "Authorised seat must issue before GRN or INV cash. Empty honest."
            if n_unissued else
            "issued=0 on this occupancy. GRN and INV cash wait on an authorised issue. Empty honest."
        )
        items.append({
            "code": "need-issue",
            "blocking": True,
            "label": "need issue",
            "note": note,
        })

    if occ == "CI":
        priced = False
        for p in M.products("CI"):
            if not isinstance(p, dict) or not p.get("active"):
                continue
            sku = str(p.get("sku") or "").strip().upper()
            if sku in LEFTOVER_KEYS or sku == "INK-PAINT-LEFT":
                continue
            if p.get("sell_price_mvr") not in (None, ""):
                priced = True
                break
        if not priced:
            items.append({
                "code": "need-price",
                "blocking": True,
                "label": "need price",
                "note": "sell_price_mvr empty on CI occupancy. Till sale waits. Will not invent a price.",
            })
        inv = M.inventory()
        line = next(
            (ln for ln in (inv.get("lines") or []) if ln.get("sku") == "INK-CAGE"),
            {},
        )
        st = str(line.get("qty_status") or "not_counted")
        if st != "counted" or line.get("qty") in (None, ""):
            items.append({
                "code": "need-count",
                "blocking": True,
                "label": "need count",
                "note": f"INK-CAGE {st}. Qty empty. Will not invent a count.",
            })
    else:
        items.append({
            "code": "need-price",
            "blocking": False,
            "label": "need price",
            "note": "Starq has no shop POS. Need price is not a Starq till gate.",
        })

    if n_need_amount:
        items.append({
            "code": "need-amount",
            "blocking": True,
            "label": "need amount",
            "note": (
                f"{n_need_amount} valued event(s) have no amount on disk. "
                "Type a real figure. Will not invent one."
            ),
        })

    if n_ready:
        items.append({
            "code": "dec-008-copy",
            "blocking": True,
            "label": "DEC-008 copy",
            "note": (
                f"{n_ready} copy-ready draft(s). Ali appends journals/. Ops never posts."
            ),
        })
    else:
        items.append({
            "code": "dec-008-copy",
            "blocking": False,
            "label": "DEC-008 copy",
            "note": "No copy-ready draft on this occupancy yet. Auto-post stays false (DEC-008).",
        })

    blocking = [i for i in items if i.get("blocking")]
    return {
        "occupancy": occ,
        "label": OCCUPANCY_LABEL[occ],
        "items": items,
        "blocking": blocking,
        "progress_pct": None,
        "reason": (
            "No fake progress %. Next draft waits on: "
            + ", ".join(i["label"] for i in blocking)
            if blocking else
            "No occupancy gate listed as blocking the next draft."
        ),
    }


def _tally_engine(n: dict, row: dict) -> None:
    st = row.get("status")
    if st == "draft":
        n["drafts"] += 1
    elif st == "blocked":
        n["blocked"] += 1
    elif st == "no_gl":
        n["no_gl"] += 1
    et = str(row.get("type") or "")
    if et == "RECEIPT":
        n["receipts"] += 1
    elif et == "BILL" or et in ("PURCHASE", "FIN_PAYABLE", "PARTS_PROCUREMENT"):
        n["purchases"] += 1
    if row.get("banking") or et == "FIN_BANK":
        n["banking"] += 1
    if et == "POS_CONSUME":
        n["pos_consume"] += 1
    if et == "POS_SALE":
        n["pos_till"] += 1
    if row.get("document") and not row.get("doc_issued") and row.get("doc_kind") in ("PO", "INV"):
        n["docs_unissued"] += 1


def proposals(limit: int = 40, occupancy: str | None = None) -> list[dict]:
    out = []
    for row in reversed(load_pos_drafts()):
        if occupancy in ("STARQ", "CI") and (row.get("occupancy") or "CI") != occupancy:
            continue
        out.append(row)
        if len(out) >= limit:
            return out
    for ev in reversed(load_events()):
        p = propose_one(ev)
        if p is None:
            continue
        if occupancy in ("STARQ", "CI") and (p.get("occupancy") or "CI") != occupancy:
            continue
        out.append(p)
        if len(out) >= limit:
            break
    return out


def drafts_only() -> list[dict]:
    return [p for p in proposals(80) if p.get("status") == "draft"]


def occupancy_events(occupancy: str | None = None, limit: int = 40) -> list[dict]:
    """Ops events already on disk. Occupancy-correct. Amount only if present. Never invents."""
    out = []
    for ev in reversed(load_events()):
        if not isinstance(ev, dict):
            continue
        et = str(ev.get("type") or "")
        if not et or et.startswith("auth.") or et == "AUTH":
            continue
        occ = occupancy_of(ev)
        if occupancy in ("STARQ", "CI") and occ != occupancy:
            continue
        f = ev.get("fields") if isinstance(ev.get("fields"), dict) else {}
        amt = f.get("amount") if f.get("amount") not in (None, "") else ev.get("amount")
        item = f.get("item") or f.get("item_id") or ev.get("item") or ""
        out.append({
            "id": ev.get("id") or "",
            "ts": ev.get("ts") or "",
            "type": et,
            "occupancy": occ,
            "occupancy_label": OCCUPANCY_LABEL.get(occ, occ),
            "job_no": ev.get("job_no") or f.get("job_no") or "",
            "item": item,
            "amount": "" if amt in (None, "") else amt,
        })
        if len(out) >= limit:
            break
    return out


def _parse_draft_text(draft: str) -> tuple[dict | None, list[str]]:
    """Read copy-ready text. Does not write journals/."""
    import books as B
    errors = []
    header = None
    postings = []
    for raw in (draft or "").splitlines():
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            m = B.HEADER_RE.match(line)
            if not m:
                errors.append(f"cannot read header — {line.strip()!r}")
                continue
            header = {
                "date": m.group("date"),
                "entity": m.group("entity"),
                "narration": m.group("narration"),
            }
            continue
        m = B.POSTING_RE.match(line)
        if not m:
            errors.append(f"cannot read posting — {line.strip()!r}")
            continue
        code = m.group("account")
        amt_raw = m.group("amount")
        try:
            amount = B.money(amt_raw) if amt_raw else None
        except B.LedgerError as exc:
            errors.append(str(exc))
            amount = None
        postings.append({
            "account": code,
            "amount": amount,
            "memo": (m.group("memo") or "").strip(),
        })
    if header is None:
        errors.append("no entry header")
    if len(postings) < 2:
        errors.append("an entry needs at least two postings")
    return ({"header": header, "postings": postings} if header else None), errors


def validate_draft(row: dict, accounts: dict | None = None) -> dict:
    """PASS/FAIL a copy-ready outbox draft. Never writes journals/."""
    import books as B
    fails = []
    occ = row.get("occupancy")
    et = str(row.get("type") or "")
    eid = str(row.get("event_id") or "")
    if not row.get("copy_ready"):
        return {
            "ok": False,
            "verdict": "SKIP",
            "fails": ["not copy-ready"],
            "occupancy": occ,
            "event_id": eid,
            "type": et,
            "accounts": [],
        }
    if accounts is None:
        accounts = B.load_accounts()
    if occ not in ("STARQ", "CI"):
        fails.append("occupancy must be STARQ or CI")
    draft = str(row.get("draft") or "")
    parsed, parse_err = _parse_draft_text(draft)
    fails.extend(parse_err)
    codes: list[str] = []
    if parsed and parsed.get("header"):
        ent = parsed["header"].get("entity")
        if ent not in B.ENTITIES:
            fails.append(f"unknown entity {ent!r}")
        elif occ in ("STARQ", "CI") and ent != occ:
            fails.append(f"header {ent} != occupancy {occ}")
        known = Decimal("0")
        blanks = 0
        for p in parsed.get("postings") or []:
            code = p["account"]
            codes.append(code)
            acc = accounts.get(code)
            if acc is None:
                fails.append(f"{code} is not in accounts.csv")
                continue
            if acc.get("heading"):
                fails.append(f"{code} is a heading")
            if occ in ("STARQ", "CI") and not B.account_allows(acc, occ):
                fails.append(f"{code} belongs to {acc.get('entities')}, not {occ}")
            if acc.get("status") == "blocked":
                fails.append(f"{code} is BLOCKED")
            if p["amount"] is None:
                blanks += 1
            else:
                known += p["amount"]
        if blanks > 1:
            fails.append("only one posting may be blank")
        elif blanks == 0 and known != 0:
            fails.append(f"debit!=credit out by {known:+,.2f}")
    if "4300" in codes:
        fails.append("4300 leftover blocked")
    blob_u = draft.upper()
    if "INK-PAINT-LEFT" in blob_u or "SKU-LEFTOVER-PAINT" in blob_u:
        fails.append("leftover paint blocked")
    blob = draft.lower()
    if "8%" in blob or "gst 8" in blob or "tax: 8" in blob:
        fails.append("tax must be 0 (GST not Active)")
    if live_invoice_rate() == Decimal("0") and "2200" in codes:
        fails.append("2200 GST while live tax is 0")
    if occ == "STARQ" and et in ("POS_SALE", "POS_CONSUME"):
        fails.append("Starq has no POS sale")
    ok = not fails
    return {
        "ok": ok,
        "verdict": "PASS" if ok else "FAIL",
        "fails": fails,
        "occupancy": occ,
        "event_id": eid,
        "type": et,
        "accounts": codes,
    }


def validate_copy_ready(occupancy: str | None = None, limit: int = 80) -> list[dict]:
    """Validate each copy-ready outbox draft. Occupancy-correct. Never posts."""
    import books as B
    accounts = B.load_accounts()
    out = []
    for p in proposals(limit, occupancy=occupancy):
        if not p.get("copy_ready"):
            continue
        out.append(validate_draft(p, accounts))
    return out


if __name__ == "__main__":
    rows = proposals()
    print(f"{len(rows)} proposals (auth events omitted). Drafts: {sum(1 for r in rows if r['status']=='draft')}")
    for p in rows:
        print(f"- {p['event_id']} {p['type']} {p['status']}: {p['reason']}")
        if p.get("draft"):
            print(p["draft"])
