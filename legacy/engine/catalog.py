"""the foundation engine catalog — categories, items, accountability. Not the ledger.

Reads ops/catalog/*.json. Calendar rows are derived from items (next_due /
last_posted) so there is no second hand store. Ops events never post journals.
"""

from __future__ import annotations

import json
import os
from calendar import month_abbr
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG_DIR = os.path.join(HERE, "ops", "catalog")
ACCOUNTS_CSV = os.path.join(HERE, "accounts.csv")
ALLOWED_MISSING = set()
RECURRING_RECEIPT_KINDS = frozenset({"rent", "electricity", "water"})
RECEIPT_EVENT_TYPES = frozenset({"RECEIPT", "BILL"})
GARAGE_RECEIPT_KINDS = frozenset({"purchase", "parts", "consumable"})
ALL_RECEIPT_KINDS = (
    "rent", "electricity", "water", "purchase", "parts", "consumable", "fee", "other",
)


def _read(name: str, default):
    path = os.path.join(CATALOG_DIR, name)
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception:
        return default


def chart_codes() -> set[str]:
    codes: set[str] = set()
    try:
        with open(ACCOUNTS_CSV, encoding="utf-8") as f:
            next(f, None)
            for line in f:
                code = line.split(",", 1)[0].strip()
                if code:
                    codes.add(code)
    except OSError:
        pass
    return codes


def item_visible(item: dict, entity: str | None) -> bool:
    ent = item.get("entity") or "BOTH"
    if not entity:
        return True
    return ent in (entity, "BOTH")


def calendar_view(items: list) -> list:
    """Derived from items — not a second hand-edited calendar.json."""
    out = []
    for it in items:
        if not it.get("next_due") and not it.get("last_posted"):
            continue
        out.append({
            "id": it.get("id"),
            "entity": it.get("entity"),
            "title": it.get("title"),
            "kind": it.get("kind") or it.get("category_id"),
            "amount_mvr": it.get("amount_mvr"),
            "last_posted": it.get("last_posted"),
            "next_due": it.get("next_due"),
            "monthly_on": it.get("monthly_on"),
            "certainty": it.get("certainty"),
            "note": it.get("note") or "",
        })
    return out


def receipt_events(events: list) -> list:
    out = []
    for e in events or []:
        if (e.get("type") or "") in RECEIPT_EVENT_TYPES:
            out.append(e)
    return out


def _fields(event: dict) -> dict:
    return event.get("fields") or {}


def receipts_for_item(item: dict, events: list) -> list:
    iid = item.get("id")
    kind = (item.get("kind") or "").strip().lower()
    matched = []
    for e in receipt_events(events):
        f = _fields(e)
        if iid and (f.get("item_id") or "") == iid:
            matched.append(e)
        elif kind and (f.get("kind") or "").strip().lower() == kind and not (f.get("item_id") or ""):
            matched.append(e)
    return matched


def receipts_in_month(events: list, year: int, month: int) -> list:
    prefix = f"{year:04d}-{month:02d}"
    out = []
    for e in receipt_events(events):
        f = _fields(e)
        period = (f.get("period") or "")[:7]
        bill = (f.get("bill_date") or "")[:10]
        ts = (e.get("ts") or "")[:7]
        if period == prefix or bill.startswith(prefix) or ts == prefix:
            out.append(e)
    return out


def capture_dates(events: list) -> dict[str, int]:
    counts: dict[str, int] = {}
    for e in receipt_events(events):
        d = (_fields(e).get("bill_date") or "")[:10]
        if len(d) == 10:
            counts[d] = counts.get(d, 0) + 1
    return counts


def period_status(item: dict, today: date, events: list) -> dict | None:
    """ASK / LATE / CAPTURED / POSTED / upcoming for recurring godown receipts."""
    kind = (item.get("kind") or "").strip().lower()
    monthly_on = item.get("monthly_on")
    if kind not in RECURRING_RECEIPT_KINDS or not monthly_on:
        return None
    due_s = item.get("next_due") or ""
    if len(due_s) >= 7:
        period = due_s[:7]
    else:
        period = f"{today.year:04d}-{today.month:02d}"
    try:
        y, m = int(period[:4]), int(period[5:7])
        due_day = int(monthly_on)
        due = date(y, m, due_day)
        start = date(y, m, 1)
    except ValueError:
        return None
    recs = receipts_for_item(item, events)
    captured = any((_fields(e).get("period") or "")[:7] == period for e in recs)
    if not captured:
        captured = any((_fields(e).get("bill_date") or "")[:7] == period for e in recs)
    last_posted = item.get("last_posted") or ""
    posted = bool(last_posted) and last_posted[:7] == period
    if posted:
        status = "POSTED"
    elif captured:
        status = "CAPTURED"
    elif today > due:
        status = "LATE"
    elif today >= start:
        status = "ASK"
    else:
        status = "upcoming"
    mon = month_abbr[due.month]
    title = item.get("title") or kind
    copy = f"Capture {title} for {due.strftime('%B')} before {due_day} {mon}"
    if status == "LATE":
        copy = f"LATE — {title} for {due.strftime('%B')} (due {due_day} {mon})"
    elif status == "CAPTURED":
        copy = f"Captured {title} for {due.strftime('%B')} — waiting journal (DEC-008)"
    elif status == "POSTED":
        copy = f"Posted {title} for {due.strftime('%B')} ({last_posted})"
    elif status == "upcoming":
        copy = f"{title} due {due_day} {mon} — capture before late"
    return {
        "item": item,
        "period": period,
        "status": status,
        "due": due.isoformat(),
        "copy": copy,
        "certainty": item.get("certainty") or "assumed",
    }


def annotate_accounts(items: list, chart: set[str]) -> None:
    for it in items:
        notes = []
        unknown = []
        for c in it.get("accounts") or []:
            code = str(c)
            if code in ALLOWED_MISSING and code not in chart:
                notes.append(f"{code} not on chart yet")
            elif chart and code not in chart:
                unknown.append(code)
        if notes:
            it["chart_note"] = "; ".join(notes)
        if unknown:
            it["unknown_accounts"] = unknown


def load_catalog(entity: str | None = None) -> dict:
    cats_raw = _read("categories.json", {})
    items_raw = _read("items.json", {})
    acc_raw = _read("accountability.json", {})
    quests_raw = _read("quests.json", {})
    categories = cats_raw.get("categories") if isinstance(cats_raw, dict) else cats_raw
    items = items_raw.get("items") if isinstance(items_raw, dict) else items_raw
    rows = acc_raw.get("rows") if isinstance(acc_raw, dict) else acc_raw
    if not isinstance(categories, list):
        categories = []
    if not isinstance(items, list):
        items = []
    if not isinstance(rows, list):
        rows = []
    if not isinstance(quests_raw, dict):
        quests_raw = {}
    annotate_accounts(items, chart_codes())
    visible = [i for i in items if item_visible(i, entity)]
    vis_ids = {i.get("id") for i in visible}
    vis_cats = {i.get("category_id") for i in visible}
    wiring = []
    for r in rows:
        iid = r.get("item_id")
        if iid:
            if iid in vis_ids:
                wiring.append(r)
            continue
        # Event-wired rows (garage cycle / purchase SoD) load without a catalog item.
        if r.get("event_type") or r.get("scm_step") or not r.get("category_id") or r.get("category_id") in vis_cats:
            wiring.append(r)
    as_of = None
    if isinstance(items_raw, dict):
        as_of = items_raw.get("as_of")
    return {
        "as_of": as_of,
        "categories": categories,
        "items": visible,
        "accountability": wiring,
        "quests": quests_raw,
        "items_by_id": {i["id"]: i for i in visible if i.get("id")},
        "categories_by_id": {c["id"]: c for c in categories if c.get("id")},
        "calendar": calendar_view(visible),
    }
