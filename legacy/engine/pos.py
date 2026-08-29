"""CI-only till stub. Consumes counted inventory. Drafts only. Never journals/.

Starq occupancy has no shop POS. Leftover paint is not a till item.
Does not invent a sale price or a customer.
Sale draft only when the occupancy product already has sell_price_mvr.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import journal_outbox as JO
import masters as M

HERE = os.path.dirname(os.path.abspath(__file__))
POS_DRAFTS = JO.POS_DRAFTS
POS_SEATS = M.COUNT_SEATS | frozenset({"counter", "managing_director"})


def sellable_lines() -> list[dict]:
    out = []
    for ln in M.inventory().get("lines") or []:
        if not isinstance(ln, dict):
            continue
        sku = str(ln.get("sku") or "").upper()
        if sku in ("INK-PAINT-LEFT",) or sku.startswith("ST-"):
            continue
        if ln.get("qty_status") != "counted":
            continue
        if ln.get("qty") in (None, ""):
            continue
        out.append(ln)
    return out


def priced_lines() -> list[dict]:
    """Counted CI stock that already has a real sell_price_mvr. Never invents."""
    out = []
    for ln in sellable_lines():
        if M.sell_price_mvr(ln.get("sku") or "") is None:
            continue
        out.append(ln)
    return out


def _append_draft(row: dict) -> None:
    os.makedirs(os.path.dirname(POS_DRAFTS), exist_ok=True)
    with open(POS_DRAFTS, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _ci_income(sku: str) -> tuple[str | None, str | None]:
    p = M.product_by_sku(sku)
    if p is None:
        return None, "Unknown SKU."
    if str(p.get("sku") or "").upper() == "INK-PAINT-LEFT":
        return None, "Leftover paint is not a till item (DEC-023)."
    acct = str(p.get("income_account") or "").strip()
    if acct == "4300":
        return None, "4300 blocked (DEC-023)."
    if acct in JO.STARQ_INCOME:
        return None, "Garage 4520 uses 4200–4230. Not Starq 4100/4110."
    if acct in JO.CI_INCOME:
        return acct, None
    if p.get("entity") == "CI":
        return "4200", None
    return None, "No 4200–4230 income on this SKU. Will not invent 4300."


def _take_qty(sku: str, qty: Decimal, *, occupancy: str) -> tuple[dict | None, str | None]:
    if occupancy != "CI":
        return None, "Starq occupancy has no shop POS."
    path = os.path.join(M.MASTERS, "inventory.json")
    data = M._load("inventory.json")
    found = None
    for ln in data.get("lines") or []:
        if str(ln.get("sku") or "").upper() == sku:
            found = ln
            break
    if found is None:
        return None, "Unknown SKU."
    if found.get("qty_status") != "counted":
        return None, "Count the SKU on Products before the till consumes it."
    try:
        on_hand = Decimal(str(found.get("qty")))
    except (InvalidOperation, TypeError, ValueError):
        return None, "On-hand qty is not a number."
    if qty > on_hand:
        return None, f"Oversell refused. On hand {on_hand}, asked {qty}."
    found["qty"] = float(on_hand - qty)
    found["qty_status"] = "counted"
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    data["as_of"] = now[:10]
    data["posting_now"] = (
        "CI till consumed counted qty. Sale draft if sell_price_mvr exists; "
        "else consume-only. DEC-008: ops never posts. No Starq POS."
    )
    tmp = path + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, path)
    return found, None


def consume(sku: str, qty_raw: str, *, person_id: str, seat: str, occupancy: str) -> str | None:
    """Decrement counted CI stock. Write a copy-ready COGS draft if unit cost exists."""
    if occupancy != "CI":
        return "Starq occupancy has no shop POS."
    if seat not in POS_SEATS:
        return "Seat cannot run the CI till stub."
    sku = (sku or "").strip().upper()
    if sku in ("INK-PAINT-LEFT",) or sku.startswith("ST-"):
        return "That SKU is not a CI till item (leftover 4300 / Starq service)."
    try:
        qty = Decimal(str(qty_raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return "Quantity is not a number."
    if qty <= 0:
        return "Quantity must be greater than zero."
    found, err = _take_qty(sku, qty, occupancy=occupancy)
    if err:
        return err
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    eid = f"POS-{now.replace(':', '')}"
    cost = found.get("unit_cost")
    if cost in (None, ""):
        row = JO._finish({
            "event_id": eid, "type": "POS_CONSUME", "status": "blocked",
            "reason": "Qty consumed. No unit cost. Will not invent a 1300 amount.",
            "draft": "",
        }, "CI")
        _append_draft(row)
        return None
    try:
        amt = qty * Decimal(str(cost))
    except (InvalidOperation, TypeError, ValueError):
        return "Could not multiply qty x unit cost."
    memo = "POS consume. COGS 5100 / credit 1300. DEC-008 draft. Not posted."
    draft = JO._entry(now[:10], f"POS consume - {sku}", "5100", "1300", amt, memo, "CI")
    row = JO._finish({
        "event_id": eid, "type": "POS_CONSUME", "status": "draft",
        "reason": f"Copy into {JO.COPY_INTO['CI']} then books.py check. Ops did not post.",
        "draft": draft,
    }, "CI", "5100", "1300")
    _append_draft(row)
    return None


def sell(sku: str, qty_raw: str, *, person_id: str, seat: str, occupancy: str,
         contact_id: str = "") -> str | None:
    """Sale draft from master sell_price_mvr. Refuse if empty. Never invent price."""
    if occupancy != "CI":
        return "Starq occupancy has no shop POS."
    if seat not in POS_SEATS:
        return "Seat cannot run the CI till stub."
    sku = (sku or "").strip().upper()
    if sku in ("INK-PAINT-LEFT",) or sku.startswith("ST-"):
        return "That SKU is not a CI till item (leftover 4300 / Starq service)."
    contact, cerr = M.optional_contact(contact_id, occupancy)
    if cerr:
        return cerr
    price = M.sell_price_mvr(sku)
    if price is None:
        return "No sell price on this SKU. Consume-only remains. Will not invent a till price."
    try:
        qty = Decimal(str(qty_raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return "Quantity is not a number."
    if qty <= 0:
        return "Quantity must be greater than zero."
    income, ierr = _ci_income(sku)
    if ierr:
        return ierr
    found, err = _take_qty(sku, qty, occupancy=occupancy)
    if err:
        return err
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    eid = f"POS-SALE-{now.replace(':', '')}"
    revenue = qty * price
    memo = (
        "POS sale from master sell_price_mvr. 4520 stations 4200-4230. "
        + JO.tax_master_line()
        + " DEC-008 draft. Not posted."
    )
    draft = JO._entry(now[:10], f"POS sale - {sku}", "1200", income, revenue, memo, "CI")
    cost = found.get("unit_cost")
    accounts = ["1200", income]
    if cost not in (None, ""):
        try:
            cogs = qty * Decimal(str(cost))
        except (InvalidOperation, TypeError, ValueError):
            return "Could not multiply qty x unit cost."
        cogs_memo = "POS sale COGS 5100 / credit 1300. DEC-008 draft. Not posted."
        draft += JO._entry(now[:10], f"POS COGS - {sku}", "5100", "1300", cogs, cogs_memo, "CI")
        accounts.extend(["5100", "1300"])
    row = JO._finish({
        "event_id": eid, "type": "POS_SALE", "status": "draft",
        "reason": f"Copy into {JO.COPY_INTO['CI']} then books.py check. Ops did not post.",
        "draft": draft,
        "tax": str(JO.live_invoice_rate()),
        "contact_id": (contact or {}).get("id") or "",
    }, "CI", accounts[0], accounts[1])
    row["accounts"] = accounts
    row["accounts_s"] = " ".join(accounts)
    _append_draft(row)
    return None
