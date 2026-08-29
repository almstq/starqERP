#!/usr/bin/env python3
"""
Club Ignition Ops — workflow event log for Ignition Ink.

This is NOT the ledger. Journals under journals/club-ignition/ remain the
books. This module appends ops/events.jsonl and updates ops/state.json.
Nothing here opens a .journal file.

Brand: Club Ignition Ops by the foundation engine
Paper line: Ignition Ink, a registered business name of Club Ignition
Private Limited (C30222026). Ali acts as Director of Club Ignition.
"""

from __future__ import annotations

import html
import json
import os
import time
from datetime import datetime
from decimal import Decimal, InvalidOperation

import auth as A

HERE = os.path.dirname(os.path.abspath(__file__))
OPS_DIR = os.path.join(HERE, "ops")
EVENTS_FILE = os.path.join(OPS_DIR, "events.jsonl")
STATE_FILE = os.path.join(OPS_DIR, "state.json")

# SOP map — Scout traces a job by filtering events.jsonl on job_no.
EVENT_TYPES = {
    "CALL": {"sop": "C-01 / S-07", "label": "Call", "cycle": "call"},
    "BOOKING": {"sop": "C-01", "label": "Booking", "cycle": "booking/intake"},
    "INTAKE": {"sop": "C-01 / S-01 A", "label": "Intake", "cycle": "booking/intake"},
    "ESTIMATE": {"sop": "C-02", "label": "Estimate", "cycle": "inspection/estimate"},
    "AUTHORISATION": {"sop": "C-02 / S-03", "label": "Authorisation", "cycle": "customer authorisation"},
    "JOB_CARD": {"sop": "C-03 / S-03", "label": "Job card", "cycle": "job card"},
    "PARTS_PROCUREMENT": {"sop": "C-03 / P-02", "label": "Parts / procurement", "cycle": "parts/procurement"},
    "WORK": {"sop": "C-03", "label": "Work", "cycle": "work execution"},
    "QC": {"sop": "C-04 / S-02", "label": "QC", "cycle": "QC"},
    "HANDOVER": {"sop": "C-04 / S-01 B", "label": "Handover", "cycle": "handover"},
    "INVOICE_PAYMENT": {"sop": "C-05", "label": "Invoice / payment", "cycle": "invoice/payment"},
    "CLOSE": {"sop": "C-05", "label": "Close", "cycle": "revenue/close"},
    "PURCHASE": {"sop": "P-01–P-05 / S-04", "label": "Purchase", "cycle": "purchasing"},
    "STOCK": {"sop": "P-06", "label": "Stock", "cycle": "stock"},
    "RECEIPT": {"sop": "P-04 / S-04 / premises", "label": "Receipt capture", "cycle": "receipts"},
    "BILL": {"sop": "P-04 / AP", "label": "Supplier bill", "cycle": "payables"},
    "INVOICE": {"sop": "C-05 / AR", "label": "Customer invoice", "cycle": "invoice/payment"},
    "EXCEPTION": {"sop": "X-01 / S-08", "label": "Exception", "cycle": "exception"},
    "CRM_LEAD": {"sop": "C-01 / CRM", "label": "CRM — lead / enquiry", "cycle": "crm"},
    "CRM_FOLLOWUP": {"sop": "C-01 / CRM", "label": "CRM — follow-up", "cycle": "crm"},
    "CRM_COMPLAINT": {"sop": "S-08 / CRM", "label": "CRM — complaint / comeback", "cycle": "crm"},
    "FIN_PAYABLE": {"sop": "P-02 / finance", "label": "Finance — payable", "cycle": "finance"},
    "FIN_RECEIVABLE": {"sop": "C-05 / finance", "label": "Finance — receivable", "cycle": "finance"},
    "FIN_BANK": {"sop": "G-01 / finance", "label": "Finance — bank / petty", "cycle": "finance"},
    "ACCT_MATCH": {"sop": "P-04 / accounts", "label": "Accounts — match / books note", "cycle": "accounts"},
    "MGMT_APPROVAL": {"sop": "S-06 / management", "label": "Management — approval", "cycle": "management"},
    "MGMT_HR": {"sop": "P-04 people / management", "label": "Management — people / HR", "cycle": "management"},
    "AUTH": {"sop": "AUTH_DESIGN", "label": "Auth / users", "cycle": "management"},
}

CYCLE_TYPES = [
    "CALL", "BOOKING", "INTAKE", "ESTIMATE", "AUTHORISATION", "JOB_CARD",
    "PARTS_PROCUREMENT", "WORK", "QC", "HANDOVER", "INVOICE_PAYMENT", "CLOSE",
]

STATUS_AFTER = {
    "CALL": "enquiry",
    "BOOKING": "enquiry",
    "INTAKE": "received",
    "ESTIMATE": "received",
    "AUTHORISATION": "waiting paint",
    "JOB_CARD": None,
    "PARTS_PROCUREMENT": "waiting paint",
    "WORK": "in workshop",
    "QC": "ready",
    "HANDOVER": "collected",
    "CLOSE": "closed",
}

PAPER_LINE = (
    "Ignition Ink, a registered business name of Club Ignition Private Limited (C30222026)"
)


import ops_guard as _guard

# Re-exported so callers can distinguish a replayed command from a rejected one without
# importing the guard themselves.
IdempotencyConflict = _guard.IdempotencyConflict
LockTimeout = _guard.LockTimeout


def _now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _ensure_dir():
    os.makedirs(OPS_DIR, exist_ok=True)


def empty_state():
    return {
        "job_seq": 0,
        "man_seq": 0,
        "x_seq": 0,
        "event_seq": 0,
        "jobs": {},
        "suppliers": [],
    }


def load_state() -> dict:
    _ensure_dir()
    if not os.path.isfile(STATE_FILE):
        st = empty_state()
        save_state(st)
        return st
    with open(STATE_FILE, encoding="utf-8") as f:
        st = json.load(f)
    st.setdefault("jobs", {})
    st.setdefault("suppliers", [])
    for k in ("job_seq", "man_seq", "x_seq", "event_seq"):
        st.setdefault(k, 0)
    return st


def save_state(st: dict) -> None:
    """Atomic-ish write. Windows WinError 32: retry replace, then overwrite in place."""
    _ensure_dir()
    tmp = STATE_FILE + ".tmp"
    payload = json.dumps(st, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    last = None
    for i in range(10):
        try:
            os.replace(tmp, STATE_FILE)
            return
        except PermissionError as exc:
            last = exc
            time.sleep(0.05 * (i + 1))
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            f.write(payload)
        try:
            os.remove(tmp)
        except OSError:
            pass
    except PermissionError:
        if last:
            raise last
        raise


def load_events() -> list[dict]:
    _ensure_dir()
    if not os.path.isfile(EVENTS_FILE):
        return []
    out = []
    with open(EVENTS_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def _append_line(obj: dict) -> None:
    _ensure_dir()
    with open(EVENTS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def next_job_no(st: dict) -> str:
    st["job_seq"] = int(st.get("job_seq") or 0) + 1
    return f"JOB-2026-{st['job_seq']:04d}"


def next_man(st: dict) -> str:
    st["man_seq"] = int(st.get("man_seq") or 0) + 1
    return f"MAN-2026-{st['man_seq']:04d}"


def next_x(st: dict) -> str:
    st["x_seq"] = int(st.get("x_seq") or 0) + 1
    return f"X-2026-{st['x_seq']:04d}"


def money_mvr(s: str) -> str | None:
    if not s or not str(s).strip():
        return None
    try:
        d = Decimal(str(s).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None
    return f"{d:.2f}"


AUTH_EVENT_TYPES = (
    "auth.login", "auth.logout", "auth.denied", "auth.role_switch",
)


def record_auth_event(
    etype: str,
    summary: str,
    user=None,
    email: str | None = None,
    fields: dict | None = None,
) -> dict | None:
    """Append an auth audit line, serialised where possible. FAILS OPEN by design.

    Same read-modify-write race as record_event, but the trade is different and deliberate.

    This function already swallowed OSError on save so that a locked state.json could not make
    sign-in return 500. Wrapping it in a lock that can TIME OUT would reintroduce exactly that
    failure by another route: a wedged lock would stop anyone logging in, including whoever
    needs to log in to fix it.

    So the lock is taken when it can be, and skipped when it cannot. An auth line with a
    possibly-duplicated sequence number is a recoverable blemish in the audit trail; being
    unable to authenticate is an outage. The lock is a correctness improvement here, not a
    correctness requirement — unlike record_event, where it is load-bearing.
    """
    if etype not in AUTH_EVENT_TYPES:
        return None
    try:
        with _guard.state_lock(timeout=2.0):
            return _record_auth_event_locked(etype, summary, user, email, fields)
    except _guard.LockTimeout:
        # Fail open. See the docstring: an outage here locks everyone out.
        return _record_auth_event_locked(etype, summary, user, email, fields)


def _record_auth_event_locked(
    etype: str,
    summary: str,
    user=None,
    email: str | None = None,
    fields: dict | None = None,
) -> dict | None:
    st = load_state()
    st["event_seq"] = int(st.get("event_seq") or 0) + 1
    actor_email = ""
    actor_person = ""
    actor_role = ""
    actor = "unauthenticated"
    if user is not None:
        actor_email = user.email
        actor_person = user.person_id
        actor_role = user.acting_as
        actor = user.name
    elif email:
        actor_email = email.strip().lower()
        actor = actor_email
    event = {
        "id": f"E-{st['event_seq']:04d}",
        "ts": _now(),
        "type": etype,
        "sop": "AUTH",
        "job_no": None,
        "actor": actor,
        "actor_email": actor_email,
        "actor_person": actor_person,
        "actor_role": actor_role,
        "summary": (summary or "")[:2000],
        "fields": fields or {},
    }
    _append_line(event)
    try:
        save_state(st)
    except OSError:
        # Sign-in must not 500 if Windows has state.json open in another process.
        pass
    return event


def _record_event_unlocked(form: dict) -> tuple[dict | None, str | None]:
    """Append one workflow event. Returns (event, error). Never touches journals.

    MUST be called inside ops_guard.state_lock(). It runs load_state -> mutate -> save_state,
    which is a read-modify-write across processes; unserialised, two concurrent callers both
    read the same event_seq and both issue the same event id (audit finding #9).
    """
    etype = A.normalize_event_type(form.get("type") or "")
    if etype not in EVENT_TYPES:
        return None, "Unknown event type."
    user = A.current_user()
    err = A.authorize_event(user, etype, form)
    if err:
        return None, err
    sod = A.check_sod(user, etype, form, load_events())
    if sod:
        return None, sod
    if etype == "BILL":
        import journal_outbox as JO
        packed, perr = JO.prepare_supplier_bill(
            form, occupancy=(form.get("entity") or "").strip().upper(),
            seat=user.acting_as,
        )
        if perr or not packed:
            return None, perr or "Supplier bill refused."
        form = dict(form)
        form.update(packed)
    if etype == "INVOICE":
        import journal_outbox as JO
        packed, perr = JO.prepare_customer_invoice(
            form, occupancy=(form.get("entity") or "").strip().upper(),
            seat=user.acting_as,
        )
        if perr or not packed:
            return None, perr or "Customer invoice refused."
        form = dict(form)
        form.update(packed)
    actor = user.name
    summary = (form.get("summary") or "").strip()
    if etype == "RECEIPT" and not summary:
        kind = (form.get("kind") or "").strip()
        vendor = (form.get("vendor") or "").strip()
        amount = (form.get("amount") or "").strip()
        bill_date = (form.get("bill_date") or "").strip()
        summary = " ".join(x for x in ["Receipt", kind, vendor, amount, bill_date] if x)
    if etype == "BILL" and not summary:
        vendor = (form.get("vendor") or form.get("supplier") or "").strip()
        amount = (form.get("amount") or "").strip()
        item = (form.get("item") or "").strip()
        summary = " ".join(x for x in ["Supplier bill", vendor, item, amount] if x)
    if etype == "INVOICE" and not summary:
        customer = (form.get("customer") or "").strip()
        amount = (form.get("amount") or "").strip()
        item = (form.get("item") or "").strip()
        summary = " ".join(x for x in ["Customer invoice", customer, item, amount] if x)
    if not summary:
        return None, "Summary is required — blanks are allowed on amounts, not on what happened."
    if len(summary) > 2000:
        return None, "Summary too long."

    st = load_state()
    job_no = (form.get("job_no") or "").strip().upper()
    if job_no in ("", "NONE", "-") or etype in ("RECEIPT", "BILL", "INVOICE"):
        job_no = None
    if job_no == "NEW" or (etype in ("INTAKE", "JOB_CARD") and not job_no):
        job_no = next_job_no(st)
        st["jobs"][job_no] = {
            "job_no": job_no,
            "status": "received" if etype == "INTAKE" else "enquiry",
            "opened_at": _now(),
            "customer": (form.get("customer") or "").strip(),
            "phone": (form.get("phone") or "").strip(),
            "vehicle": (form.get("vehicle") or "").strip(),
            "colour": (form.get("colour") or "").strip(),
            "quoted": money_mvr(form.get("amount") or "") or "",
            "deposit": "",
            "receipts": [],
        }

    fields = {}
    for key in (
        "customer", "phone", "vehicle", "colour", "channel", "tier",
        "firm", "spoken", "naleez", "nashid_people", "amount", "tender",
        "receipt_no", "supplier", "item", "job_or_overhead", "match",
        "tin", "qc_result", "failed", "collected_by", "stock_type",
        "qty", "x_type", "who_paid", "scm_step",
        "item_id", "kind", "vendor", "bill_date", "period", "artefact_path", "notes",
        "entity", "sku", "station", "rate", "income_account",
        "po_event_id", "po_number", "invoice_event_id", "inv_number",
        "contact_id", "tax_rate",
    ):
        v = (form.get(key) or "").strip()
        if v:
            fields[key] = v

    if etype in ("AUTHORISATION", "INVOICE_PAYMENT") and not fields.get("receipt_no"):
        fields["receipt_no"] = next_man(st)
    if etype == "EXCEPTION" and not fields.get("x_no"):
        fields["x_no"] = next_x(st)

    if job_no and job_no not in st["jobs"] and job_no != "OVERHEAD":
        st["jobs"][job_no] = {
            "job_no": job_no,
            "status": "enquiry",
            "opened_at": _now(),
            "customer": fields.get("customer", ""),
            "phone": fields.get("phone", ""),
            "vehicle": fields.get("vehicle", ""),
            "colour": fields.get("colour", ""),
            "quoted": "",
            "deposit": "",
            "receipts": [],
        }

    job = st["jobs"].get(job_no) if job_no else None
    if job:
        for k in ("customer", "phone", "vehicle", "colour"):
            if fields.get(k):
                job[k] = fields[k]
        new_status = STATUS_AFTER.get(etype)
        if etype == "QC" and fields.get("qc_result", "").lower() == "fail":
            new_status = "in workshop"
        if new_status:
            job["status"] = new_status
        if etype == "ESTIMATE" and fields.get("amount"):
            job["quoted"] = money_mvr(fields["amount"]) or fields["amount"]
        if etype == "AUTHORISATION":
            job["deposit"] = money_mvr(fields.get("amount") or "") or job.get("deposit", "")
            rec = fields.get("receipt_no")
            if rec and rec not in job["receipts"]:
                job["receipts"].append(rec)
        if etype == "INVOICE_PAYMENT":
            rec = fields.get("receipt_no")
            if rec and rec not in job["receipts"]:
                job["receipts"].append(rec)
        if etype == "CLOSE":
            job["closed_at"] = _now()

    if etype == "PURCHASE" and fields.get("supplier"):
        name = fields["supplier"]
        if name not in st["suppliers"]:
            st["suppliers"].append(name)

    st["event_seq"] = int(st.get("event_seq") or 0) + 1
    event = {
        "id": f"E-{st['event_seq']:04d}",
        "ts": _now(),
        "type": etype,
        "sop": EVENT_TYPES[etype]["sop"],
        "job_no": job_no,
        "actor": actor,
        "actor_email": user.email,
        "actor_person": user.person_id,
        "actor_role": user.acting_as,
        "summary": summary,
        "fields": fields,
    }
    _append_line(event)
    try:
        save_state(st)
    except OSError:
        pass
    if etype == "PURCHASE" and (fields.get("scm_step") or "").strip().lower() == "receive":
        try:
            import journal_outbox as JO
            import masters as M
            prop = JO.propose_one(event)
            if prop and prop.get("qty_action") == "bump" and prop.get("qty_sku"):
                M.apply_grn_qty(
                    sku=str(prop.get("qty_sku") or ""),
                    qty_raw=prop.get("qty_add") or fields.get("qty") or "",
                    occupancy=JO.occupancy_of(event),
                    person_id=user.person_id,
                    seat=user.acting_as,
                )
        except (OSError, ValueError, TypeError):
            pass
    return event, None


def record_event(
    form: dict,
    idempotency_key: str | None = None,
) -> tuple[dict | None, str | None]:
    """Append one workflow event, serialised across processes and safe to retry.

    Closes audit findings #4 and #9 for the Python path.

    THE LOCK is not optional. `_record_event_unlocked` runs load_state -> mutate -> save_state,
    so two concurrent callers without it both read the same `event_seq`, both write the next
    one, and two different events are issued the same id. Nothing errors; the record is simply
    wrong afterwards, which is the worst shape a defect can take in evidence that later becomes
    the ERP's test fixtures.

    IDEMPOTENCY is opt-in because the caller has to supply a key that is stable across retries.
    Browser forms do not send one yet — that needs a single-use token minted with the form in
    serve.py, and until then a refresh can still double-submit. Callers that DO pass a key
    (the Flutter client, any agent, any retry wrapper) get exact-once semantics:

      same key + same request  -> the stored event is returned; nothing is re-executed
      same key + different one -> IdempotencyConflict, because replaying the old result would
                                  return the wrong event AND silently discard the new one

    The lookup, the effect and the remember all happen inside ONE lock. Storing the outcome
    after releasing it would reopen the window the lock exists to close.
    """
    digest = _guard.request_hash(form) if idempotency_key else ""

    with _guard.state_lock():
        if idempotency_key:
            replayed = _guard.lookup(idempotency_key, digest)
            if replayed is not None:
                return replayed, None

        event, err = _record_event_unlocked(form)

        # Only successful commands are remembered. Recording a failure would make a retry of a
        # transient error permanently return that error, which is the opposite of what a retry
        # is for.
        if idempotency_key and event is not None and err is None:
            _guard.remember(idempotency_key, digest, event)

        return event, err



def jobs_sorted(st=None) -> list[dict]:
    st = st or load_state()
    jobs = list(st.get("jobs", {}).values())
    jobs.sort(key=lambda j: j.get("job_no") or "", reverse=True)
    return jobs


def events_for(job_no: str | None = None, etype: str | None = None) -> list[dict]:
    rows = load_events()
    if job_no:
        rows = [e for e in rows if (e.get("job_no") or "") == job_no]
    if etype:
        rows = [e for e in rows if e.get("type") == etype]
    rows.reverse()
    return rows


def money_events() -> list[dict]:
    return [e for e in load_events() if e.get("type") in ("AUTHORISATION", "INVOICE_PAYMENT", "PURCHASE")
            and (e.get("type") != "PURCHASE" or (e.get("fields") or {}).get("who_paid"))]


def purchase_events() -> list[dict]:
    return [e for e in load_events() if e.get("type") in ("PURCHASE", "PARTS_PROCUREMENT")]


def exception_events() -> list[dict]:
    return [e for e in load_events() if e.get("type") == "EXCEPTION"]


def stats() -> dict:
    st = load_state()
    jobs = jobs_sorted(st)
    ev = load_events()
    open_jobs = [j for j in jobs if j.get("status") not in ("closed", "collected")]
    deposits = Decimal("0")
    for j in jobs:
        if j.get("status") not in ("closed", "collected") and j.get("deposit"):
            try:
                deposits += Decimal(j["deposit"])
            except InvalidOperation:
                pass
    return {
        "jobs": len(jobs),
        "open": len(open_jobs),
        "events": len(ev),
        "exceptions": len(exception_events()),
        "purchases": len(purchase_events()),
        "deposits_held": f"{deposits:.2f}",
    }


QUESTS_FILE = os.path.join(OPS_DIR, "catalog", "quests.json")

_EMPTY_SHOP = "No car in the bay. First play: take the call."
_ILLEGAL = "Bay locked. Not your seat."
_QC_SWITCH = "Switch seat to QC"


def load_quests() -> dict:
    if not os.path.isfile(QUESTS_FILE):
        return {}
    try:
        with open(QUESTS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _quest_steps(quests: dict, campaign: str) -> list[dict]:
    camp = (quests.get("campaigns") or {}).get(campaign) or {}
    steps = camp.get("steps") if isinstance(camp, dict) else None
    return steps if isinstance(steps, list) else []


def _stations(quests: dict) -> dict:
    out = {}
    for s in quests.get("stations") or []:
        if isinstance(s, dict) and s.get("id"):
            out[s["id"]] = s
    return out


def _open_bay_job(st: dict | None = None) -> dict | None:
    """One vehicle at a time: oldest open job. Closed = bay empty."""
    jobs = [
        j for j in jobs_sorted(st)
        if (j.get("status") or "") not in ("closed",)
    ]
    jobs.sort(key=lambda j: j.get("job_no") or "")
    return jobs[0] if jobs else None


def _first_missing_step(steps: list[dict], seen_types: set, seen_scm: set) -> dict | None:
    for step in steps:
        et = step.get("event_type")
        scm = step.get("scm_step")
        if scm:
            if scm not in seen_scm:
                return step
        elif et not in seen_types:
            return step
    return None


def _flavour_play(step: dict, user, quests: dict) -> dict:
    """Coach vs MD: same next play. Locked doors are not jokes."""
    illegal = quests.get("illegal") or _ILLEGAL
    qc_switch = quests.get("qc_switch") or _QC_SWITCH
    acting = (user.acting_as if user else "") or ""
    person = (user.person_id if user else "") or ""
    coach = person == "ali"
    blocked = set(step.get("blocked_if_acting") or [])
    nashid_seats = set(step.get("nashid_seats") or [])
    wait = bool(step.get("wait") or step.get("locked_door"))
    title = step.get("title") or ""
    play = step.get("play") or title
    locked = False

    if wait:
        if coach and step.get("ali_play"):
            play = step["ali_play"]
            locked = False
        else:
            play = step.get("play") or illegal
            locked = True
    elif acting in blocked:
        if step.get("event_type") == "QC" and acting == "technician":
            play = step.get("switch_play") or qc_switch
            locked = False
        else:
            play = illegal
            locked = True
    elif nashid_seats and acting and acting not in nashid_seats and not coach:
        if step.get("event_type") == "QC":
            play = step.get("switch_play") or qc_switch
            locked = False
        else:
            play = illegal
            locked = True

    return {
        "title": title,
        "play": play,
        "locked": locked,
        "wait": wait,
        "wait_for": step.get("wait_for"),
        "coach": coach,
    }


def campaign_snapshot(user=None) -> dict:
    """Next legal play for the vehicle in the bay. Never mentions Starq. Never posts GL."""
    quests = load_quests()
    illegal = quests.get("illegal") or _ILLEGAL
    empty_copy = quests.get("empty_shop") or _EMPTY_SHOP
    stations = _stations(quests)
    job_steps = _quest_steps(quests, "job")
    buy_steps = _quest_steps(quests, "purchase")
    st = load_state()
    events = load_events()
    job = _open_bay_job(st)

    def pack(step: dict | None, *, empty: bool, job_no: str | None, purchase: dict | None = None) -> dict:
        if step is None:
            station = stations.get("ticket") or {"id": "ticket", "name": "Ticket"}
            return {
                "empty": empty,
                "station_id": station.get("id", "ticket"),
                "station": station.get("name", "Ticket"),
                "job_no": job_no,
                "next_id": None,
                "event_type": None,
                "scm_step": None,
                "title": "Bay empty",
                "play": empty_copy if empty else "Bay empty. Ali books later.",
                "stamp": "EMPTY",
                "locked": False,
                "wait": False,
                "wait_for": None,
                "illegal": illegal,
                "coach": (user.person_id if user else "") == "ali",
                "purchase": purchase,
            }
        flav = _flavour_play(step, user, quests)
        sid = step.get("station") or "counter"
        station = stations.get(sid) or {"id": sid, "name": sid}
        return {
            "empty": empty,
            "station_id": station.get("id", sid),
            "station": station.get("name", sid),
            "job_no": job_no,
            "next_id": step.get("id"),
            "event_type": step.get("event_type"),
            "scm_step": step.get("scm_step"),
            "title": flav["title"],
            "play": flav["play"] if not empty else empty_copy,
            "stamp": step.get("stamp") or step.get("event_type") or "",
            "locked": flav["locked"],
            "wait": flav["wait"],
            "wait_for": flav["wait_for"],
            "illegal": illegal,
            "coach": flav["coach"],
            "accountability_id": step.get("accountability_id"),
            "purchase": purchase,
        }

    if not job:
        call = next((s for s in job_steps if s.get("event_type") == "CALL"), None)
        snap = pack(call, empty=True, job_no=None)
        snap["play"] = empty_copy
        snap["locked"] = False
        return snap

    job_no = job.get("job_no")
    job_events = [e for e in events if (e.get("job_no") or "") == job_no]
    seen_types = {e.get("type") for e in job_events}
    seen_scm = set()
    for e in job_events:
        if e.get("type") == "PURCHASE":
            step = (e.get("fields") or {}).get("scm_step")
            if step:
                seen_scm.add(step)
        elif e.get("type") == "PARTS_PROCUREMENT":
            seen_scm.add("need")

    nxt = _first_missing_step(job_steps, seen_types, set())
    buy_nxt = None
    if seen_scm or (nxt and nxt.get("event_type") == "PARTS_PROCUREMENT"):
        buy_nxt = _first_missing_step(buy_steps, set(), seen_scm)

    purchase = None
    if buy_nxt:
        bflav = _flavour_play(buy_nxt, user, quests)
        purchase = {
            "next_id": buy_nxt.get("id"),
            "event_type": buy_nxt.get("event_type"),
            "scm_step": buy_nxt.get("scm_step"),
            "title": bflav["title"],
            "play": bflav["play"],
            "stamp": buy_nxt.get("stamp") or "",
            "locked": bflav["locked"],
            "wait": bflav["wait"],
            "wait_for": bflav["wait_for"],
            "accountability_id": buy_nxt.get("accountability_id"),
        }

    snap = pack(nxt, empty=False, job_no=job_no, purchase=purchase)
    return snap


# Station copy for the log picker. Quest stations win when present.
_TYPE_STATION_FALLBACK = {
    "CALL": "Counter", "BOOKING": "Counter", "INTAKE": "Counter", "JOB_CARD": "Counter",
    "ESTIMATE": "Spec", "AUTHORISATION": "Spec",
    "PARTS_PROCUREMENT": "Cage", "PURCHASE": "Cage", "STOCK": "Cage", "RECEIPT": "Cage",
    "WORK": "Booth",
    "QC": "Lamp",
    "HANDOVER": "Keys",
    "INVOICE_PAYMENT": "Ticket", "INVOICE": "Ticket", "CLOSE": "Ticket",
    "EXCEPTION": "Floor",
}

# Visible play fields per TYPE. Engine still accepts every record_event key.
TYPE_FIELDS = {
    "CALL": ("customer", "phone", "vehicle", "colour", "channel"),
    "BOOKING": ("job_no", "customer", "phone", "vehicle", "colour", "channel"),
    "INTAKE": ("job_no", "customer", "phone", "vehicle", "colour", "channel"),
    "ESTIMATE": ("job_no", "vehicle", "colour", "tier", "firm", "amount"),
    "AUTHORISATION": ("job_no", "amount", "tender", "spoken", "naleez", "nashid_people"),
    "JOB_CARD": ("job_no", "customer", "vehicle", "colour"),
    "PARTS_PROCUREMENT": ("job_no", "item", "qty", "colour", "supplier"),
    "WORK": ("job_no", "colour", "qty"),
    "QC": ("job_no", "qc_result"),
    "HANDOVER": ("job_no", "collected_by"),
    "INVOICE_PAYMENT": ("job_no", "amount", "tender", "who_paid", "sku"),
    "CLOSE": ("job_no", "amount", "sku"),
    "PURCHASE": (
        "scm_step", "supplier", "item", "job_or_overhead", "amount",
        "match", "tin", "who_paid", "qty", "sku", "po_event_id", "po_number",
    ),
    "STOCK": ("job_no", "stock_type", "qty", "colour"),
    "RECEIPT": ("supplier", "item", "amount", "kind", "tender", "invoice_event_id", "inv_number"),
    "BILL": ("vendor", "supplier", "item", "amount", "contact_id", "po_event_id", "po_number"),
    "INVOICE": ("customer", "item", "amount", "contact_id", "income_account", "sku"),
    "EXCEPTION": ("job_no", "x_type"),
    "CRM_LEAD": ("customer", "phone", "vehicle", "channel"),
    "CRM_FOLLOWUP": ("job_no", "customer", "phone", "channel"),
    "CRM_COMPLAINT": ("job_no", "customer", "phone", "x_type"),
    "FIN_PAYABLE": ("supplier", "item", "amount", "who_paid"),
    "FIN_RECEIVABLE": ("job_no", "amount", "tender"),
    "FIN_BANK": ("amount", "tender", "who_paid"),
    "ACCT_MATCH": ("supplier", "item", "match", "tin", "amount"),
    "MGMT_APPROVAL": ("job_no",),
    "MGMT_HR": ("job_no",),
    "AUTH": ("job_no",),
}

_ALWAYS_FIELDS = ("type", "summary")

# ---------------------------------------------------------------- html ----

OPS_CSS = """
:root{--ink:#08090d;--deep:#12141f;--panel:#1a1d2a;--line:rgba(255,255,255,.10);
--text:#F3F5FA;--muted:#A8B0C8;--accent:#E01B24;--accent2:#FF6A70;--ok:#4ade80;--warn:#fbbf24;
--radius:14px;--ph:#C5CBDC}
*{box-sizing:border-box}
body{margin:0;font-family:"Space Grotesk",Inter,system-ui,sans-serif;background:#08090d;color:var(--text);
line-height:1.5;font-size:16px;min-height:100vh}
a{color:inherit;text-decoration:none}
.wrap{width:min(calc(100% - 32px),720px);margin:auto}
header{border-bottom:1px solid var(--line);background:#0a0a0b;position:sticky;top:0;z-index:20}
.hd{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:58px;flex-wrap:wrap;
padding:8px 0}
.logo{font-weight:700;font-size:16px;display:flex;align-items:center;gap:8px}
.logo img{width:26px;height:26px;object-fit:contain}
.logo .by{font-weight:500;color:var(--muted);font-size:12px;letter-spacing:.04em}
.ver{font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
padding:3px 8px;border-radius:999px;border:1px solid rgba(224,27,36,.35);color:#FF8A90}
nav{display:flex;gap:4px;flex-wrap:wrap;padding:0 0 12px}
nav a{padding:10px 14px;min-height:44px;display:inline-flex;align-items:center;border-radius:999px;
font-size:13px;color:var(--muted)}
nav a:hover{color:var(--text);background:rgba(255,255,255,.05)}
nav a.on{background:var(--accent);color:#fff}
h1{font-size:28px;margin:28px 0 8px;letter-spacing:-.03em;line-height:1.15}
.sub{color:var(--muted);font-size:14px;margin:0 0 18px}
.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:8px 0 28px}
@media(min-width:560px){.cards{grid-template-columns:repeat(4,1fr)}}
.card{border:1px solid var(--line);border-radius:var(--radius);padding:16px;background:rgba(255,255,255,.03)}
.card .k{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.card .v{font-size:26px;font-weight:700;margin-top:6px;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.panel{border:1px solid var(--line);border-radius:var(--radius);overflow-x:auto;margin-bottom:18px}
.panel h2{margin:0;padding:12px 16px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;
background:rgba(255,255,255,.04);border-bottom:1px solid var(--line)}
table{width:100%;border-collapse:collapse}
th,td{padding:9px 16px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);font-size:13.5px;vertical-align:top}
th{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#c9c9d4}
.pill{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.08);color:var(--muted)}
.pill.ok{background:rgba(74,222,128,.14);color:var(--ok)}
.pill.warn{background:rgba(251,191,36,.14);color:var(--warn)}
.note{margin:0 0 16px;border-left:3px solid var(--warn);background:rgba(251,191,36,.06);
padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;color:#cfcfd8}
.oknote{border-left-color:var(--ok);background:rgba(74,222,128,.06)}
.err{border-left-color:var(--accent);background:rgba(224,27,36,.09)}
form.ev{padding:18px;display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:560px){form.ev{grid-template-columns:repeat(2,1fr)}}
form.ev label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;
display:none;flex-direction:column;gap:6px}
form.ev label.on,form.ev.show-all label.f{display:flex}
form.ev input,form.ev select,form.ev textarea{background:#141824;color:var(--text);border:1px solid var(--line);
border-radius:10px;padding:12px 14px;font:inherit;font-size:16px;min-height:44px;width:100%}
form.ev input::placeholder,form.ev textarea::placeholder{color:var(--ph);opacity:1}
form.ev textarea{grid-column:1/-1;min-height:96px}
form.ev .span{grid-column:1/-1}
form.ev .sop{font-size:11px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--muted);
margin-left:6px}
form.ev button.stamp{grid-column:1/-1;background:var(--accent);color:#fff;border:0;border-radius:14px;
padding:18px 20px;min-height:56px;font-size:20px;font-weight:700;cursor:pointer;width:100%}
form.ev button.stamp:hover{filter:brightness(1.06)}
.code{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--muted)}
footer{color:var(--muted);font-size:12px;padding:24px 0 40px;border-top:1px solid var(--line);margin-top:16px}
.back{font-size:13px;color:var(--muted)}
.who{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px}
.who .nm{font-weight:600}
.who .pill{background:rgba(224,27,36,.18);color:#FF8A90}
.seat-form{display:flex;align-items:center;gap:6px;margin:0}
.seat-form label{margin:0;text-transform:none;letter-spacing:0;font-size:12px;color:var(--muted);
flex-direction:row;align-items:center;gap:6px}
.seat-form select{background:#141824;color:var(--text);border:1px solid var(--line);border-radius:8px;
padding:8px 10px;font:inherit;font-size:12.5px;min-height:44px}
.campaign{border:1px solid var(--line);border-radius:18px;padding:22px 22px 20px;margin:0 0 22px;
background:rgba(224,27,36,.07)}
.campaign.hero{padding:28px 24px 24px}
.campaign .st{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.campaign .station{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
color:#FF8A90;margin:0 0 8px}
.campaign .play{font-size:32px;font-weight:700;margin:0 0 12px;letter-spacing:-.04em;line-height:1.12}
.campaign.hero .play{font-size:clamp(28px,6vw,42px)}
.campaign .meta{font-size:14px;color:var(--muted);margin:0}
.campaign .stamp{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
padding:4px 10px;border-radius:999px;background:rgba(224,27,36,.22);color:#FF8A90;margin-right:8px}
.campaign a.go{display:inline-block;margin-top:10px;font-size:14px;font-weight:600;color:#FF8A90;min-height:44px;
padding-top:10px}
.cta{display:flex;align-items:center;justify-content:center;width:100%;min-height:64px;margin-top:20px;
padding:18px 22px;background:var(--accent);color:#fff;font-size:22px;font-weight:700;letter-spacing:-.02em;
border-radius:16px;text-align:center;line-height:1.2}
.cta.locked{background:#2a2d3a;color:var(--muted);cursor:not-allowed}
.floor-links{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 28px}
.floor-links a{min-height:44px;display:inline-flex;align-items:center;font-weight:600;color:#FF8A90}
.quiet{margin:32px 0 8px;font-size:12px;color:var(--muted)}
.quiet a{color:var(--muted);text-decoration:underline;text-underline-offset:3px}
.workshop{margin:0 0 24px;border:1px solid var(--line);border-radius:12px;padding:4px 14px 8px;
background:rgba(255,255,255,.02)}
.workshop summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--muted);font-size:13px}
.workshop p{color:var(--muted);font-size:13px;margin:0 0 8px}
/* # AG-OWNED: chrome/home/hamburger — collapse wrapping ops tabs into the
   same RIGHT overlay drawer as books. SSOT: HOME_NAV.md. Touch ≥44px. CI identity. */
"""


def _esc(s) -> str:
    return html.escape("" if s is None else str(s))


def _station_name_for_type(etype: str) -> str:
    quests = load_quests()
    for s in quests.get("stations") or []:
        if not isinstance(s, dict):
            continue
        events = s.get("events") or []
        if etype in events:
            if etype == "WORK" and s.get("id") == "wrap":
                continue
            return s.get("name") or s.get("id") or etype
    return _TYPE_STATION_FALLBACK.get(etype) or EVENT_TYPES.get(etype, {}).get("cycle") or "Station"


def _next_play_href(c: dict) -> str:
    href = "/ops/log?type=NEXT"
    job = c.get("job_no")
    if job:
        href += f"&job_no={_esc(job)}"
    scm = c.get("scm_step")
    p = c.get("purchase") or {}
    if not scm and p.get("scm_step") and (p.get("event_type") == c.get("event_type") or c.get("event_type") == "PURCHASE"):
        scm = p.get("scm_step")
    if scm:
        href += f"&scm_step={_esc(scm)}"
    return href


def _resolve_log_type(raw: str | None, user=None) -> str:
    e = A.normalize_event_type(raw or "")
    if e in ("", "NEXT"):
        c = campaign_snapshot(user)
        e = A.normalize_event_type(c.get("event_type") or "CALL")
        if e not in EVENT_TYPES:
            e = "CALL"
        return e
    if e not in EVENT_TYPES:
        return "CALL"
    return e


def _receipt_ask_late() -> str:
    try:
        from datetime import date as date_cls
        import catalog as C
        cat = C.load_catalog("CI")
        events = load_events()
        today = date_cls.today()
        late = ask = 0
        for item in cat.get("items") or []:
            st = C.period_status(item, today, events)
            if not st:
                continue
            if st.get("status") == "LATE":
                late += 1
            elif st.get("status") == "ASK":
                ask += 1
        if late:
            return f"{late} LATE"
        if ask:
            return f"{ask} ASK"
        return "clear"
    except Exception:
        return "—"


def _floor_tiles(user) -> str:
    s = stats()
    c = campaign_snapshot(user)
    p = c.get("purchase") or {}
    wait = "—"
    if (p.get("wait_for") or c.get("wait_for") or "") == "Ali":
        wait = p.get("title") or c.get("title") or "Office"
    elif p.get("wait"):
        wait = p.get("wait_for") or "hold"
    tiles = (
        ("In the bay", s["open"]),
        ("Waiting on Ali", wait),
        ("Receipts", _receipt_ask_late()),
        ("Exceptions", s["exceptions"]),
    )
    return "".join(
        f'<div class="card"><div class="k">{_esc(k)}</div><div class="v">{_esc(v)}</div></div>'
        for k, v in tiles
    )


def _field_on(name: str, selected: str, show_all: bool) -> str:
    if show_all or name in _ALWAYS_FIELDS:
        return "on"
    needed = TYPE_FIELDS.get(selected) or ("job_no",)
    return "on" if name in needed else ""


def shell(title: str, body: str, active: str, flash: str | None = None) -> str:
    # AG-OWNED: chrome/home/hamburger — replace wrapping <nav> with the
    # shared top bar + drawer. Keep who/seat form (move it into the drawer).
    tabs = [
        ("", "Dashboard"),
        ("jobs", "Jobs"),
        ("money", "Money"),
        ("purchases", "Purchases"),
        ("exceptions", "Exceptions"),
        ("events", "Event log"),
        ("log", "Log event"),
    ]
    nav = "".join(
        f'<a class="{"on" if active == k else ""}" href="/ops{"/" + k if k else ""}">{_esc(v)}</a>'
        for k, v in tabs
    )
    note = ""
    if flash:
        cls = "oknote" if flash.startswith("Logged") else "err"
        note = f'<div class="note {cls}">{_esc(flash)}</div>'
    who = A.who_strip(A.current_user())
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/png" href="/assets/ci-favicon.png">
<title>{_esc(title)} — Club Ignition Ops</title><style>{OPS_CSS}</style></head>
<body>
<header><div class="wrap">
<div class="hd">
<a class="logo" href="/ops"><img src="/assets/ci-logo.png" alt="">
Club Ignition Ops <span class="by">by the foundation engine</span>
<span class="ver">ops slice</span></a>
{who}
</div>
<nav>{nav}</nav>
</div></header>
<main class="wrap">{note}{body}</main>
<footer><div class="wrap">
{_esc(PAPER_LINE)} · H. Kiev · TIN 1186844 · not GST-registered — no 8% on customer paper.<br>
Ali acts as <b>Director of Club Ignition Private Limited</b> on garage surfaces — never as Starq.
Product footer: the foundation engine. Starq is not the shop identity.<br>
Every event is <b>(person, seat, timestamp)</b>. Same human ordering and paying must switch seat.
Workflow: <code>ops/events.jsonl</code>. <b>Journals are not written from this screen.</b>
Bound to 127.0.0.1. No till close (S-09 NOT IN FORCE). 4520 only — no retail.
</div></footer></body></html>"""


def _job_rows(jobs: list[dict]) -> str:
    if not jobs:
        return '<p class="sub">No jobs in the ops log yet. Log an intake or a call.</p>'
    rows = []
    for j in jobs:
        jn = _esc(j.get("job_no"))
        rows.append(
            f'<tr><td><a href="/ops/job?id={jn}"><span class="code">{jn}</span></a></td>'
            f'<td>{_esc(j.get("customer"))}</td><td>{_esc(j.get("vehicle"))}</td>'
            f'<td>{_esc(j.get("colour"))}</td>'
            f'<td><span class="pill">{_esc(j.get("status"))}</span></td>'
            f'<td class="code">{_esc(j.get("quoted"))}</td>'
            f'<td class="code">{_esc(j.get("deposit"))}</td></tr>'
        )
    return (
        '<div class="panel"><h2>Jobs</h2><table><thead><tr>'
        "<th>Job</th><th>Customer</th><th>Vehicle</th><th>Colour</th>"
        "<th>Status</th><th>Quoted</th><th>Deposit</th></tr></thead><tbody>"
        + "".join(rows) + "</tbody></table></div>"
    )


def _event_table(rows: list[dict], cap: int | None = None) -> str:
    if cap:
        rows = rows[:cap]
    if not rows:
        return '<p class="sub">No events yet.</p>'
    body = []
    for e in rows:
        jn = e.get("job_no") or "—"
        href = f'<a href="/ops/job?id={_esc(jn)}">{_esc(jn)}</a>' if e.get("job_no") else _esc(jn)
        role = e.get("actor_role") or "—"
        body.append(
            f'<tr><td class="code">{_esc(e.get("id"))}</td>'
            f'<td class="code">{_esc((e.get("ts") or "")[:19])}</td>'
            f'<td><span class="pill">{_esc(e.get("type"))}</span></td>'
            f'<td class="code">{_esc(e.get("sop"))}</td>'
            f'<td>{href}</td>'
            f'<td>{_esc(e.get("actor"))}</td>'
            f'<td><span class="pill">{_esc(role)}</span></td>'
            f'<td>{_esc(e.get("summary"))}</td></tr>'
        )
    return (
        '<div class="panel"><h2>Events</h2><table><thead><tr>'
        "<th>Id</th><th>When</th><th>Type</th><th>SOP</th><th>Job</th>"
        "<th>Person</th><th>Seat</th><th>What</th>"
        "</tr></thead><tbody>" + "".join(body) + "</tbody></table></div>"
    )


def _campaign_panel(user=None, *, hero=False) -> str:
    c = campaign_snapshot(user)
    who = "Coach" if c.get("coach") else "Next play"
    bay = c.get("job_no") or "empty"
    stamp = c.get("stamp") or ""
    station = c.get("station") or "Counter"
    play = c.get("play") or ""
    title = c.get("title") or play
    href = _next_play_href(c)
    cage = ""
    p = c.get("purchase")
    if p:
        cage = (
            f'<p class="meta">Cage · <span class="stamp">{_esc(p.get("stamp"))}</span>'
            f'{_esc(p.get("play") or p.get("title"))}</p>'
        )
    if c.get("locked"):
        cta = f'<div class="cta locked">{_esc(c.get("illegal") or "Bay locked")}</div>'
    else:
        cta = f'<a class="cta" href="{href}">{_esc(title)}</a>'
    extra = ""
    if not hero:
        extra = f'<a class="go" href="{href}">Open this station →</a>'
        cta = ""
    cls = "campaign hero" if hero else "campaign"
    return (
        f'<div class="{cls}">'
        f'<p class="st">Ignition Ink · {_esc(who)}</p>'
        f'<p class="station">{_esc(station)}</p>'
        f'<p class="play">{_esc(play)}</p>'
        f'<p class="meta"><span class="stamp">{_esc(stamp)}</span>'
        f'Bay: <span class="code">{_esc(bay)}</span></p>'
        f'{cage}'
        f'{cta}{extra}'
        "</div>"
    )


def page_dashboard(flash=None) -> str:
    user = A.current_user()
    c = campaign_snapshot(user)
    empty = c.get("empty")
    lead = "No car in the bay." if empty else (c.get("station") or "Bay")
    body = (
        f"<h1>{_esc(lead)}</h1>"
        f'<p class="sub">One vehicle. One play. Journals stay on the books.</p>'
        + _campaign_panel(user, hero=True)
        + f'<div class="cards">{_floor_tiles(user)}</div>'
        + '<div class="floor-links">'
        '<a href="/ops/jobs">Jobs</a>'
        '<a href="/ops/purchases">Purchases</a>'
        "</div>"
        '<p class="quiet"><a href="/ops/log?type=all">Workshop sheet — every field</a></p>'
    )
    return shell("Dashboard", body, "", flash)


def page_jobs(flash=None) -> str:
    user = A.current_user()
    body = "<h1>Jobs</h1><p class=\"sub\">One job = one vehicle. Status from the last cycle event.</p>"
    body += _campaign_panel(user)
    body += _job_rows(jobs_sorted())
    return shell("Jobs", body, "jobs", flash)


def page_job(job_no: str, flash=None) -> str:
    st = load_state()
    job = st.get("jobs", {}).get(job_no)
    if not job:
        return shell("Job", f'<div class="note err">No job {_esc(job_no)} in ops state.</div>', "jobs", flash)
    ev = events_for(job_no)
    types_seen = {e.get("type") for e in ev}
    pills = []
    for t in CYCLE_TYPES:
        cls = "ok" if t in types_seen else ""
        pills.append(f'<span class="pill {cls}">{_esc(t)}</span> ')
    body = (
        f'<h1>{_esc(job_no)}</h1>'
        f'<p class="sub">{_esc(job.get("customer"))} · {_esc(job.get("vehicle"))} · '
        f'{_esc(job.get("colour"))} · <span class="pill">{_esc(job.get("status"))}</span></p>'
        f'<p class="sub">Cycle coverage (green = at least one event): {"".join(pills)}</p>'
        + _campaign_panel(A.current_user())
        + _event_table(ev)
        + f'<p class="sub"><a href="/ops/log?job_no={_esc(job_no)}">Log next event on this job →</a></p>'
    )
    return shell(job_no, body, "jobs", flash)


def page_money(flash=None) -> str:
    rows = list(reversed(money_events()))
    body = (
        "<h1>Money (ops)</h1>"
        '<p class="sub">Authorisation deposits, collection payments, and purchase pays. '
        "This is not a till. S-05 remains the shop money log until S-09 is in force. "
        "Ali posts <code>2500</code>/<code>4200</code> in journals — not from here.</p>"
    )
    if not rows:
        body += '<p class="sub">No money events yet.</p>'
    else:
        tr = []
        for e in rows:
            f = e.get("fields") or {}
            tr.append(
                f'<tr><td class="code">{_esc((e.get("ts") or "")[:19])}</td>'
                f'<td><span class="pill">{_esc(e.get("type"))}</span></td>'
                f'<td class="code">{_esc(e.get("job_no"))}</td>'
                f'<td class="code">{_esc(f.get("receipt_no"))}</td>'
                f'<td>{_esc(f.get("amount"))}</td>'
                f'<td>{_esc(f.get("tender") or f.get("who_paid"))}</td>'
                f'<td>{_esc(e.get("summary"))}</td></tr>'
            )
        body += (
            '<div class="panel"><h2>Lines</h2><table><thead><tr>'
            "<th>When</th><th>Type</th><th>Job</th><th>MAN-</th><th>MVR</th><th>Tender / paid by</th><th>What</th>"
            "</tr></thead><tbody>" + "".join(tr) + "</tbody></table></div>"
        )
    return shell("Money", body, "money", flash)


def page_purchases(flash=None) -> str:
    rows = list(reversed(purchase_events()))
    body = (
        "<h1>Purchases</h1>"
        "<p class=\"sub\">Naleez quotes · Nashid receives · Ali pays. Three-way match on every buy. "
        "Gross to 5100. Paint = job number; else OVERHEAD.</p>"
    )
    if not rows:
        body += '<p class="sub">No purchase events yet.</p>'
    else:
        tr = []
        for e in rows:
            f = e.get("fields") or {}
            tr.append(
                f'<tr><td class="code">{_esc((e.get("ts") or "")[:19])}</td>'
                f'<td><span class="pill">{_esc(e.get("type"))}</span></td>'
                f'<td>{_esc(f.get("supplier"))}</td>'
                f'<td>{_esc(f.get("item"))}</td>'
                f'<td class="code">{_esc(e.get("job_no") or f.get("job_or_overhead"))}</td>'
                f'<td>{_esc(f.get("amount"))}</td>'
                f'<td>{_esc(f.get("match"))}</td>'
                f'<td>{_esc(f.get("tin"))}</td>'
                f'<td>{_esc(e.get("summary"))}</td></tr>'
            )
        body += (
            '<div class="panel"><h2>Buys</h2><table><thead><tr>'
            "<th>When</th><th>Type</th><th>Supplier</th><th>Item</th><th>Job / OH</th>"
            "<th>MVR</th><th>Match</th><th>TIN on invoice</th><th>What</th>"
            "</tr></thead><tbody>" + "".join(tr) + "</tbody></table></div>"
        )
    return shell("Purchases", body, "purchases", flash)


def page_exceptions(flash=None) -> str:
    rows = list(reversed(exception_events()))
    body = (
        "<h1>Exceptions</h1>"
        "<p class=\"sub\">X-01. A recorded gap is recoverable. Types include SOD-COLLAPSE, MATCH-FAIL, DISCOUNT.</p>"
    )
    if not rows:
        body += '<p class="sub">No exceptions logged. That is only good if nothing was skipped.</p>'
    else:
        tr = []
        for e in rows:
            f = e.get("fields") or {}
            tr.append(
                f'<tr><td class="code">{_esc(f.get("x_no"))}</td>'
                f'<td class="code">{_esc((e.get("ts") or "")[:19])}</td>'
                f'<td>{_esc(f.get("x_type"))}</td>'
                f'<td class="code">{_esc(e.get("job_no"))}</td>'
                f'<td>{_esc(e.get("actor"))}</td>'
                f'<td>{_esc(e.get("summary"))}</td></tr>'
            )
        body += (
            '<div class="panel"><h2>Log</h2><table><thead><tr>'
            "<th>X-no</th><th>When</th><th>Type</th><th>Job</th><th>Logged by</th><th>What</th>"
            "</tr></thead><tbody>" + "".join(tr) + "</tbody></table></div>"
        )
    return shell("Exceptions", body, "exceptions", flash)


def page_events(flash=None) -> str:
    body = (
        "<h1>Event log</h1>"
        "<p class=\"sub\">Append-only <code>ops/events.jsonl</code>. Scout: filter by job_no, "
        "walk CALL → CLOSE, reject missing or contradictory steps.</p>"
        + _event_table(events_for())
    )
    return shell("Event log", body, "events", flash)


def page_log(job_no: str | None = None, flash=None, etype=None, scm_step=None) -> str:
    user = A.current_user()
    allowed = A.SEAT_EVENTS.get(user.acting_as, set()) if user else set(EVENT_TYPES)
    selected = _resolve_log_type(etype, user)
    camp = campaign_snapshot(user)
    if not job_no:
        job_no = camp.get("job_no") or None
    scm_val = (scm_step or camp.get("scm_step") or "") or ""
    p = camp.get("purchase") or {}
    if not scm_val and selected == "PURCHASE":
        scm_val = p.get("scm_step") or ""
    show_all = (etype or "").strip().lower() in ("all", "sheet", "full")
    opt_keys = [k for k in EVENT_TYPES if k in allowed]
    if selected not in opt_keys:
        opt_keys = [selected] + opt_keys
    opts = []
    for k in opt_keys:
        v = EVENT_TYPES[k]
        station = _station_name_for_type(k)
        sel = " selected" if k == selected else ""
        opts.append(
            f'<option value="{_esc(k)}"{sel}>{_esc(station)} · {_esc(v["label"])}'
            f' — {_esc(v["sop"])}</option>'
        )
    opts_html = "".join(opts)
    job_val = _esc(job_no or "")
    csrf = _esc(user.csrf if user else "")
    seat = _esc(user.seat_label() if user else "no seat")
    person = _esc(user.name if user else "")
    station = _station_name_for_type(selected)
    sop = EVENT_TYPES[selected]["sop"]
    placeholders = {
        "summary": "What happened on the floor. Unknown = say unknown.",
        "customer": "Who called / who owns the vehicle",
        "phone": "Number they used",
        "vehicle": "Reg · make · model",
        "colour": "Colour they asked for",
        "channel": "Phone / message / walk-in",
        "x_type": "Comeback, mismatch, skipped step…",
        "item": "What is missing / what arrived",
        "supplier": "Who we buy from",
        "job_or_overhead": "JOB-… or OVERHEAD",
        "qty": "Hours, ml, or colour note",
        "collected_by": "Who took the keys",
        "who_paid": "Who paid — not a fused name",
        "job_no": "JOB-2026-0001 / NEW / blank",
        "amount": "MVR already on the card. Do not invent.",
        "sku": "INK-PAINT / INK-WRAP / ST-8211 — blank uses occupancy default",
        "tier": "Card job or custom · car / bike",
    }

    def on(name: str) -> str:
        return _field_on(name, selected, show_all)

    def ph(name: str) -> str:
        return _esc(placeholders.get(name, ""))

    scm_opts = [
        ("", "—"),
        ("need", "need — what's missing"),
        ("quote", "quote — quartermaster"),
        ("award", "award — office"),
        ("receive", "receive — count it in"),
        ("match", "match — office"),
        ("pay", "pay — office"),
    ]
    scm_bits = []
    for k, lab in scm_opts:
        sel = " selected" if k == scm_val else ""
        scm_bits.append(f'<option value="{_esc(k)}"{sel}>{_esc(lab)}</option>')
    scm_html = "".join(scm_bits)

    body = _campaign_panel(user) + f"""
<h1>{_esc(station)}</h1>
<p class="sub">{_esc(EVENT_TYPES[selected]["label"])} <span class="code">{_esc(sop)}</span>
· {_esc(person)} as {_esc(seat)}. One stamp. Not the ledger.</p>
<div class="panel">
<form class="ev{" show-all" if show_all else ""}" id="log-form" method="post" action="/ops/event">
<input type="hidden" name="csrf" value="{csrf}">
<label class="on span">Station
<select name="type" id="ev-type" required>{opts_html}</select></label>
<label class="{on("scm_step")} f" data-for="PURCHASE">Cage step
<select name="scm_step">{scm_html}</select></label>
<label class="{on("job_no")} f" data-for="BOOKING INTAKE ESTIMATE AUTHORISATION JOB_CARD PARTS_PROCUREMENT WORK QC HANDOVER INVOICE_PAYMENT CLOSE STOCK EXCEPTION CRM_FOLLOWUP CRM_COMPLAINT FIN_RECEIVABLE MGMT_APPROVAL MGMT_HR AUTH">Bay / job
<input name="job_no" value="{job_val}" placeholder="{ph("job_no")}"></label>
<label class="{on("customer")} f" data-for="CALL BOOKING INTAKE JOB_CARD CRM_LEAD CRM_FOLLOWUP CRM_COMPLAINT">Customer
<input name="customer" placeholder="{ph("customer")}"></label>
<label class="{on("phone")} f" data-for="CALL BOOKING INTAKE CRM_LEAD CRM_FOLLOWUP CRM_COMPLAINT">Phone
<input name="phone" placeholder="{ph("phone")}"></label>
<label class="{on("vehicle")} f" data-for="CALL BOOKING INTAKE ESTIMATE JOB_CARD CRM_LEAD">Vehicle
<input name="vehicle" placeholder="{ph("vehicle")}"></label>
<label class="{on("colour")} f" data-for="CALL BOOKING INTAKE ESTIMATE JOB_CARD PARTS_PROCUREMENT WORK STOCK">Colour
<input name="colour" placeholder="{ph("colour")}"></label>
<label class="{on("channel")} f" data-for="CALL BOOKING INTAKE CRM_LEAD CRM_FOLLOWUP">Channel
<input name="channel" placeholder="{ph("channel")}"></label>
<label class="{on("tier")} f" data-for="ESTIMATE">Tier
<input name="tier" placeholder="{ph("tier")}"></label>
<label class="{on("firm")} f" data-for="ESTIMATE">Firm?
<select name="firm"><option value=""></option><option>firm</option><option>indicative</option></select></label>
<label class="{on("amount")} f" data-for="ESTIMATE AUTHORISATION INVOICE_PAYMENT CLOSE PURCHASE RECEIPT FIN_PAYABLE FIN_RECEIVABLE FIN_BANK ACCT_MATCH">Amount MVR
<input name="amount" inputmode="decimal" placeholder="{ph("amount")}"></label>
<label class="{on("sku")} f" data-for="CLOSE INVOICE_PAYMENT">Service SKU
<input name="sku" placeholder="{ph("sku")}"></label>
<label class="{on("tender")} f" data-for="AUTHORISATION INVOICE_PAYMENT FIN_RECEIVABLE FIN_BANK">Tender
<select name="tender"><option value=""></option><option>cash</option><option>transfer</option></select></label>
<label class="{on("spoken")} f" data-for="AUTHORISATION">Spoken non-refundable
<select name="spoken"><option value=""></option><option>yes</option><option>no</option></select></label>
<label class="{on("naleez")} f" data-for="AUTHORISATION">Naleez materials ok
<select name="naleez"><option value=""></option><option>yes</option><option>no</option></select></label>
<label class="{on("nashid_people")} f" data-for="AUTHORISATION">Nashid people ok
<select name="nashid_people"><option value=""></option><option>yes</option><option>no</option></select></label>
<label class="{on("supplier")} f" data-for="PARTS_PROCUREMENT PURCHASE RECEIPT FIN_PAYABLE ACCT_MATCH">Supplier
<input name="supplier" placeholder="{ph("supplier")}"></label>
<label class="{on("item")} f" data-for="PARTS_PROCUREMENT PURCHASE RECEIPT FIN_PAYABLE ACCT_MATCH">Item
<input name="item" placeholder="{ph("item")}"></label>
<label class="{on("job_or_overhead")} f" data-for="PURCHASE">Job or OVERHEAD
<input name="job_or_overhead" placeholder="{ph("job_or_overhead")}"></label>
<label class="{on("match")} f" data-for="PURCHASE ACCT_MATCH">Three-way match
<select name="match"><option value=""></option><option>matched</option><option>HOLD — mismatch</option></select></label>
<label class="{on("tin")} f" data-for="PURCHASE ACCT_MATCH">CI name + TIN on invoice
<select name="tin"><option value=""></option><option>yes</option><option>no</option></select></label>
<label class="{on("who_paid")} f" data-for="INVOICE_PAYMENT PURCHASE FIN_PAYABLE FIN_BANK">Paid by
<input name="who_paid" placeholder="{ph("who_paid")}"></label>
<label class="{on("qc_result")} f" data-for="QC">Lamp
<select name="qc_result"><option value=""></option><option>pass</option><option>fail</option></select></label>
<label class="{on("collected_by")} f" data-for="HANDOVER">Collected by
<input name="collected_by" placeholder="{ph("collected_by")}"></label>
<label class="{on("stock_type")} f" data-for="STOCK">Stock
<select name="stock_type"><option value=""></option>
<option>receipt</option><option>issue</option><option>adjustment</option><option>return</option></select></label>
<label class="{on("qty")} f" data-for="PARTS_PROCUREMENT WORK STOCK">Qty / colour note
<input name="qty" placeholder="{ph("qty")}"></label>
<label class="{on("x_type")} f" data-for="EXCEPTION CRM_COMPLAINT">What went wrong
<input name="x_type" placeholder="{ph("x_type")}"></label>
<label class="on span">What happened
<textarea name="summary" required placeholder="{ph("summary")}"></textarea></label>
<button class="stamp" type="submit">Stamp this play</button>
</form></div>
<details class="workshop" id="sheet">
<summary>Workshop sheet — all fields</summary>
<p>Same stamp. Every SOP field. For the office, not the bay screen.</p>
</details>
<script>
(function(){{
  var form = document.getElementById("log-form");
  var sel = document.getElementById("ev-type");
  var sheet = document.getElementById("sheet");
  if (!form || !sel) return;
  function apply() {{
    var t = (sel.value || "").toUpperCase();
    var all = sheet && sheet.open;
    form.classList.toggle("show-all", !!all);
    var labs = form.querySelectorAll("label.f");
    for (var i = 0; i < labs.length; i++) {{
      var el = labs[i];
      var types = (el.getAttribute("data-for") || "").split(/\\s+/);
      var show = all || types.indexOf(t) !== -1;
      if (show) el.classList.add("on"); else el.classList.remove("on");
    }}
  }}
  sel.addEventListener("change", apply);
  if (sheet) sheet.addEventListener("toggle", apply);
  apply();
}})();
</script>
"""
    return shell("Log event", body, "log", flash)


def dispatch_get(path: str, query: dict, flash=None) -> str:
    p = path.strip("/")
    if p in ("ops", "ops/"):
        return page_dashboard(flash)
    if p == "ops/jobs":
        return page_jobs(flash)
    if p == "ops/job":
        jid = (query.get("id") or [""])[0]
        return page_job(jid, flash)
    if p == "ops/money":
        return page_money(flash)
    if p == "ops/purchases":
        return page_purchases(flash)
    if p == "ops/exceptions":
        return page_exceptions(flash)
    if p == "ops/events":
        return page_events(flash)
    if p == "ops/log":
        jn = (query.get("job_no") or [""])[0] or None
        et = (query.get("type") or [""])[0] or None
        scm = (query.get("scm_step") or [""])[0] or None
        return page_log(jn, flash, etype=et, scm_step=scm)
    return page_dashboard(flash)
