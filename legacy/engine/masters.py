"""ERP-shaped masters for the foundation engine (JSON files, not a second ledger).

Organizations, contacts, products, locations, tax. Journals remain GL SSOT.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

HERE = os.path.dirname(os.path.abspath(__file__))
MASTERS = os.path.join(HERE, "ops", "masters")
AUDIT_LOG = os.path.join(HERE, "ops", "master_audit.jsonl")


def _safe_master_path(path: str) -> str:
    resolved = os.path.realpath(path)
    root = os.path.realpath(MASTERS)
    if resolved != root and not resolved.startswith(root + os.sep):
        raise ValueError(f"master path escaped masters directory: {resolved}")
    return resolved

# Tests set this to a list so they never create ops/master_audit.jsonl.
_AUDIT_ROWS = None

AUDIT_ACTIONS = frozenset({
    "contact.create", "sku.create", "location.create",
    "employee.create", "price.set", "count.set", "grn.qty",
})


def append_audit(*, action: str, occupancy: str, person_id: str, seat: str,
                 record_id: str = "", summary: str = "") -> None:
    """Append-only master-create log. Occupancy-correct. Never journals/. No fake history."""
    if occupancy not in ("STARQ", "CI"):
        return
    if action not in AUDIT_ACTIONS:
        return
    row = {
        "ts": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "action": action,
        "occupancy": occupancy,
        "person_id": person_id or "",
        "seat": seat or "",
        "record_id": record_id or "",
        "summary": (summary or "")[:500],
    }
    if _AUDIT_ROWS is not None:
        _AUDIT_ROWS.append(row)
        return
    os.makedirs(os.path.dirname(AUDIT_LOG), exist_ok=True)
    with open(AUDIT_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def load_audit(occupancy: str | None = None, limit: int = 40) -> list[dict]:
    """Rows already on disk. Occupancy filter. Empty file is honest — no invented history."""
    if _AUDIT_ROWS is not None:
        rows = list(_AUDIT_ROWS)
    elif not os.path.isfile(AUDIT_LOG):
        rows = []
    else:
        rows = []
        with open(AUDIT_LOG, encoding="utf-8") as f:
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
    out = []
    for row in reversed(rows):
        occ = str(row.get("occupancy") or "")
        if occupancy in ("STARQ", "CI") and occ != occupancy:
            continue
        out.append(row)
        if len(out) >= limit:
            break
    return out


def _load(name: str) -> dict:
    path = _safe_master_path(os.path.join(MASTERS, name))
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def organizations() -> list[dict]:
    return list(_load("organizations.json")["organizations"])


def locations(entity: str | None) -> list[dict]:
    rows = list(_load("locations.json")["locations"])
    return _filter(rows, entity)


LOCATION_CREATE_SEATS = frozenset({
    "director", "managing_director", "financial_controller",
})
LOCATION_KINDS = frozenset({"office", "workshop", "warehouse", "godown", "other"})
_SHOP_KINDS = frozenset({"shop", "pos", "retail", "storefront", "till"})
_LOCATION_PATH = os.path.join(MASTERS, "locations.json")


def may_create_location(seat: str, occupancy: str | None) -> bool:
    if occupancy not in ("STARQ", "CI"):
        return False
    return (seat or "") in LOCATION_CREATE_SEATS


def create_location(*, name: str, kind: str, occupancy: str, seat: str,
                    person_id: str) -> tuple[dict | None, str | None]:
    """Occupancy site: name + type. No seed, no POS floor, no fake H. Kiev clone."""
    if occupancy not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy."
    if not may_create_location(seat, occupancy):
        return None, "Seat cannot create locations."
    kind = (kind or "").strip().lower()
    if kind in _SHOP_KINDS or kind == "shop floor":
        return None, "No shop POS site. Starq has no shop floor. CI till is not a new location."
    if kind not in LOCATION_KINDS:
        return None, "Type must be office, workshop, warehouse, godown, or other."
    if occupancy == "STARQ" and kind in ("workshop", "godown"):
        return None, "Starq occupancy has no garage or godown. Use office, warehouse, or other."
    name = " ".join((name or "").split())
    if not name:
        return None, "Name is required."
    blob = name.casefold()
    if "leftover" in blob and "paint" in blob:
        return None, "Leftover paint is not a site."
    if len(name) > 120:
        return None, "Name is too long."
    data = _load("locations.json")
    rows = list(data.get("locations") or [])
    for r in rows:
        if r.get("entity") != occupancy:
            continue
        if (r.get("name") or "").casefold() == name.casefold() and (r.get("kind") or "") == kind:
            return None, "Already on this occupancy."
    prefix = "ST-LOC" if occupancy == "STARQ" else "CI-LOC"
    n = 1
    for r in rows:
        lid = str(r.get("id") or "")
        if lid.startswith(prefix + "-"):
            try:
                n = max(n, int(lid.split("-")[-1]) + 1)
            except ValueError:
                pass
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    row = {
        "id": f"{prefix}-{n}",
        "entity": occupancy,
        "kind": kind,
        "name": name,
        "is_warehouse": kind in ("warehouse", "godown"),
        "is_pos": False,
        "accounts_hint": [],
        "note": "Created empty. Not a shop POS. Journals untouched.",
        "created_by": person_id,
        "created_at": now,
        "source": "master",
    }
    rows.append(row)
    data["locations"] = rows
    data["as_of"] = now[:10]
    tmp = _LOCATION_PATH + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, _LOCATION_PATH)
    append_audit(
        action="location.create", occupancy=occupancy, person_id=person_id,
        seat=seat, record_id=row["id"],
        summary=f"{kind} {name}",
    )
    return row, None


CONTACT_CREATE_SEATS = frozenset({
    "director", "managing_director", "financial_controller", "counter",
})
CONTACT_KINDS = frozenset({"customer", "vendor", "other"})
_CONTACT_PATH = os.path.join(MASTERS, "contacts.json")


def contacts(entity: str | None) -> list[dict]:
    rows = list(_load("contacts.json")["contacts"])
    return _filter(rows, entity)


def may_create_contact(seat: str, occupancy: str | None) -> bool:
    if occupancy not in ("STARQ", "CI"):
        return False
    return (seat or "") in CONTACT_CREATE_SEATS


def create_contact(*, name: str, kind: str, occupancy: str, seat: str,
                   person_id: str) -> tuple[dict | None, str | None]:
    """Write one occupancy-scoped master row. No seed, no invented email."""
    if occupancy not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy."
    if not may_create_contact(seat, occupancy):
        return None, "Seat cannot create contacts."
    kind = (kind or "").strip().lower()
    if kind == "supplier":
        kind = "vendor"
    if kind not in CONTACT_KINDS:
        return None, "Type must be customer, vendor, or other."
    name = " ".join((name or "").split())
    if not name:
        return None, "Name is required."
    if "@" in name:
        return None, "Name is not an email. Do not store Gmails here."
    if len(name) > 120:
        return None, "Name is too long."
    data = _load("contacts.json")
    rows = list(data.get("contacts") or [])
    for r in rows:
        if r.get("entity") == occupancy and (r.get("kind") or "") == kind:
            if (r.get("name") or "").casefold() == name.casefold():
                return None, "Already on this occupancy master."
    prefix = "ST-CT" if occupancy == "STARQ" else "CI-CT"
    n = 1
    for r in rows:
        cid = str(r.get("id") or "")
        if cid.startswith(prefix + "-"):
            try:
                n = max(n, int(cid.split("-")[-1]) + 1)
            except ValueError:
                pass
    row = {
        "id": f"{prefix}-{n}",
        "entity": occupancy,
        "kind": kind,
        "name": name,
        "phone": "",
        "email": "",
        "tin": "",
        "credit_limit": None,
        "payment_terms": "",
        "tax_treatment": "",
        "created_by": person_id,
        "created_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "source": "master",
    }
    rows.append(row)
    data["contacts"] = rows
    data["as_of"] = row["created_at"][:10]
    tmp = _CONTACT_PATH + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, _CONTACT_PATH)
    append_audit(
        action="contact.create", occupancy=occupancy, person_id=person_id,
        seat=seat, record_id=row["id"],
        summary=f"{kind} {name}",
    )
    return row, None


def create_contact_from_call(*, event_id: str, occupancy: str, seat: str,
                             person_id: str) -> tuple[dict | None, str | None]:
    """Add a CALL party already named on ops. Never invents a name."""
    eid = str(event_id or "").strip()
    if not eid:
        return None, "CALL event id required."
    if occupancy not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy."
    import journal_outbox as JO
    ev = None
    for row in JO.load_events():
        if str(row.get("id") or "") == eid:
            ev = row
            break
    if ev is None:
        return None, "Unknown ops event."
    if (ev.get("type") or "") != "CALL":
        return None, "Not a CALL event."
    if JO.occupancy_of(ev) != occupancy:
        return None, "Occupancy mismatch."
    name = str(JO._val(ev, "customer") or "").strip()
    if not name:
        return None, "CALL has no name string. Will not invent a party."
    if any(n in name.lower() for n in _SKIP_CONTACT):
        return None, "Smoke / test CALL is not a contact."
    if "@" in name:
        return None, "Name is not an email. Do not store Gmails here."
    phone = str(JO._val(ev, "phone") or "").strip()
    row, err = create_contact(
        name=name, kind="customer", occupancy=occupancy,
        seat=seat, person_id=person_id,
    )
    if err or not row:
        return row, err
    if phone and not row.get("phone"):
        data = _load("contacts.json")
        for r in data.get("contacts") or []:
            if r.get("id") == row["id"]:
                r["phone"] = phone
                row = r
                break
        data["as_of"] = row.get("created_at", "")[:10] or data.get("as_of")
        tmp = _CONTACT_PATH + ".tmp"
        payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(payload)
        os.replace(tmp, _CONTACT_PATH)
    return row, None


def contact_on_occupancy(contact_id: str, occupancy: str) -> dict | None:
    cid = str(contact_id or "").strip()
    if not cid or occupancy not in ("STARQ", "CI"):
        return None
    for row in contacts(occupancy):
        if str(row.get("id") or "") == cid:
            return row
    return None


def optional_contact(contact_id: str, occupancy: str) -> tuple[dict | None, str | None]:
    cid = str(contact_id or "").strip()
    if not cid:
        return None, None
    row = contact_on_occupancy(cid, occupancy)
    if row is None:
        return None, (
            "contact_id is not on this occupancy master. "
            "Will not create a contact to satisfy the link."
        )
    return row, None


_PRODUCT_PATH = os.path.join(MASTERS, "products.json")
PRICE_SEATS = frozenset({
    "director", "managing_director", "financial_controller", "ledger_poster",
})
_LEFTOVER_SKU = "INK-PAINT-LEFT"


def products(entity: str | None) -> list[dict]:
    rows = list(_load("products.json")["products"])
    return _filter(rows, entity)


def product_by_sku(sku: str) -> dict | None:
    want = (sku or "").strip().upper()
    if not want:
        return None
    for p in _load("products.json").get("products") or []:
        if isinstance(p, dict) and str(p.get("sku") or "").strip().upper() == want:
            return p
    return None


def sell_price_mvr(sku: str) -> Decimal | None:
    p = product_by_sku(sku)
    if not p:
        return None
    raw = p.get("sell_price_mvr")
    if raw in (None, ""):
        return None
    try:
        return Decimal(str(raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None


def may_set_sell_price(seat: str, occupancy: str | None) -> bool:
    if occupancy not in ("STARQ", "CI"):
        return False
    return (seat or "") in PRICE_SEATS


def set_sell_price(sku: str, price_raw: str, *, occupancy: str, seat: str,
                   person_id: str) -> tuple[dict | None, str | None]:
    """Occupancy-scoped optional sell price. Empty/null is honest. Never invents."""
    if occupancy not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy."
    if not may_set_sell_price(seat, occupancy):
        return None, "Seat cannot set a sell price."
    sku = (sku or "").strip().upper()
    if sku in (_LEFTOVER_SKU,) or sku.startswith("LEFTOVER"):
        return None, "Leftover paint cannot get a sell price (DEC-023 / 4300)."
    data = _load("products.json")
    found = None
    for p in data.get("products") or []:
        if str(p.get("sku") or "").strip().upper() == sku:
            found = p
            break
    if found is None:
        return None, "Unknown SKU."
    if found.get("entity") != occupancy:
        return None, "SKU is not on this occupancy master."
    if str(found.get("income_account") or "") == "4300" or found.get("active") is False:
        return None, "Leftover paint cannot get a sell price (DEC-023 / 4300)."
    raw = (price_raw or "").strip()
    if not raw:
        found["sell_price_mvr"] = None
        price_out = None
    else:
        try:
            price = Decimal(raw.replace(",", ""))
        except (InvalidOperation, ValueError):
            return None, "Sell price is not a number."
        if price <= 0:
            return None, "Sell price must be greater than zero, or leave empty."
        found["sell_price_mvr"] = float(price)
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    found["sell_price_set_by"] = person_id
    found["sell_price_set_at"] = now
    data["as_of"] = now[:10]
    tmp = _PRODUCT_PATH + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, _PRODUCT_PATH)
    shown = "cleared" if found.get("sell_price_mvr") in (None, "") else str(found.get("sell_price_mvr"))
    append_audit(
        action="price.set", occupancy=occupancy, person_id=person_id,
        seat=seat, record_id=sku,
        summary=f"sell_price_mvr {shown}",
    )
    return found, None


SKU_CREATE_SEATS = PRICE_SEATS
_LEFTOVER_SKUS = frozenset({"INK-PAINT-LEFT", "SKU-LEFTOVER-PAINT"})
_INVENTORY_PATH = os.path.join(MASTERS, "inventory.json")


def may_create_sku(seat: str, occupancy: str | None) -> bool:
    if occupancy not in ("STARQ", "CI"):
        return False
    return (seat or "") in SKU_CREATE_SEATS


def _leftover_sku(sku: str, name: str = "") -> bool:
    su = (sku or "").strip().upper()
    blob = f"{su} {(name or '').upper()}"
    if su in _LEFTOVER_SKUS or su.startswith("LEFTOVER"):
        return True
    if "LEFTOVER" in blob and "PAINT" in blob:
        return True
    return False


def _write_json(path: str, data: dict) -> None:
    path = _safe_master_path(path)
    tmp = path + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, path)


def create_sku(*, sku: str, name: str, occupancy: str, seat: str,
               person_id: str) -> tuple[dict | None, str | None]:
    """Occupancy SKU: id + name. sell_price and qty stay empty. No leftover. No seed."""
    if occupancy not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy."
    if not may_create_sku(seat, occupancy):
        return None, "Seat cannot create SKUs."
    sku = (sku or "").strip().upper()
    name = " ".join((name or "").split())
    if not sku:
        return None, "SKU is required."
    if not name:
        return None, "Name is required."
    if len(sku) > 40 or " " in sku:
        return None, "SKU must be one token, 40 characters or less."
    if len(name) > 120:
        return None, "Name is too long."
    if _leftover_sku(sku, name) or sku.endswith("-LEFT"):
        return None, "Leftover paint cannot be created again (DEC-023 / 4300)."
    data = _load("products.json")
    rows = list(data.get("products") or [])
    for p in rows:
        existing = str(p.get("sku") or "").strip().upper()
        if existing == sku:
            return None, "SKU already on the product master."
        if str(p.get("id") or "") == sku:
            return None, "That id already exists."
    prefix = "st" if occupancy == "STARQ" else "ci"
    n = 1
    for p in rows:
        pid = str(p.get("id") or "")
        if pid.startswith(f"sku-{prefix}-"):
            try:
                n = max(n, int(pid.split("-")[-1]) + 1)
            except ValueError:
                pass
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    stock = occupancy == "CI"
    row = {
        "id": f"sku-{prefix}-{n}",
        "entity": occupancy,
        "type": "consumable" if stock else "service",
        "sku": sku,
        "name": name,
        "income_account": None,
        "cogs_account": "5100" if stock else None,
        "inventory_account": "1300" if stock else None,
        "tax": "none_until_gst_active",
        "active": True,
        "sell_price_mvr": None,
        "created_by": person_id,
        "created_at": now,
        "note": "Created empty. No sell price. Qty not counted.",
    }
    rows.append(row)
    data["products"] = rows
    data["as_of"] = now[:10]
    inv = _load("inventory.json")
    lines = list(inv.get("lines") or [])
    if not any(str(ln.get("sku") or "").strip().upper() == sku for ln in lines):
        lines.append({
            "sku": sku,
            "product_id": row["id"],
            "qty_status": "not_counted" if stock else "service",
            "qty": None,
            "uom": "unit" if stock else None,
        })
        inv["lines"] = lines
        inv["as_of"] = now[:10]
    _write_json(_PRODUCT_PATH, data)
    _write_json(_INVENTORY_PATH, inv)
    append_audit(
        action="sku.create", occupancy=occupancy, person_id=person_id,
        seat=seat, record_id=row["sku"],
        summary=name,
    )
    return row, None


def inventory() -> dict:
    return _load("inventory.json")


def tax() -> dict:
    path = os.path.join(MASTERS, "tax.json")
    if not os.path.isfile(path):
        return {
            "gst_status": "not_registered",
            "live_invoice_rate": 0,
            "note": "No 8% on a live invoice until GST is Active on MIRA.",
        }
    return _load("tax.json")


def occupancy_slug(entity: str | None) -> str | None:
    if entity == "STARQ":
        return "starq"
    if entity == "CI":
        return "club-ignition"
    return None


def users(entity: str | None) -> list[dict]:
    rows = list(_load("users.json")["users"])
    slug = occupancy_slug(entity)
    if not slug:
        return rows
    return [u for u in rows if slug in (u.get("entities") or [])]


def permissions() -> dict:
    return _load("permissions.json")


def permission_matrix() -> dict:
    """Seat × action from permissions.json. Read-only. No invented seats."""
    data = permissions()
    seats = data.get("seats") or {}
    seat_order = [s for s in seats.keys() if isinstance(s, str)]
    events = []
    seen = set()
    for evts in seats.values():
        if not isinstance(evts, list):
            continue
        for e in evts:
            if e not in seen:
                seen.add(e)
                events.append(e)
    actions = []
    modules = data.get("modules") if isinstance(data.get("modules"), dict) else {}
    for name, allowed in modules.items():
        actions.append({
            "id": str(name),
            "label": str(name).replace("_", " "),
            "seats": list(allowed or []) if isinstance(allowed, list) else [],
        })
    for kind, allowed in (data.get("document_issue") or {}).items():
        actions.append({
            "id": f"issue:{kind}",
            "label": f"issue {str(kind).upper()}",
            "seats": list(allowed or []) if isinstance(allowed, list) else [],
        })
    for key in ("contacts_create", "payroll_create", "payroll_rate_set",
                "sell_price_set", "sku_create", "locations_create"):
        if key in data and key not in modules:
            allowed = data.get(key)
            actions.append({
                "id": key,
                "label": key.replace("_", " "),
                "seats": list(allowed or []) if isinstance(allowed, list) else [],
            })
    event_grid = {}
    action_grid = {}
    for seat in seat_order:
        allowed_ev = set(seats.get(seat) or [])
        event_grid[seat] = {e: e in allowed_ev for e in events}
        action_grid[seat] = {
            a["id"]: seat in (a["seats"] or [])
            for a in actions
        }
    return {
        "seats": seat_order,
        "events": events,
        "actions": actions,
        "event_grid": event_grid,
        "action_grid": action_grid,
        "note": data.get("note") or "",
        "invariants": list(data.get("invariants") or []),
    }


def payroll() -> dict:
    return _load("payroll.json")


EMPLOYEE_CREATE_SEATS = frozenset({
    "director", "managing_director", "financial_controller",
})
JOB_SEATS = frozenset({
    "managing_director", "director", "financial_controller", "quartermaster",
    "receiver", "payer", "counter", "technician", "qc_signer", "stores",
    "ledger_poster",
})
_PAYROLL_PATH = os.path.join(MASTERS, "payroll.json")
_NASHID_NAMES = frozenset({"nashid"})


def employees(entity: str | None) -> list[dict]:
    rows = list(payroll().get("employees") or [])
    return _filter(rows, entity)


def may_create_employee(seat: str, occupancy: str | None) -> bool:
    if occupancy not in ("STARQ", "CI"):
        return False
    return (seat or "") in EMPLOYEE_CREATE_SEATS


def _employee_person_link(name: str, occupancy: str) -> tuple[str | None, str | None]:
    """Attach users.json person_id when the name already is that person. Never invent."""
    slug = occupancy_slug(occupancy)
    if not slug:
        return None, "Pick Starq or Club Ignition occupancy."
    hits = []
    for u in _load("users.json").get("users") or []:
        pid = (u.get("person_id") or "").strip()
        label = (u.get("label") or "").strip()
        if name.casefold() in {pid.casefold(), label.casefold()}:
            hits.append(u)
    if not hits:
        return "", None
    if len(hits) != 1:
        return None, "Name matches more than one users.json person."
    u = hits[0]
    pid = (u.get("person_id") or "").strip()
    ents = [str(x) for x in (u.get("entities") or [])]
    never = [str(x) for x in (u.get("never") or [])]
    if occupancy == "STARQ" and (
        pid.casefold() in _NASHID_NAMES or "starq" in never or slug not in ents
    ):
        return None, "Nashid never on Starq seats."
    if slug not in ents:
        return None, "That person is not on this occupancy (users.json)."
    return pid, None


def create_employee(*, name: str, seat: str, occupancy: str, actor_seat: str,
                    person_id: str) -> tuple[dict | None, str | None]:
    """Write one occupancy employment row. Name + job seat only. No salary."""
    if occupancy not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy."
    if not may_create_employee(actor_seat, occupancy):
        return None, "Seat cannot create employees."
    job = (seat or "").strip().lower()
    if job not in JOB_SEATS:
        return None, "Seat must be a known job seat."
    name = " ".join((name or "").split())
    if not name:
        return None, "Name is required."
    if "@" in name:
        return None, "Name is not an email. Do not store Gmails here."
    if len(name) > 120:
        return None, "Name is too long."
    if occupancy == "STARQ" and name.casefold() in _NASHID_NAMES:
        return None, "Nashid never on Starq seats."
    linked, link_err = _employee_person_link(name, occupancy)
    if link_err:
        return None, link_err
    data = _load("payroll.json")
    rows = list(data.get("employees") or [])
    for r in rows:
        if r.get("entity") == occupancy and (r.get("seat") or "") == job:
            if (r.get("name") or "").casefold() == name.casefold():
                return None, "Already on this occupancy roster."
    prefix = "ST-EE" if occupancy == "STARQ" else "CI-EE"
    n = 1
    for r in rows:
        eid = str(r.get("id") or "")
        if eid.startswith(prefix + "-"):
            try:
                n = max(n, int(eid.split("-")[-1]) + 1)
            except ValueError:
                pass
    row = {
        "id": f"{prefix}-{n}",
        "entity": occupancy,
        "name": name,
        "seat": job,
        "person_id": linked or "",
        "rate_mvr": None,
        "created_by": person_id,
        "created_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "source": "payroll",
    }
    rows.append(row)
    data["employees"] = rows
    data["as_of"] = row["created_at"][:10]
    tmp = _PAYROLL_PATH + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, _PAYROLL_PATH)
    append_audit(
        action="employee.create", occupancy=occupancy, person_id=person_id,
        seat=actor_seat, record_id=row["id"],
        summary=f"{job} {name}",
    )
    return row, None


def may_set_employee_rate(seat: str, occupancy: str | None) -> bool:
    if occupancy not in ("STARQ", "CI"):
        return False
    return (seat or "") in EMPLOYEE_CREATE_SEATS


def set_employee_rate(employee_id: str, rate_raw: str, *, occupancy: str, seat: str,
                      person_id: str) -> tuple[dict | None, str | None]:
    """Optional rate_mvr on an employment row. Empty clears. Never invents pay."""
    if occupancy not in ("STARQ", "CI"):
        return None, "Pick Starq or Club Ignition occupancy."
    if not may_set_employee_rate(seat, occupancy):
        return None, "Seat cannot set a payroll rate."
    eid = (employee_id or "").strip()
    if not eid:
        return None, "Employee id is required."
    data = _load("payroll.json")
    rows = list(data.get("employees") or [])
    found = None
    for r in rows:
        if str(r.get("id") or "") == eid:
            found = r
            break
    if found is None:
        return None, "Unknown employee id."
    if found.get("entity") != occupancy:
        return None, "Employee is not on this occupancy roster."
    raw = (rate_raw or "").strip()
    if not raw:
        found["rate_mvr"] = None
        shown = "cleared"
    else:
        try:
            rate = Decimal(raw.replace(",", ""))
        except (InvalidOperation, ValueError):
            return None, "Rate is not a number."
        if rate <= 0:
            return None, "Rate must be greater than zero, or leave empty."
        found["rate_mvr"] = float(rate)
        shown = str(found["rate_mvr"])
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    found["rate_set_by"] = person_id
    found["rate_set_at"] = now
    data["employees"] = rows
    data["as_of"] = now[:10]
    tmp = _PAYROLL_PATH + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, _PAYROLL_PATH)
    append_audit(
        action="employee.rate", occupancy=occupancy, person_id=person_id,
        seat=seat, record_id=eid,
        summary=f"rate_mvr {shown}",
    )
    return found, None


def _employee_rate(row: dict) -> Decimal | None:
    raw = row.get("rate_mvr")
    if raw in (None, ""):
        return None
    try:
        amt = Decimal(str(raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None
    if amt <= 0:
        return None
    return amt


def payroll_gl_holds(occupancy: str | None) -> list[dict]:
    """Draft 6100 only from rates on disk. Empty roster or empty rates refuse. Never posts."""
    import journal_outbox as JO
    if occupancy not in ("STARQ", "CI"):
        return []
    rows = employees(occupancy)
    valued = []
    for r in rows:
        amt = _employee_rate(r)
        if amt is not None:
            valued.append((r, amt))
    if not valued:
        if not rows:
            reason = (
                "No employees on this occupancy. Will not invent staff or salaries. "
                "users.json is the login master, not a payroll seed."
            )
        else:
            reason = (
                "Rates empty on disk. Will not invent pay. No payroll GL draft until "
                "rate_mvr is written on an employment row."
            )
        return [JO._finish({
            "event_id": f"PAYROLL-{occupancy}",
            "type": "PAYROLL_RUN",
            "status": "blocked",
            "reason": reason,
            "draft": "",
        }, occupancy)]
    total = sum((amt for _r, amt in valued), Decimal("0"))
    day = "YYYY-MM-DD"
    lines = []
    for r, amt in valued:
        lines.append(f"  # {r.get('name')} · {r.get('seat')} · {amt:,.2f}")
    amt_s = f"{total:,.2f}"
    token = occupancy
    draft = (
        f'{day} {token} "Payroll run — rates on disk"\n'
        + "\n".join(lines) + "\n"
        f"  6100    {amt_s}   # DEC-008 draft. Copy only. Not posted.\n"
        f"  2210   -{amt_s}   # withholding / payables — split when real deductions exist\n"
    )
    return [JO._finish({
        "event_id": f"PAYROLL-{occupancy}",
        "type": "PAYROLL_RUN",
        "status": "draft",
        "reason": "Copy into the occupancy journal then books.py check. Ops did not post. Deductions not invented.",
        "draft": draft,
    }, occupancy, "6100", "2210")]


def org_for_entity(entity: str | None) -> dict | None:
    if entity == "STARQ":
        want = "starq"
    elif entity == "CI":
        want = "club-ignition"
    else:
        return None
    for o in organizations():
        if o.get("id") == want:
            return o
    return None


def _filter(rows: list[dict], entity: str | None) -> list[dict]:
    if not entity:
        return rows
    return [r for r in rows if r.get("entity") == entity]


_SKIP_CONTACT = (
    "not a real customer",
    "pack smoke",
    "test call",
    "cursor-smoke",
)


def contacts_from_ops(entity: str | None) -> list[dict]:
    """Names that already appeared on occupancy ops events. Does not invent CRM rows."""
    import journal_outbox as JO
    occ = entity if entity in ("STARQ", "CI") else None
    seen: dict[tuple, dict] = {}
    for ev in JO.load_events():
        if not isinstance(ev, dict):
            continue
        ev_occ = JO.occupancy_of(ev)
        if occ and ev_occ != occ:
            continue
        if str(ev.get("type") or "").startswith("AUTH"):
            continue
        blob = " ".join(
            str(x) for x in (ev.get("summary"), ev.get("actor"), ev.get("type")) if x
        ).lower()
        if any(n in blob for n in _SKIP_CONTACT):
            continue
        fields = ev.get("fields") if isinstance(ev.get("fields"), dict) else {}
        for kind, key in (("customer", "customer"), ("supplier", "supplier")):
            name = str(fields.get(key) or ev.get(key) or "").strip()
            if not name or any(n in name.lower() for n in _SKIP_CONTACT):
                continue
            if "@" in name:
                continue
            phone = str(fields.get("phone") or ev.get("phone") or "").strip()
            k = (kind, name.lower())
            shown = "vendor" if kind == "supplier" else kind
            if k not in seen:
                call_id = ""
                if (ev.get("type") or "") == "CALL" and kind == "customer":
                    call_id = str(ev.get("id") or "")
                seen[k] = {
                    "kind": shown,
                    "name": name,
                    "phone": phone or "—",
                    "email": "",
                    "source": "ops",
                    "master": False,
                    "entity": ev_occ,
                    "label": "ops-derived (not a master)",
                    "call_event_id": call_id,
                }
            elif (ev.get("type") or "") == "CALL" and kind == "customer":
                if not seen[k].get("call_event_id"):
                    seen[k]["call_event_id"] = str(ev.get("id") or "")
    return list(seen.values())


COUNT_SEATS = frozenset({"director", "ledger_poster", "stores", "financial_controller"})
GRN_QTY_SEATS = COUNT_SEATS | frozenset({"receiver", "managing_director"})
_BLOCKED_COUNT = frozenset({"INK-PAINT-LEFT", "not_for_sale"})


def apply_stock_count(sku: str, qty_raw: str, *, person_id: str, seat: str,
                     unit_cost_raw: str = "") -> str | None:
    """Write qty onto inventory.json. Never opens journals/. 4300 leftover refused."""
    if seat not in COUNT_SEATS:
        return "Seat cannot record a stock take."
    sku = (sku or "").strip().upper()
    if sku in ("INK-PAINT-LEFT",):
        return "Leftover paint is not for sale and is not counted as POS stock (DEC-023)."
    try:
        qty = Decimal(str(qty_raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return "Quantity is not a number."
    if qty < 0:
        return "Quantity cannot be negative."
    unit_cost = None
    if (unit_cost_raw or "").strip():
        try:
            unit_cost = Decimal(str(unit_cost_raw).replace(",", "").strip())
        except (InvalidOperation, ValueError):
            return "Unit cost is not a number."
        if unit_cost < 0:
            return "Unit cost cannot be negative."
    path = os.path.join(MASTERS, "inventory.json")
    data = _load("inventory.json")
    found = None
    for ln in data.get("lines") or []:
        if str(ln.get("sku") or "").upper() == sku:
            found = ln
            break
    if found is None:
        return "Unknown SKU."
    st = found.get("qty_status")
    if st in ("service", "not_for_sale"):
        return "That SKU is not countable stock."
    found["qty"] = float(qty)
    found["qty_status"] = "counted"
    found["uom"] = found.get("uom") or "unit"
    found["counted_at"] = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    found["counted_by"] = person_id
    if unit_cost is not None:
        found["unit_cost"] = float(unit_cost)
        found["value_mvr"] = float(qty * unit_cost)
    else:
        found.pop("unit_cost", None)
        found.pop("value_mvr", None)
    data["as_of"] = found["counted_at"][:10]
    data["posting_now"] = (
        "Qty is on disk. Counted SKU with unit cost: purchase drafts debit 1300 (copy only). Uncosted stays 5100. Leftover refused. DEC-008: ops never posts."
    )
    tmp = path + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, path)
    prod = product_by_sku(sku)
    occ = prod.get("entity") if isinstance(prod, dict) else None
    if occ in ("STARQ", "CI"):
        cost_s = "" if unit_cost is None else f" unit_cost={unit_cost}"
        append_audit(
            action="count.set", occupancy=occ, person_id=person_id,
            seat=seat, record_id=sku,
            summary=f"qty={qty}{cost_s}",
        )
    return None


def apply_grn_qty(*, sku: str, qty_raw, occupancy: str, person_id: str,
                  seat: str) -> tuple[dict | None, str | None]:
    """Increment on-hand only if this SKU is already counted. Never invents opening qty."""
    if occupancy not in ("STARQ", "CI"):
        return None, "Occupancy required."
    if seat not in GRN_QTY_SEATS:
        return None, "Seat cannot bump GRN qty."
    sku = (sku or "").strip().upper()
    if not sku:
        return None, "SKU missing. Will not invent a stock line."
    if sku in ("INK-PAINT-LEFT",):
        return None, "Leftover paint is not for sale and is not counted as POS stock (DEC-023)."
    try:
        add = Decimal(str(qty_raw).replace(",", "").strip())
    except (InvalidOperation, ValueError, AttributeError):
        return None, "Receive qty is not a number. Will not invent it."
    if add <= 0:
        return None, "Receive qty must be positive."
    prod = product_by_sku(sku)
    pent = (prod or {}).get("entity") if isinstance(prod, dict) else None
    if pent and pent != occupancy:
        return None, "SKU occupancy mismatch."
    path = os.path.join(MASTERS, "inventory.json")
    data = _load("inventory.json")
    found = None
    for ln in data.get("lines") or []:
        if str(ln.get("sku") or "").upper() == sku:
            found = ln
            break
    if found is None:
        return None, "Unknown SKU. Will not invent a stock line."
    st = found.get("qty_status")
    if st in ("service", "not_for_sale"):
        return None, "That SKU is not countable stock."
    if st != "counted" or found.get("qty") in (None, ""):
        return None, (
            f"{sku} is not counted. Count on Products. Will not invent opening qty."
        )
    try:
        on_hand = Decimal(str(found.get("qty")))
    except (InvalidOperation, ValueError, TypeError):
        return None, f"{sku} on-hand is not a number. Will not invent opening qty."
    new_qty = on_hand + add
    found["qty"] = float(new_qty)
    found["qty_status"] = "counted"
    cost = found.get("unit_cost")
    if cost not in (None, ""):
        try:
            found["value_mvr"] = float(new_qty * Decimal(str(cost)))
        except (InvalidOperation, ValueError, TypeError):
            pass
    data["as_of"] = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")[:10]
    tmp = path + ".tmp"
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, path)
    append_audit(
        action="grn.qty", occupancy=occupancy, person_id=person_id,
        seat=seat, record_id=sku,
        summary=f"+{add} on_hand={new_qty}",
    )
    return {"sku": sku, "qty": float(new_qty), "added": float(add)}, None


def inventory_gl_holds() -> list[dict]:
    """Counted stock. Draft 1300 only when unit cost was given. Never posts."""
    out = []
    for ln in inventory().get("lines") or []:
        if ln.get("qty_status") != "counted":
            continue
        sku = ln.get("sku")
        qty = ln.get("qty")
        cost = ln.get("unit_cost")
        if cost in (None, ""):
            import journal_outbox as JO
            out.append(JO._finish({
                "sku": sku,
                "qty": qty,
                "event_id": f"COUNT-{sku}",
                "type": "STOCK_COUNT",
                "status": "blocked",
                "reason": "Qty on disk. No unit cost. Will not invent a 1300 amount. Purchases still 5100. DEC-008.",
                "draft": "",
            }, "CI"))
            continue
        try:
            amt = Decimal(str(qty)) * Decimal(str(cost))
        except (InvalidOperation, TypeError, ValueError):
            out.append(JO._finish({
                "sku": sku, "qty": qty, "event_id": f"COUNT-{sku}", "type": "STOCK_COUNT",
                "status": "blocked",
                "reason": "Could not multiply qty x unit cost.",
                "draft": "",
            }, "CI"))
            continue
        day = str(ln.get("counted_at") or "")[:10] or "YYYY-MM-DD"
        amt_s = f"{amt:,.2f}"
        draft = (
            f'{day} CI "Opening counted stock - {sku}"\n'
            f"  1300    {amt_s}   # DEC-008 draft. Copy only. Not posted.\n"
            f"  5100   -{amt_s}   # reverse prior expense into inventory\n"
        )
        import journal_outbox as JO
        out.append(JO._finish({
            "event_id": f"COUNT-{sku}",
            "type": "STOCK_COUNT",
            "sku": sku,
            "qty": qty,
            "status": "draft",
            "reason": "Copy into journals/club-ignition/ then books.py check. Ops did not post.",
            "draft": draft,
        }, "CI", "1300", "5100"))
    return out
