#!/usr/bin/env python3
"""
Club Ignition Ops — person identity + first-class role seats.

Google authenticates the **person**. This module authorizes the **seat**.
Three humans may hold many seats; every action is (person, seat, timestamp).

Do not collapse Ali/Nashid/Naleez into three fused mega-roles.
Do not ship a SUPERADMIN seat with seats=['*'] — that is fusion.

# AG-OWNED — Antigravity fills these, nothing else:
  - verify_google_id_token
  - exchange_google_code  (only if they choose auth-code instead of GIS)
  - GOOGLE_VERIFY_IMPLEMENTED = True once verify is real
Elder owns session cookies, allowlist shape, seat switch, SoD guards.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import json
import os
import secrets
import threading
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie

HERE = os.path.dirname(os.path.abspath(__file__))
OPS_DIR = os.path.join(HERE, "ops")
SESSIONS_FILE = os.path.join(OPS_DIR, "sessions.json")
EXAMPLE_ALLOWLIST = os.path.join(HERE, "auth_allowlist.example.json")


def _vault_secrets_dir() -> str:
    """Secrets live at D:\\StarqTech\\_secrets. Do not use D:\\!starq."""
    for root in (
        os.path.join("D:" + os.sep, "StarqTech"),
        os.path.join("D:" + os.sep, "!starq"),
    ):
        candidate = os.path.join(root, "_secrets")
        if os.path.isdir(candidate):
            return candidate
    return os.path.join("D:" + os.sep, "StarqTech", "_secrets")


SECRETS_FILE = os.path.join(_vault_secrets_dir(), "starqBooks.env")
ALLOWLIST_SECRETS = os.path.join(_vault_secrets_dir(), "starqBooks-allowlist.json")

COOKIE_NAME = "sb_ops"
SESSION_HOURS = 12
_lock = threading.Lock()

# AG-OWNED: flip to True only when verify_google_id_token actually verifies a Google ID token.
GOOGLE_VERIFY_IMPLEMENTED = True

SEATS = {
    "owner": {
        "label": "Owner / Founder",
        "short": "Owner",
        "binds": "Company ownership & founder governance",
    },
    "managing_director": {
        "label": "Managing Director",
        "short": "MD",
        "binds": "Company (QC sign-off, people-available, awards with FC)",
    },
    "director": {
        "label": "Director (Club Ignition)",
        "short": "Director",
        "binds": "CI as director — never as Starq. Garage paper: Director of CI.",
    },
    "financial_controller": {
        "label": "Financial Controller",
        "short": "FC",
        "binds": "Award, three-way match before pay, competitive-quote call",
    },
    "quartermaster": {
        "label": "Quartermaster",
        "short": "QM",
        "binds": "Collect quotes only — no award, no sign, no pay",
    },
    "receiver": {
        "label": "Receiver",
        "short": "Receiver",
        "binds": "Goods in / GRN count",
    },
    "payer": {
        "label": "Payer",
        "short": "Payer",
        "binds": "Release money after FC match",
    },
    "counter": {
        "label": "Counter / intake",
        "short": "Counter",
        "binds": "Calls, bookings, intake, deposits on-card, handover after QC",
    },
    "technician": {
        "label": "Technician",
        "short": "Tech",
        "binds": "Work execution, job-card ticks — never QC of own work in one click",
    },
    "qc_signer": {
        "label": "QC signer",
        "short": "QC",
        "binds": "S-02 sign-off. Distinct from technician even when Nashid is both.",
    },
    "stores": {
        "label": "Stores / inventory",
        "short": "Stores",
        "binds": "Compare quotes, stock movements, leftover colour",
    },
    "ledger_poster": {
        "label": "Ledger poster",
        "short": "Books",
        "binds": "the foundation engine journals (DEC-008). Ops events are not books.",
    },
}

# TIGHTENED 22 Aug 2026 — founder decision DEC-054, Option A.
#
# The twelve GARAGE WORKFLOW commands now match `required_seat` in
# api_garage_command exactly, and match contracts/commands.ts COMMAND_SEATS.
# Previously managing_director and director could issue almost all of them, so
# the Python path said yes where the database said no.
#
# Segregation of duties is a property of THIS MAP; who holds which seat is a
# property of membership. A director who must serve a customer holds `counter`
# and acts in it, and the event then records `counter` — what was done, not who
# did it. Both current users already hold `counter`, so this is an explicit seat
# switch, not a lockout. Their DEFAULT seats are `director` and
# `managing_director`, so the first counter action after this change is refused
# until they switch. That refusal is the feature.
#
# `counter` GAINED `CLOSE`. It never had it — only managing_director, director
# and financial_controller could close a job — so removing the others without
# adding it here would have made CLOSE unreachable and left jobs unclosable.
#
# NOT TOUCHED: PURCHASE, STOCK, EXCEPTION, RECEIPT, BILL and INVOICE. Those are
# not garage workflow commands, api_garage_command has no required_seat for
# them, and they are governed elsewhere — SCM_STEP_SEATS, receipt kinds, and
# journal_outbox. Tightening them would be a separate decision.
SEAT_EVENTS = {
    "managing_director": {
        "BILL", "EXCEPTION", "INVOICE", "PURCHASE", "RECEIPT", "STOCK",
    },
    "director": {
        "BILL", "EXCEPTION", "INVOICE", "PURCHASE", "RECEIPT", "STOCK",
    },
    "financial_controller": {
        "BILL", "EXCEPTION", "INVOICE", "PURCHASE", "RECEIPT", "STOCK",
    },
    "quartermaster": {
        "EXCEPTION", "PURCHASE", "STOCK",
    },
    "receiver": {
        "EXCEPTION", "PURCHASE", "RECEIPT", "STOCK",
    },
    "payer": {
        "BILL", "EXCEPTION", "PURCHASE", "RECEIPT",
    },
    "counter": {
        "AUTHORISATION", "BOOKING", "CALL", "CLOSE", "ESTIMATE", "HANDOVER", "INTAKE",
        "INVOICE_PAYMENT", "JOB_CARD", "EXCEPTION", "INVOICE", "RECEIPT",
    },
    "technician": {
        "PARTS_PROCUREMENT", "WORK", "EXCEPTION", "STOCK",
    },
    "qc_signer": {
        "QC", "EXCEPTION",
    },
    "stores": {
        "EXCEPTION", "PURCHASE", "STOCK",
    },
    "ledger_poster": {
        "EXCEPTION",
    },
}
SCM_STEP_SEATS = {
    "need": {"counter", "technician", "quartermaster", "stores", "managing_director",
             "director", "financial_controller"},
    "quote": {"quartermaster"},
    "award": {"financial_controller"},
    "receive": {"receiver"},
    "match": {"financial_controller"},
    "pay": {"payer"},
}

BOOKS_VIEW_SEATS = {
    "director", "financial_controller", "ledger_poster", "managing_director",
}
BOOKS_DECISIONS_SEATS = {"director", "financial_controller", "ledger_poster"}
STARQ_PARENT_BOOKS_SEATS = {"director", "financial_controller", "ledger_poster"}

# Occupancy entities — person → allowed books, not seat → books.
# Superadmin / seats:["*"] is a Users-UI power and is rejected by lookup_person.
# Ali sees Starq because his person record lists starq+group, not because he is admin.
OCCUPANCY_ENTITIES = ("starq", "club-ignition", "group")
ALL_ENTITIES = ["starq", "club-ignition", "group"]
CI_ONLY_ENTITIES = ["club-ignition"]
STARQ_PRINCIPAL_PERSON_IDS = frozenset({"ali"})
STARQ_PRINCIPAL_EMAILS = frozenset({"a.musthaq@gmail.com"})
ENTITY_ALIASES = {
    "group": "group",
    "starq": "starq",
    "starq-technologies": "starq",
    "starq_technologies": "starq",
    "st": "starq",
    "STARQ": "starq",
    "club-ignition": "club-ignition",
    "club_ignition": "club-ignition",
    "ci": "club-ignition",
    "CI": "club-ignition",
}
LEDGER_FOR_OCCUPANCY = {
    "group": None,
    "starq": "STARQ",
    "club-ignition": "CI",
}
OCCUPANCY_FOR_LEDGER = {
    None: "group",
    "": "group",
    "STARQ": "starq",
    "CI": "club-ignition",
}


@dataclass
class User:
    email: str
    person_id: str
    name: str
    seats: list[str]
    acting_as: str
    csrf: str
    session_key: str
    default_seat: str = ""
    entities: list[str] = field(default_factory=list)
    extra: dict = field(default_factory=dict)

    def seat_label(self) -> str:
        info = SEATS.get(self.acting_as) or {}
        return info.get("label", self.acting_as or "no seat")


_user_cv: ContextVar[User | None] = ContextVar("sb_ops_user", default=None)


def current_user() -> User | None:
    return _user_cv.get()


def bind_user(user: User | None):
    return _user_cv.set(user)


def reset_user(token) -> None:
    _user_cv.reset(token)


def _now() -> datetime:
    return datetime.now().astimezone()


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def _parse_env_file(path: str) -> dict[str, str]:
    out = {}
    if not os.path.isfile(path):
        return out
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def secrets_map() -> dict[str, str]:
    merged = _parse_env_file(SECRETS_FILE)
    for k in (
        "STARQBOOKS_GOOGLE_CLIENT_ID",
        "STARQBOOKS_GOOGLE_ANDROID_CLIENT_ID",
        "STARQBOOKS_GOOGLE_CLIENT_SECRET",
        "STARQBOOKS_SESSION_SECRET",
        "STARQBOOKS_ALLOWLIST_PATH",
    ):
        if os.environ.get(k):
            merged[k] = os.environ[k]
    return merged


def google_client_id() -> str:
    cid = (secrets_map().get("STARQBOOKS_GOOGLE_CLIENT_ID") or "").strip()
    if not cid:
        cid_file = os.path.join(OPS_DIR, "google-client-id.txt")
        if os.path.isfile(cid_file):
            try:
                with open(cid_file, encoding="utf-8") as f:
                    cid = f.read().strip()
            except Exception:
                pass
    return cid


def google_audience_ids() -> list[str]:
    """Web client first, optional Android client. Both from env/secrets — never literals."""
    ids: list[str] = []
    web = google_client_id()
    if web:
        ids.append(web)
    android = (secrets_map().get("STARQBOOKS_GOOGLE_ANDROID_CLIENT_ID") or "").strip()
    if android and android not in ids:
        ids.append(android)
    return ids


def google_configured() -> bool:
    return bool(google_audience_ids())


def google_ready() -> bool:
    return google_configured() and GOOGLE_VERIFY_IMPLEMENTED


def session_secret() -> bytes:
    raw = (secrets_map().get("STARQBOOKS_SESSION_SECRET") or "").strip()
    if raw:
        return raw.encode("utf-8")
    return hashlib.sha256(b"the foundation engine-unconfigured-localhost").digest()


def is_placeholder_email(email: str) -> bool:
    e = (email or "").lower()
    return e.startswith("founder_must_supply") or "@" not in e or e.endswith(".example")


def allowlist_path() -> str:
    p = (secrets_map().get("STARQBOOKS_ALLOWLIST_PATH") or "").strip()
    if p:
        return p
    if os.path.isfile(ALLOWLIST_SECRETS):
        return ALLOWLIST_SECRETS
    return EXAMPLE_ALLOWLIST


def load_allowlist() -> dict:
    path = allowlist_path()
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def lookup_person(email: str) -> dict | None:
    want = (email or "").strip().lower()
    if not want or is_placeholder_email(want):
        return None
    for row in load_allowlist().get("people") or []:
        got = (row.get("email") or "").strip().lower()
        if got == want and not is_placeholder_email(got):
            status = (row.get("status") or "active").strip().lower()
            if status != "active":
                return None
            seats = [s for s in (row.get("seats") or []) if s in SEATS]
            if not seats:
                return None
            if "*" in (row.get("seats") or []):
                return None
            out = dict(row)
            out["email"] = got
            out["seats"] = seats
            out["entities"] = entities_for_person(out)
            return out
    return None


def normalize_occupancy(raw: str | None) -> str | None:
    s = (raw or "").strip()
    if not s:
        return None
    return ENTITY_ALIASES.get(s) or ENTITY_ALIASES.get(s.lower())


def occupancy_from_query(raw: str | None) -> str | None:
    """Map ?entity= to an occupancy slug. Empty/missing means Group."""
    s = (raw or "").strip()
    if not s:
        return "group"
    return normalize_occupancy(s)


def entities_for_person(row: dict | None) -> list[str]:
    """Person → allowed occupancy entities.

    Explicit `entities` on the person record wins. If the key is omitted,
    Starq principals (Ali) keep the full set so a missing field cannot lock
    the founder out; everyone else is Club Ignition only. Never infer Starq
    from seats or from seats:['*'].
    """
    if not row:
        return []
    raw = row.get("entities", None)
    if isinstance(raw, str):
        raw = [raw]
    if raw is not None:
        out: list[str] = []
        seen: set[str] = set()
        for item in raw:
            slug = normalize_occupancy("" if item is None else str(item))
            if slug in OCCUPANCY_ENTITIES and slug not in seen:
                seen.add(slug)
                out.append(slug)
        return out
    email = (row.get("email") or "").strip().lower()
    pid = (row.get("person_id") or "").strip().lower()
    if pid in STARQ_PRINCIPAL_PERSON_IDS or email in STARQ_PRINCIPAL_EMAILS:
        return list(ALL_ENTITIES)
    return list(CI_ONLY_ENTITIES)


def default_occupancy(entities: list[str] | None) -> str:
    ents = list(entities or [])
    if "group" in ents:
        return "group"
    if "club-ignition" in ents:
        return "club-ignition"
    if "starq" in ents:
        return "starq"
    return "club-ignition"


def default_books_path(user_or_person) -> str:
    if isinstance(user_or_person, User):
        ents = user_or_person.entities or []
    elif isinstance(user_or_person, dict):
        ents = entities_for_person(user_or_person)
    else:
        ents = []
    slug = default_occupancy(ents)
    ledger = LEDGER_FOR_OCCUPANCY.get(slug)
    if ledger is None:
        return "/"
    return f"/?entity={ledger}"


def is_ci_only(user: User | None) -> bool:
    if user is None:
        return False
    ents = set(user.entities or [])
    return bool(ents) and "starq" not in ents and "group" not in ents


def refresh_entities(user: User) -> list[str]:
    person = lookup_person(user.email)
    if person is not None:
        user.entities = list(person.get("entities") or entities_for_person(person))
    elif not user.entities:
        user.entities = entities_for_person(
            {"email": user.email, "person_id": user.person_id}
        )
    return list(user.entities or [])


def allowed_entities(user: User | None) -> list[str]:
    """API name for occupancy slugs. Same list as user.entities after refresh.

    Not a second ACL. Garage JSON routes must call this (or user.entities).
    Unauthenticated → empty (never leak Group/Starq).
    """
    if user is None:
        return []
    return list(refresh_entities(user))


def may_view_entity(user: User | None, occupancy: str | None) -> bool:
    if user is None:
        return not google_configured()
    slug = occupancy or "group"
    return slug in set(user.entities or [])


def books_access(user: User | None, requested_raw: str, explicit: bool) -> tuple[str | None, str]:
    """Decide books scope. Returns (ledger_token_or_None, action).

    ledger None = Group consolidation. action: login | allow | forbid | coerce.
    """
    if user is None:
        if google_configured():
            return None, "login"
        return None, "allow"
    refresh_entities(user)
    slug = occupancy_from_query(requested_raw)
    if slug is None:
        return None, "forbid"
    if slug not in set(user.entities or []):
        if explicit and (requested_raw or "").strip():
            return None, "forbid"
        return LEDGER_FOR_OCCUPANCY.get(default_occupancy(user.entities)), "coerce"
    return LEDGER_FOR_OCCUPANCY[slug], "allow"


def coerce_next(user: User | None, nxt: str) -> str:
    default = default_books_path(user) if user else "/ops"
    nxt = safe_next(nxt, default)
    if nxt.startswith("/ops") or nxt.startswith("/login") or nxt.startswith("/logout"):
        return nxt
    if nxt.startswith("/auth"):
        return default
    from urllib.parse import urlparse, parse_qs

    parsed = urlparse(nxt)
    raw = (parse_qs(parsed.query).get("entity") or [""])[0]
    explicit = "entity" in parse_qs(parsed.query)
    ledger, action = books_access(user, raw, explicit)
    if action in ("forbid", "coerce", "login"):
        return default
    if ledger is None:
        path = parsed.path or "/"
        qs = parsed.query
        # drop entity= if it was empty group
        return path if not qs else f"{path}?{qs}"
    return nxt


def decision_occupancy(item: dict | None) -> str:
    """Untagged decisions are the founder / group-finance inbox (Ali only)."""
    if not item:
        return "group"
    slug = normalize_occupancy(item.get("entity"))
    return slug or "group"


def decision_visible(item: dict | None, user: User | None) -> bool:
    if user is None:
        return not google_configured()
    return may_view_entity(user, decision_occupancy(item))


# the foundation engine / journals inbox — not Portal scm deploy, Nexus leaks, or POS research.
#
# DEC-024..040 added 21 Aug 2026 on founder instruction: this portal, not Nexus, is where he
# actually answers decisions, so the corporate/CI/product questions belong on this page too.
# They are entity-tagged (STARQ / CI / SD) and still pass through decision_visible().
_STARQBOOKS_DECISION_IDS = frozenset({
    "DEC-001", "DEC-002", "DEC-003", "DEC-004", "DEC-005",
    "DEC-006", "DEC-007", "DEC-008", "DEC-009", "DEC-010",
    "DEC-019", "DEC-023",
    "DEC-024", "DEC-025", "DEC-026", "DEC-027", "DEC-028",
    "DEC-029", "DEC-030", "DEC-031", "DEC-032", "DEC-033",
    "DEC-034", "DEC-035", "DEC-036", "DEC-037", "DEC-038",
    "DEC-039", "DEC-040",
    "DEC-041", "DEC-042", "DEC-043", "DEC-044", "DEC-045",
    "DEC-046", "DEC-047", "DEC-048", "DEC-049", "DEC-050",
    "DEC-051", "DEC-052", "DEC-053",
})
_PORTAL_ONLY_DECISION_MARKERS = (
    "starqnexus",
    "vercel.app",
    "peopleprofiles",
    "futsal fiesta",
    "github.com/almstq/starq-portal",
    "library index ships",
    "saas_foundation",
    "powersync",
    "which product ships first - starq erp",
    "offline-first: do we prevent oversells",
    "hosting and a hard monthly usd ceiling",
    "is starq tenant zero",
    "git history, or re-push",
)


def decision_starqbooks_relevant(item: dict | None) -> bool:
    """Filter decisions.json to books/journals items already on disk. No invented rows."""
    if not item:
        return False
    did = str(item.get("id") or "").strip()
    if did in _STARQBOOKS_DECISION_IDS:
        return True
    blob = " ".join(
        str(item.get(k) or "") for k in ("title", "question", "context", "body")
    ).lower()
    if any(m in blob for m in _PORTAL_ONLY_DECISION_MARKERS):
        return False
    if "the foundation engine" in blob or "books.py" in blob or "journals/" in blob:
        return True
    return False


_GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
_CLOCK_SKEW_S = 60


def _google_verify_request():
    """google-auth Request. Prefer the requests transport; stdlib if it is missing.

    google.auth.transport.requests imports cleanly without the `requests` package,
    then Request() raises ImportError. A thin venv with only google-auth used to
    surface that as verify_failed on every GIS POST.
    """
    try:
        from google.auth.transport import requests as google_requests

        return google_requests.Request()
    except ImportError:
        pass
    from google.auth.transport._http_client import Request as StdlibRequest

    return StdlibRequest()


def public_google_error(err: str) -> str:
    """Founder-facing flash. Stable codes only — never token guts or exception text."""
    if err == "token_layer_missing":
        return "Waiting for Google."
    code = (err or "verify_failed").split(":", 1)[0].strip() or "verify_failed"
    if code == "google_not_configured":
        shown = "not configured"
    elif code in (
        "invalid_token",
        "empty_token",
        "audience_mismatch",
        "email_not_verified",
        "missing_email",
    ):
        shown = "invalid_token"
    elif code == "verify_failed":
        shown = "verify_failed"
    else:
        shown = "verify_failed"
    return f"Google sign-in failed ({shown})."


def verify_google_id_token(id_token: str) -> tuple[dict | None, str]:
    """Return ({email, sub, name}, error).

    # AG-OWNED
    Implement with google-auth (google.oauth2.id_token.verify_oauth2_token)
    against STARQBOOKS_GOOGLE_CLIENT_ID. Audience MUST be that client ID.
    Reject if email_verified is not true.
    Do not trust the GIS callback payload without this verify.
    Install google-auth into a venv on D: inside this folder — RULE 0, never C:.
    Do not use tokeninfo as the production verify without pinning aud + iss.
    """
    if not GOOGLE_VERIFY_IMPLEMENTED:
        return None, "token_layer_missing"
    if not id_token or not id_token.strip():
        return None, "empty_token"
    audiences = google_audience_ids()
    if not audiences:
        return None, "google_not_configured"
    try:
        from google.oauth2 import id_token as google_id_token

        req = _google_verify_request()
        last_err = "invalid_token"
        claims = None
        matched_aud = ""
        for aud in audiences:
            try:
                claims = google_id_token.verify_oauth2_token(
                    id_token.strip(),
                    req,
                    audience=aud,
                    clock_skew_in_seconds=_CLOCK_SKEW_S,
                )
            except Exception as e:
                last_err = f"verify_failed: {e}"
                claims = None
                continue
            if claims.get("aud") != aud:
                last_err = "audience_mismatch"
                claims = None
                continue
            matched_aud = aud
            break
        if not claims or not matched_aud:
            return None, last_err
        iss = claims.get("iss") or ""
        if iss not in _GOOGLE_ISSUERS:
            return None, "invalid_token: bad issuer"
        if not claims.get("email_verified"):
            return None, "email_not_verified"
        email = (claims.get("email") or "").strip().lower()
        if not email:
            return None, "missing_email"
        name = claims.get("name") or email
        sub = claims.get("sub") or ""
        return {"email": email, "name": name, "sub": sub}, ""
    except Exception as e:
        return None, f"verify_failed: {e}"


def exchange_google_code(code: str, redirect_uri: str) -> tuple[str | None, str]:
    """Optional auth-code path. Prefer GIS ID token for localhost.

    # AG-OWNED
    """
    _ = (code, redirect_uri)
    return None, "token_layer_missing"


def _ensure_ops() -> None:
    os.makedirs(OPS_DIR, exist_ok=True)


def _load_sessions() -> dict:
    _ensure_ops()
    if not os.path.isfile(SESSIONS_FILE):
        return {"sessions": {}}
    try:
        with open(SESSIONS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"sessions": {}}
        data.setdefault("sessions", {})
        return data
    except Exception:
        return {"sessions": {}}


def _save_sessions(data: dict) -> None:
    _ensure_ops()
    tmp = SESSIONS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, SESSIONS_FILE)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def cookie_header(token: str | None, max_age: int | None = None) -> str:
    if not token:
        return f"{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    age = SESSION_HOURS * 3600 if max_age is None else max_age
    return f"{COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={age}"


def token_from_headers(header_cookie: str | None) -> str | None:
    if not header_cookie:
        return None
    jar = SimpleCookie()
    try:
        jar.load(header_cookie)
    except Exception:
        return None
    morsel = jar.get(COOKIE_NAME)
    if not morsel:
        return None
    val = morsel.value.strip()
    return val or None


def _row_to_user(key: str, row: dict) -> User | None:
    email = (row.get("email") or "").strip().lower()
    seats = [s for s in (row.get("seats") or []) if s in SEATS]
    acting = row.get("acting_as") or ""
    if not email or not seats or acting not in seats:
        return None
    ents = entities_for_person({
        "email": email,
        "person_id": row.get("person_id") or "",
        "entities": row.get("entities"),
    })
    return User(
        email=email,
        person_id=row.get("person_id") or "",
        name=row.get("name") or email,
        seats=seats,
        acting_as=acting,
        csrf=row.get("csrf") or "",
        session_key=key,
        default_seat=row.get("default_seat") or seats[0],
        entities=ents,
    )


def get_user_by_token(token: str | None) -> User | None:
    if not token:
        return None
    key = _hash_token(token)
    with _lock:
        data = _load_sessions()
        row = (data.get("sessions") or {}).get(key)
        if not row:
            return None
        try:
            exp = datetime.fromisoformat(row["expires_at"])
        except Exception:
            return None
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < _now():
            data["sessions"].pop(key, None)
            _save_sessions(data)
            return None
        row["last_seen"] = _iso(_now())
        row["expires_at"] = _iso(_now() + timedelta(hours=SESSION_HOURS))
        data["sessions"][key] = row
        _save_sessions(data)
        return _row_to_user(key, row)


def create_session(person: dict, acting_as: str | None = None) -> tuple[str, User]:
    seats = [s for s in (person.get("seats") or []) if s in SEATS]
    default = person.get("default_seat") if person.get("default_seat") in seats else (seats[0] if seats else "")
    seat = acting_as if acting_as in seats else default
    token = secrets.token_urlsafe(32)
    key = _hash_token(token)
    csrf = secrets.token_urlsafe(24)
    ents = entities_for_person(person)
    row = {
        "email": person["email"],
        "person_id": person.get("person_id") or "",
        "name": person.get("name") or person["email"],
        "seats": seats,
        "acting_as": seat,
        "default_seat": default,
        "entities": ents,
        "csrf": csrf,
        "created_at": _iso(_now()),
        "last_seen": _iso(_now()),
        "expires_at": _iso(_now() + timedelta(hours=SESSION_HOURS)),
    }
    with _lock:
        data = _load_sessions()
        data["sessions"][key] = row
        _save_sessions(data)
    user = _row_to_user(key, row)
    assert user is not None
    return token, user


def destroy_session(token: str | None) -> User | None:
    if not token:
        return None
    key = _hash_token(token)
    with _lock:
        data = _load_sessions()
        row = (data.get("sessions") or {}).pop(key, None)
        _save_sessions(data)
    return _row_to_user(key, row) if row else None


def switch_seat(user: User, new_seat: str) -> tuple[User | None, str | None]:
    if new_seat not in SEATS:
        return None, "Unknown seat."
    if new_seat not in user.seats:
        return None, "That seat is not on your allowlist."
    if new_seat == user.acting_as:
        return user, None
    with _lock:
        data = _load_sessions()
        row = (data.get("sessions") or {}).get(user.session_key)
        if not row:
            return None, "Session expired."
        prev = row.get("acting_as")
        row["acting_as"] = new_seat
        row["last_seen"] = _iso(_now())
        data["sessions"][user.session_key] = row
        _save_sessions(data)
    updated = _row_to_user(user.session_key, row)
    if updated:
        updated.extra["previous_seat"] = prev
    return updated, None


def csrf_ok(user: User | None, posted: str) -> bool:
    if user is None or not user.csrf or not posted:
        return False
    return hmac.compare_digest(user.csrf, posted)


def csrf_token(user: User | None) -> str:
    """The token to embed in a form, or "" when there is no session.

    serve.py has called this since the SCM approve button was written, but it was never defined
    here — `_scm_approve_form` (serve.py:1313) and `h_notes` (serve.py:3716) both raised
    AttributeError at runtime. Neither is reached on every request, which is why it stayed
    hidden: the first needs a pending SCM step, the second a user who may reply to decisions.

    Returning "" rather than raising for a missing session is deliberate. `csrf_ok` already
    refuses an empty token, so a form rendered without a session produces one that cannot be
    submitted — the failure lands at submit time as a refusal, not at render time as a 500.
    """
    return (user.csrf if user is not None else "") or ""


def safe_next(raw: str | None, default: str = "/ops") -> str:
    s = (raw or "").strip() or default
    if not s.startswith("/") or s.startswith("//") or "\\" in s or ":" in s:
        return default
    return s


RECEIPT_KINDS_ALL = frozenset({
    "rent", "electricity", "water", "purchase", "parts", "consumable", "fee", "other",
})
RECEIPT_KINDS_GARAGE = frozenset({"purchase", "parts", "consumable"})
RECEIPT_SEATS_ALL = frozenset({"director", "financial_controller", "payer"})
RECEIPT_SEATS_GARAGE = frozenset({"receiver", "managing_director", "counter"})


def normalize_event_type(etype: str) -> str:
    e = (etype or "").strip().upper()
    return e


def receipt_kinds_for_seat(seat: str) -> tuple[str, ...]:
    if seat in RECEIPT_SEATS_ALL:
        return tuple(sorted(RECEIPT_KINDS_ALL))
    if seat in RECEIPT_SEATS_GARAGE:
        return tuple(sorted(RECEIPT_KINDS_GARAGE))
    return ()


def seat_may_event(seat: str, etype: str) -> bool:
    return normalize_event_type(etype) in SEAT_EVENTS.get(seat, set())


def seat_may_scm_step(seat: str, step: str) -> bool:
    allowed = SCM_STEP_SEATS.get(step)
    if not allowed:
        return False
    return seat in allowed


def authorize_event(user: User | None, etype: str, form: dict) -> str | None:
    if user is None:
        return "Sign in required."
    seat = user.acting_as
    if not seat:
        return "Pick a seat before logging an event."
    etype = normalize_event_type(etype)
    if not seat_may_event(seat, etype):
        return f"Seat {SEATS.get(seat, {}).get('label', seat)} cannot log {etype}."
    if etype == "RECEIPT":
        kind = (form.get("kind") or "").strip().lower()
        if kind not in RECEIPT_KINDS_ALL:
            return "Receipt kind is required (rent / electricity / water / purchase / parts / consumable / fee / other)."
        allowed = receipt_kinds_for_seat(seat)
        if not allowed:
            return f"Seat {SEATS.get(seat, {}).get('label', seat)} cannot capture receipts."
        if kind not in allowed:
            return (
                f"Seat {SEATS.get(seat, {}).get('label', seat)} cannot capture kind '{kind}'. "
                "Garage seats capture purchase / parts / consumable only — not rent, utilities, or pay."
            )
        bill_date = (form.get("bill_date") or "").strip()
        if not bill_date:
            return "bill_date is required."
        amount = (form.get("amount") or "").strip()
        if not amount:
            return "amount is required."
    if etype == "BILL":
        import journal_outbox as JO
        occ = (form.get("entity") or "").strip().upper()
        _fields, err = JO.prepare_supplier_bill(form, occupancy=occ, seat=seat)
        if err:
            return err
    if etype == "INVOICE":
        import journal_outbox as JO
        occ = (form.get("entity") or "").strip().upper()
        _fields, err = JO.prepare_customer_invoice(form, occupancy=occ, seat=seat)
        if err:
            return err
    if etype == "PURCHASE":
        step = (form.get("scm_step") or "").strip().lower()
        if not step:
            return "Purchase events need an SCM step (quote / award / receive / match / pay)."
        if step not in SCM_STEP_SEATS:
            return "Unknown SCM step."
        if not seat_may_scm_step(seat, step):
            return f"Seat {SEATS.get(seat, {}).get('label', seat)} cannot perform SCM step '{step}'."
    if etype == "QC" and seat == "technician":
        return "Technician cannot sign QC. Switch to the QC signer seat."
    if etype == "PURCHASE" and (form.get("scm_step") or "").strip().lower() == "pay" and seat == "quartermaster":
        return "Quartermaster cannot pay. Switch to Payer after FC match."
    return None


def check_sod(user: User, etype: str, form: dict, events: list[dict]) -> str | None:
    email = user.email
    job = (form.get("job_no") or "").strip().upper() or None
    if job in ("NEW", "NONE", "-"):
        job = None
    step = (form.get("scm_step") or "").strip().lower()

    def last_by(pred):
        for e in reversed(events):
            if pred(e):
                return e
        return None

    def switched_after(after_ts: str, to_seat: str) -> bool:
        for e in events:
            if e.get("type") != "auth.role_switch":
                continue
            if (e.get("actor_email") or "").lower() != email:
                continue
            if (e.get("ts") or "") <= (after_ts or ""):
                continue
            fields = e.get("fields") or {}
            if (fields.get("to_seat") or e.get("actor_role")) == to_seat:
                return True
        return False

    if etype == "QC":
        work = last_by(
            lambda e: e.get("type") == "WORK"
            and (e.get("actor_email") or "").lower() == email
            and (not job or e.get("job_no") == job)
        )
        if work and user.acting_as == "qc_signer":
            if not switched_after(work.get("ts") or "", "qc_signer"):
                return (
                    "You logged work on this job as technician. Switch to the QC signer seat "
                    "(second timestamp) before signing QC — not one click."
                )

    if etype == "PURCHASE" and step == "pay":
        ordered = last_by(
            lambda e: e.get("type") in ("PURCHASE", "PARTS_PROCUREMENT")
            and (e.get("actor_email") or "").lower() == email
            and (e.get("actor_role") == "quartermaster"
                 or (e.get("fields") or {}).get("scm_step") == "quote")
        )
        if ordered and user.acting_as == "payer":
            if not switched_after(ordered.get("ts") or "", "payer"):
                return (
                    "You ordered as quartermaster. Switch to Payer (second timestamp) before "
                    "payment — never PO and pay in one click."
                )
        awarded = last_by(
            lambda e: e.get("type") == "PURCHASE"
            and (e.get("actor_email") or "").lower() == email
            and ((e.get("fields") or {}).get("scm_step") == "award"
                 or e.get("actor_role") == "financial_controller")
        )
        if awarded and user.acting_as == "payer" and awarded.get("actor_role") == "financial_controller":
            if not switched_after(awarded.get("ts") or "", "payer"):
                return (
                    "FC award and pay must be two timestamps. Switch from Financial Controller "
                    "to Payer, then log pay."
                )
    return None


def may_view_books(user: User | None, entity: str | None) -> bool:
    """entity is the ledger token (STARQ / CI) or None for Group."""
    if user is None:
        return not google_configured()
    refresh_entities(user)
    slug = OCCUPANCY_FOR_LEDGER.get(entity, normalize_occupancy(entity) or "group")
    return may_view_entity(user, slug)


def may_reply_decisions(user: User | None) -> bool:
    if user is None:
        return not google_configured()
    return bool(set(user.seats) & BOOKS_DECISIONS_SEATS)


LOGIN_CSS = """
:root{--ink:#060A18;--text:#F3F5FA;--muted:#8E97B3;--accent:#2E88FF;--accent2:#00C9FF;
--line:rgba(255,255,255,.10);--ok:#4ade80;--warn:#fbbf24}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:"Space Grotesk",Inter,system-ui,sans-serif;color:var(--text);
background:radial-gradient(circle at 8% 0%,rgba(46,136,255,.18),transparent 34%),linear-gradient(180deg,#0B1437,#060A18 55%)}
.box{width:min(calc(100% - 32px),440px);margin:10vh auto;border:1px solid var(--line);border-radius:16px;
padding:28px 26px 22px;background:rgba(255,255,255,.03)}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;margin:0 0 6px}
.logo img{width:32px;height:32px;object-fit:contain}
.logo b{font-weight:700}
h1{font-size:22px;margin:18px 0 8px;letter-spacing:-.02em}
p{color:var(--muted);font-size:14px;line-height:1.6;margin:0 0 12px}
.note{border-left:3px solid var(--warn);background:rgba(251,191,36,.08);padding:12px 14px;border-radius:0 8px 8px 0;
font-size:13px;color:#e8e8ef;margin:0 0 16px}
.err{border-left-color:#E01B24;background:rgba(224,27,36,.1)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 16px;
border:0;border-radius:10px;background:#2E88FF;color:#fff;font:inherit;font-weight:600;font-size:14px}
.btn[disabled]{opacity:.45;cursor:not-allowed;filter:none}
footer{margin-top:22px;font-size:11.5px;color:var(--muted);line-height:1.55}
.gbox{min-height:44px;margin:8px 0 14px}
code{font-family:ui-monospace,Menlo,monospace;font-size:12px}
"""


def page_login(next_path: str = "/", flash: str | None = None, denied: bool = False) -> str:
    nxt = html.escape(safe_next(next_path), quote=True)
    cid = html.escape(google_client_id(), quote=True)
    ready = google_ready()
    configured = google_configured()
    if flash:
        note = f'<div class="note {"err" if denied else ""}">{html.escape(flash)}</div>'
    elif not configured:
        note = (
            '<div class="note">Waiting for Google. Founder must supply a Google Cloud OAuth '
            "<b>client ID</b> and allowlisted Gmail addresses. Token verify is Antigravity "
            "(<code># AG-OWNED</code>). No open signup. No fused superadmin.</div>"
        )
    elif not GOOGLE_VERIFY_IMPLEMENTED:
        note = (
            '<div class="note">Google client ID is present, but ID-token verification is not '
            "wired yet (<code># AG-OWNED</code> in <code>auth.py</code>).</div>"
        )
    else:
        note = ""
    gis = ""
    if configured:
        gis = f"""
<div class="gbox" id="gis-slot">
<!-- # AG-OWNED: Google Identity Services. Load gsi/client, render the button,
     POST the ID token to /auth/google as credential. Do not skip server verify. -->
<div id="g_id_onload" data-client_id="{cid}" data-callback="sbOpsGoogle" data-auto_prompt="false"></div>
<div class="g_id_signin" data-type="standard" data-theme="filled_black" data-size="large" data-text="signin_with" data-width="360"></div>
</div>
<script>
function sbOpsGoogle(resp){{
  var f=document.getElementById('google-form');
  f.credential.value=resp.credential||'';
  f.submit();
}}
</script>
"""
        if not ready:
            gis += '<button class="btn" type="button" disabled>Sign in with Google — waiting for token verify</button>'
    else:
        gis = '<button class="btn" type="button" disabled>Sign in with Google — waiting for Google</button>'
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/png" href="/assets/starq-favicon.png">
<title>Sign in — the foundation engine</title>
<style>{LOGIN_CSS}</style>
{"<script src='https://accounts.google.com/gsi/client' async defer></script>" if configured else ""}
</head><body>
<div class="box">
<div class="logo"><img src="/assets/starq-logo.png" alt="">starq<b>Books</b></div>
<h1>Sign in</h1>
<p>Google identifies <b>you</b>. After sign-in, your <b>organisation</b> occupancy loads
from the server — then you pick a <b>seat</b> to act as. The app is the foundation engine either way.
No public registration.</p>
{note}
<form id="google-form" method="post" action="/auth/google">
<input type="hidden" name="credential" value="">
<input type="hidden" name="next" value="{nxt}">
</form>
{gis}
<footer>
the foundation engine · bound to 127.0.0.1 · no open signup · do not tunnel.
</footer>
</div></body></html>"""


def who_strip(user: User | None) -> str:
    if not user:
        return (
            '<a class="back" href="/login?next=/ops">Sign in</a>'
            '<a class="back" href="/login?next=/">Books →</a>'
        )
    opts = []
    for s in user.seats:
        sel = " selected" if s == user.acting_as else ""
        opts.append(
            f'<option value="{html.escape(s)}"{sel}>'
            f'{html.escape(SEATS.get(s, {}).get("label", s))}</option>'
        )
    return f"""<div class="who">
<span class="nm">{html.escape(user.name)}</span>
<span class="pill">{html.escape(SEATS.get(user.acting_as, {}).get("short", user.acting_as))}</span>
<form class="seat-form" method="post" action="/auth/seat">
<input type="hidden" name="csrf" value="{html.escape(user.csrf, quote=True)}">
<label>Acting as
<select name="seat" onchange="this.form.submit()">{"".join(opts)}</select></label>
</form>
<a class="back" href="/logout">Sign out</a>
<a class="back" href="{html.escape(default_books_path(user), quote=True)}">Books →</a>
</div>"""
