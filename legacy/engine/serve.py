#!/usr/bin/env python3
"""
the foundation engine — read-only web viewer for the reports. Pre-alpha.

A Starq Technologies product: the shell carries the corporate identity from
BRAND_IDENTITY.md (Deep Space / Aurora Blue / Cyan Pulse). When Club Ignition's
books are on screen the accent switches to the subsidiary's own signal red —
the group runs the tool, each entity keeps its identity.

    python serve.py            then open http://127.0.0.1:51800

This is a VIEWER for the ledger, plus Club Ignition Ops at /ops.

Write routes (none can touch journals/):
  POST /decisions/reply  → decisions.json
  POST /expenses/bill    → supplier bill ops event + AP outbox draft (DEC-008, no journal write)
  POST /sales/invoice    → customer invoice ops event + AR 1200 outbox draft (DEC-008, no journal write)
  POST /ops/event        → ops/events.jsonl + ops/state.json
  POST /documents/issue  → organizations.json sequences + ops/issued_documents.jsonl
  POST /scm/approve      → ops PURCHASE scm_step (award/receive/match/pay); journals untouched
  POST /contacts/create  → ops/masters/contacts.json (occupancy-scoped, no seed)
  POST /contacts/from-call → contact from CALL name already on ops (never invented)
  POST /locations/create → ops/masters/locations.json (name + type, keep H. Kiev)
  POST /payroll/employee → ops/masters/payroll.json (name + seat only, no salary)
  POST /payroll/rate     → ops/masters/payroll.json rate_mvr (optional, Ali types it)
  POST /notes/append     → ops/notes/<occupancy>.txt (local notes, not journals)
  POST /auth/google      → session (Antigravity: ID-token verify)
  POST /auth/seat        → acting-as seat switch
  GET  /documents/print  → local HTML PO/INV (letterhead from org; DRAFT until issued)

/ops requires a signed session. Allowlist is email → seats + entities.
Once Google is configured, books also require a session. Bind 127.0.0.1 only.
Person → entities: Ali sees group+starq+club-ignition; CI occupants see club-ignition only.
"""

from __future__ import annotations

import html
import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import webbrowser
import calendar as pycal
from datetime import date, datetime, timedelta
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse


class ExclusiveHTTPServer(ThreadingHTTPServer):
    """Refuse to share the port. See the long note in scm/portal.py.

    Short version: `http.server` sets `allow_reuse_address = 1`, and on Windows
    that lets a second process bind a port that is already LISTENING, so two
    servers split the traffic. For a financial viewer that is worse than for an
    ops tool — you would be reading numbers from whichever instance answered.
    """

    allow_reuse_address = not hasattr(socket, "SO_EXCLUSIVEADDRUSE")

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

import books as B
import ops as O
import auth as A
import catalog as CAT
import masters as M
import journal_outbox as JO
import pos as POS

HERE = os.path.dirname(os.path.abspath(__file__))
# realpath, not abspath. D:\StarqTech and D:\!starq are one directory joined by a junction, so
# which name appears here depends only on how the process was launched. Comparing spellings made
# the server refuse to start from D:\!starq\the foundation engine — the path everything had used for
# months — the moment this constant was updated to the new name. realpath collapses the junction,
# so both names work now and both keep working after the two folders swap roles in the rename.
LIVE_ROOT = os.path.normcase(os.path.realpath(r"D:\StarqTech\the foundation engine"))
NESTED_MARK = os.path.normcase(os.path.join("operations", "finance", "the foundation engine"))
HOST = "127.0.0.1"
# 51763 is VOID DECK's. Windows also reserves scattered ranges for Hyper-V/WSL,
# so a bind can fail on a port nothing is visibly using — hence the fallbacks.
PORTS = [51800, 51801, 51770, 8899, 7654]

# Static assets: whitelist only — the name in the URL is looked up here, never
# joined to a path, so there is no traversal surface.
ASSETS_DIR = os.path.join(HERE, "assets")
ASSET_FILES = {
    "starq-logo.png": "image/png",
    "ci-logo.png": "image/png",
    "starq-favicon.png": "image/png",
    "ci-favicon.png": "image/png",
}

# Dates arriving in the query string are only ever accepted in this shape.
# Anything else is dropped — that also keeps arbitrary strings out of the
# href/value attributes they get echoed into.
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
CASH_CODES = ("1110", "1120", "1121", "1125")
RECEIPTS_DIR = os.path.join(HERE, "ops", "artefacts", "receipts")


def clean_date(s: str | None) -> str | None:
    return s if s and DATE_RE.match(s) else None


def clean_month(s: str | None) -> str | None:
    if not s or not MONTH_RE.match(s):
        return None
    y, m = int(s[:4]), int(s[5:7])
    if not 1 <= m <= 12:
        return None
    return s


# Decisions — the founder inbox. Agents raise items that only Mustarq can
# answer; he replies in the portal; the raising agent actions the reply and
# flips the status to "actioned". The file is git-versioned like the journals.
#
# ONE STORE, TWO SURFACES (21 Aug 2026). This portal and Starq Nexus both show the founder's
# decisions. They used to read two different decisions.json files that had to be mirrored by
# hand, which is a drift waiting to happen — and it did: 17 decisions existed on one and not
# the other. Both surfaces now read and write ONE file. Answering in either place is the same
# answer.
#
# WHERE IT LIVES, AND WHY IT MOVED (DEC-058, 22 Aug 2026). The store is now in the VAULT at
# 00_STARQ_HQ/decisions.json. It used to sit here in legacy/engine/ — where it was tracked by NO
# repository at all: the vault ignores legacy/engine/ wholesale, and the foundation engine ignores
# decisions.json because this repo has a GitHub remote and these records carry names, amounts
# and registration numbers. Both rules were right; together they meant 58 founder decisions
# existed as one file on one disk with no history and no backup. It was absent from the 22 Aug
# offsite bundles, and the copy in the 17 Aug zip was the retired decoy lineage.
#
# Git cannot fix that in place: a nested .git is a hard boundary, so the vault silently refuses
# to track anything inside legacy/engine/. Moving it out was the only route to version history.
#
# THREE PATHS THIS MUST NEVER GO BACK TO:
#   00_STARQ_HQ/operations/finance/legacy/engine/decisions.json  — the decoy, retired 22 Aug 09:03.
#       This constant pointed there until today and only worked by FALLING THROUGH to the local
#       sibling. Had anyone re-created that path, this portal would have silently preferred a
#       stale store over the live one.
#   legacy/engine/decisions.json  — the previous home; a tombstone now stands there.
#   anywhere else  — starqNexus/scripts/check-single-store.mjs fails the build if a second
#       copy appears, and that check is wired into prebuild.
#
# NO FALLBACK, DELIBERATELY. A standalone the foundation engine checkout has no decision store, and that
# is correct — founder decisions are not answerable from a detached copy. Resolving to a local
# sibling is exactly how the drift started, so reads return [] and writes fail loudly instead.
DECISIONS_FILE = os.path.abspath(
    os.path.join(HERE, os.pardir, "00_STARQ_HQ", "decisions.json")
)
MAX_REPLY = 4000
NOTES_DIR = os.path.join(HERE, "ops", "notes")
MAX_NOTE_APPEND = 4000


def _safe_engine_path(path: str, root: str) -> str:
    resolved = os.path.realpath(path)
    base = os.path.realpath(root)
    if resolved != base and not resolved.startswith(base + os.sep):
        raise ValueError(f"engine path escaped approved directory: {resolved}")
    return resolved


def _notes_slug(entity) -> str:
    if entity == "STARQ":
        return "starq"
    if entity == "CI":
        return "ci"
    return "group"


def _notes_path(entity) -> str:
    return _safe_engine_path(os.path.join(NOTES_DIR, f"{_notes_slug(entity)}.txt"), NOTES_DIR)


def load_local_notes(entity) -> str:
    path = _notes_path(entity)
    if not os.path.isfile(path):
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def append_local_notes(entity, text: str, *, person_id: str = "", seat: str = "") -> str | None:
    """Append one line to the occupancy notes file. Returns error string or None."""
    body = (text or "").strip()
    if not body:
        return "Empty note refused."
    if len(body) > MAX_NOTE_APPEND:
        return f"Note too long (max {MAX_NOTE_APPEND})."
    os.makedirs(NOTES_DIR, exist_ok=True)
    path = _notes_path(entity)
    stamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    who = person_id or seat or "user"
    line = f"[{stamp} {who}] {body}\n"
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(line)
    except OSError as exc:
        return str(exc)
    return None


def load_decisions() -> list:
    try:
        with open(DECISIONS_FILE, encoding="utf-8") as f:
            items = json.load(f)
        return items if isinstance(items, list) else []
    except Exception:
        return []


def save_decisions(items: list) -> None:
    """Atomic: write a sibling temp file, then replace. A crash mid-write
    leaves the original intact."""
    tmp = DECISIONS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, DECISIONS_FILE)


def decisions_open_count() -> int:
    user = A.current_user()
    return sum(
        1 for d in load_decisions()
        if d.get("status") == "open"
        and A.decision_visible(d, user)
        and A.decision_starqbooks_relevant(d)
    )


BOOKS_TABS = {
    "", "home", "overview", "tb", "pl", "bs", "journal", "accounts", "notes", "decisions",
    "sales", "expenses", "banking", "contacts", "products", "projects", "reports", "accounting",
    "settings", "transactions", "pos",
}


# ---------------------------------------------------------------- data ----

def ensure_db() -> str | None:
    """Rebuild books.db from the journals. Returns an error string, or None."""
    try:
        accounts = B.load_accounts()
        entries = B.load_all(accounts)
    except B.LedgerError as exc:
        return str(exc)
    B.post(accounts, entries)
    return None


def q(sql: str, args=()) -> list:
    con = sqlite3.connect(B.DB)
    con.row_factory = sqlite3.Row
    rows = con.execute(sql, args).fetchall()
    con.close()
    return rows


def bal(entity=None, consolidated=False, date_from=None, date_to=None) -> dict:
    return B.balances(entity, consolidated, date_from, date_to)


def acct_map() -> dict:
    return B.chart()


def money(d: Decimal) -> str:
    return f"{d:,.2f}"


def signed_class(d: Decimal) -> str:
    return "neg" if d < 0 else ""


# ------------------------------------------------------------- reports ----

def report_tb(acc, entity, dto):
    rows, td, tc = [], Decimal("0"), Decimal("0")
    for code, v in sorted(bal(entity, entity is None, None, dto).items()):
        d, c = (v, Decimal("0")) if v > 0 else (Decimal("0"), -v)
        td += d
        tc += c
        rows.append((code, acc[code]["name"], d, c))
    return rows, td, tc


def report_pl(acc, entity, dfrom, dto):
    b = bal(entity, entity is None, dfrom, dto)
    out = {"INCOME": [], "EXPENSE": []}
    tot = {"INCOME": Decimal("0"), "EXPENSE": Decimal("0")}
    for code, v in sorted(b.items()):
        t = acc[code]["type"]
        if t in out:
            dv = B.display(code, v, acc)
            out[t].append((code, acc[code]["name"], dv))
            tot[t] += dv
    return out, tot, tot["INCOME"] - tot["EXPENSE"]


def report_bs(acc, entity, dto):
    b = bal(entity, entity is None, None, dto)
    result = Decimal("0")
    for code, v in b.items():
        t = acc[code]["type"]
        if t == "INCOME":
            result += -v
        elif t == "EXPENSE":
            result -= v
    groups, totals = {}, {}
    for g in ("ASSET", "LIABILITY", "EQUITY"):
        rows = [(c, acc[c]["name"], B.display(c, v, acc)) for c, v in sorted(b.items()) if acc[c]["type"] == g]
        s = sum((r[2] for r in rows), Decimal("0"))
        if g == "EQUITY":
            s += result
        groups[g] = rows
        totals[g] = s
    return groups, totals, result


def report_ledger(acc, code, entity, dfrom=None, dto=None):
    """Movements for one account. The running balance is always computed from
    inception so a date-filtered view stays truthful — rows before `dfrom`
    collapse into an opening balance, rows after `dto` are simply not shown."""
    sql = ("SELECT e.date, e.entity, e.narration, e.ref, e.doc, p.amount, p.memo "
           "FROM posting p JOIN entry e ON e.id = p.entry_id WHERE p.account = ?")
    args = [code]
    if entity:
        sql += " AND e.entity = ?"
        args.append(entity)
    run = Decimal("0")
    opening = Decimal("0")
    out = []
    for r in q(sql + " ORDER BY e.date, e.id", args):
        amt = Decimal(r["amount"])
        run += amt
        if dfrom and r["date"] < dfrom:
            opening = run
            continue
        if dto and r["date"] > dto:
            continue
        out.append((r["date"], r["entity"], r["narration"], r["ref"], r["doc"], amt, run))
    return out, opening


# ---------------------------------------------------------------- html ----

CSS = """
:root{
/* Corporate tokens — BRAND_IDENTITY.md */
--ink:#060A18;--deep:#0B1437;--panel:#101A3E;--panel2:#141F49;--line:rgba(229,231,235,.10);
--text:#F3F5FA;--muted:#8E97B3;
--accent:#2E88FF;--accent2:#00C9FF;               /* Aurora Blue -> Cyan Pulse */
--accent-soft:rgba(46,136,255,.12);--accent-line:rgba(46,136,255,.35);
--ok:#4ade80;--warn:#fbbf24;--radius:14px}
/* Club Ignition — the subsidiary keeps its own identity: black / white / signal red */
body.ci{--accent:#E01B24;--accent2:#FF6A70;
--accent-soft:rgba(224,27,36,.12);--accent-line:rgba(224,27,36,.35)}
*{box-sizing:border-box}
body{margin:0;font-family:"Space Grotesk",Inter,system-ui,-apple-system,"Segoe UI",sans-serif;background:
radial-gradient(circle at 5% 0%,rgba(46,136,255,.10),transparent 32%),
radial-gradient(circle at 95% 0%,rgba(0,201,255,.06),transparent 30%),
linear-gradient(180deg,var(--deep),var(--ink) 55%);
color:var(--text);line-height:1.55;font-size:15px;min-height:100vh}
body.ci{background:radial-gradient(circle at 5% 0%,rgba(224,27,36,.09),transparent 32%),
linear-gradient(180deg,#12141f,#08090d 55%)}
a{color:inherit;text-decoration:none}
.wrap{width:min(calc(100% - 32px),1200px);margin:auto}
header{border-bottom:1px solid var(--line);background:rgba(7,11,26,.82);position:sticky;top:0;z-index:20;backdrop-filter:blur(14px)}
body.ci header{background:rgba(10,10,11,.85)}
.hd{display:flex;align-items:center;justify-content:space-between;gap:20px;height:60px;flex-wrap:wrap}
.logo{font-weight:700;letter-spacing:-.02em;font-size:17px;display:flex;align-items:center;gap:9px}
.logo b{background:linear-gradient(90deg,var(--accent),var(--accent2));
-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700}
.logo .mark{width:26px;height:26px;display:block;object-fit:contain}
/* Company switcher — the two entities are separate; switching is a first-class act */
.switch{display:flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;
background:rgba(255,255,255,.03);flex-shrink:0}
.switch a{padding:7px 15px;font-size:12.5px;font-weight:600;color:var(--muted);
display:flex;align-items:center;gap:7px;border-right:1px solid var(--line);white-space:nowrap}
.switch a:last-child{border-right:0}
.switch a:hover{color:var(--text);background:rgba(255,255,255,.05)}
.switch a.on{background:linear-gradient(90deg,var(--accent),var(--accent2));color:#fff}
.switch img{width:15px;height:15px;object-fit:contain}
.ver{font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
padding:3px 8px;border-radius:999px;border:1px solid var(--accent-line);color:var(--accent);
background:var(--accent-soft)}
.stamp{color:var(--muted);font-size:12px;text-align:right}
.stamp b{color:var(--text);font-weight:600}
nav{display:flex;gap:4px;flex-wrap:wrap;padding:14px 0 0}
nav a{padding:7px 14px;border-radius:999px;font-size:13.5px;color:var(--muted);border:1px solid transparent}
nav a:hover{color:var(--text);background:rgba(255,255,255,.05)}
nav a.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:18px 0 6px}
.bar form{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
select,input{background:var(--panel2);color:var(--text);border:1px solid var(--line);
border-radius:9px;padding:7px 11px;font:inherit;font-size:13.5px}
button{background:var(--accent);color:#fff;border:0;border-radius:9px;padding:8px 18px;font:inherit;
font-size:13.5px;font-weight:600;cursor:pointer}
button:hover{filter:brightness(1.12)}
h1{font-size:24px;margin:26px 0 2px;letter-spacing:-.02em}
.sub{color:var(--muted);font-size:13.5px;margin:0 0 18px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:18px 0 26px}
.pipe{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0 4px}
.pipe.wide{grid-template-columns:repeat(auto-fill,minmax(118px,1fr))}
.pipe .col{border:1px solid var(--line);border-radius:8px;padding:8px;min-height:3.5em;background:rgba(0,0,0,.12)}
.pipe .col h3{margin:0 0 8px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.pipe .pcard{border:1px solid var(--line);border-radius:6px;padding:7px 8px;margin:0 0 7px;font-size:12.5px}
.pipe .pcard .k{font-family:ui-monospace,Consolas,monospace;font-size:12px}
.pipe .empty{color:var(--muted);font-size:12px;margin:0}
.card{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));
border:1px solid var(--line);border-radius:var(--radius);padding:17px}
.card .k{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.card .v{font-size:26px;font-weight:700;letter-spacing:-.03em;margin-top:5px;font-variant-numeric:tabular-nums}
.card .n{font-size:12px;color:var(--muted);margin-top:3px}
a.card{display:block;color:inherit}
.panel{border:1px solid var(--line);border-radius:var(--radius);overflow-x:auto;margin-bottom:22px;
background:rgba(255,255,255,.012)}
.panel h2{margin:0;padding:14px 18px;font-size:13px;text-transform:uppercase;letter-spacing:.12em;
background:rgba(255,255,255,.04);border-bottom:1px solid var(--line);font-weight:700}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 18px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);font-size:14px;vertical-align:top}
th{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:#c9c9d4;font-weight:700}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr:last-child td{border-bottom:none}
tbody tr:hover{background:rgba(255,255,255,.028)}
.code{color:var(--muted);font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
tr.total td{background:var(--accent-soft);font-weight:700;border-top:1px solid var(--accent-line)}
tr.sub td{background:rgba(255,255,255,.035);font-weight:600}
.neg{color:#fca5a5}
.pill{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.08);color:var(--muted)}
.pill.ok{background:rgba(74,222,128,.14);color:var(--ok)}
.pill.warn{background:rgba(251,191,36,.14);color:var(--warn)}
.pill.fail{background:rgba(224,27,36,.14);color:#FF8A90}
.matrix th,.matrix td{padding:6px 8px;font-size:11.5px;text-align:center;white-space:nowrap}
.matrix th:first-child,.matrix td:first-child{text-align:left}
.pill.e-STARQ{background:rgba(46,136,255,.16);color:#7FB8FF}
.pill.e-CI{background:rgba(224,27,36,.16);color:#FF8A90}
.note{margin:0 0 20px;border-left:3px solid var(--warn);background:rgba(251,191,36,.06);
padding:13px 17px;border-radius:0 10px 10px 0;font-size:13.5px;color:#cfcfd8}
/* Club Ignition ops entry — always Ignition Ink signal red, whatever the scope */
.cta{display:inline-flex;align-items:center;gap:9px;background:#E01B24;color:#fff;border-radius:10px;
padding:9px 17px;font-weight:600;font-size:13.5px;white-space:nowrap}
.cta:hover{filter:brightness(1.12)}
.cta img{width:18px;height:18px;object-fit:contain}
.opsbox{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
border:1px solid rgba(224,27,36,.35);background:rgba(224,27,36,.07);border-radius:var(--radius);
padding:15px 18px;margin:0 0 20px}
.opsbox .t{font-weight:700}
.opsbox .d{color:var(--muted);font-size:13px;margin-top:2px}
.err{border-left-color:#E01B24;background:rgba(224,27,36,.09)}
.err pre{white-space:pre-wrap;font-size:12.5px;margin:8px 0 0;color:#ffc9cb}
pre{white-space:pre-wrap;font-size:12.5px;margin:8px 0 0;color:var(--muted)}
textarea.draft-copy{width:100%;min-height:5em;font-family:ui-monospace,Consolas,monospace;
font-size:12px;background:rgba(0,0,0,.25);color:var(--text);border:1px solid var(--line);
border-radius:8px;padding:8px;margin:8px 0 0}
/* Decisions — the founder inbox */
.dec .dbody{padding:15px 18px}
.dec p.q{font-size:15px;font-weight:600;margin:0 0 8px;line-height:1.55}
.dec p.ctx{color:var(--muted);font-size:13px;margin:0 0 8px;line-height:1.65}
.dec .meta{font-size:11.5px;margin:0 0 12px;display:block}
.dec textarea{width:100%;background:var(--panel2);color:var(--text);border:1px solid var(--line);
border-radius:9px;padding:9px 11px;font:inherit;font-size:13.5px;resize:vertical;margin:2px 0 10px;display:block}
.dec .opt{background:rgba(255,255,255,.06);color:var(--text);border:1px solid var(--line);
font-weight:500;padding:6px 12px;margin:0 6px 8px 0;font-size:12.5px;border-radius:999px}
.dec .opt:hover{border-color:var(--accent-line);background:var(--accent-soft);filter:none}
.dec.done{opacity:.62}
.dec .reply{border-left:3px solid var(--ok);background:rgba(74,222,128,.06);
padding:10px 14px;border-radius:0 8px 8px 0;white-space:pre-wrap;margin:0 0 8px}
details.arch{margin:0 0 22px;color:var(--muted)}
details.arch summary{cursor:pointer;font-size:13px;padding:6px 0}
details.arch summary:hover{color:var(--text)}
footer{color:var(--muted);font-size:12.5px;padding:26px 0 44px;border-top:1px solid var(--line);margin-top:20px}
.who{display:flex;align-items:center;gap:8px;font-size:12.5px;flex-wrap:wrap}
.who a{color:var(--muted)}
.who a:hover{color:var(--text)}
@media(max-width:640px){th,td{padding:9px 12px;font-size:13px}.hd{height:auto;padding:12px 0}
.switch a{padding:7px 11px}.switch a img+.lbl{display:none}.stamp{display:none}}
/* Command home — calendar + receipts. No gradients, no emoji. */
.home-grid{display:grid;grid-template-columns:1fr minmax(260px,340px);gap:16px;align-items:start;margin:0 0 22px}
@media(max-width:900px){.home-grid{grid-template-columns:1fr}}
.cal{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:rgba(255,255,255,.02)}
.cal-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.04)}
.cal-hd a{color:var(--muted);font-weight:600;padding:6px 10px;border:1px solid var(--line);border-radius:8px;min-height:44px;display:inline-flex;align-items:center}
.cal-hd a:hover{color:var(--text);border-color:var(--accent-line)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.cal-dow,.cal-day{padding:7px 4px;text-align:center;font-size:12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-height:44px}
.cal-dow{color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;min-height:auto;padding:8px 4px}
.cal-day.out{color:var(--muted);opacity:.35}
.cal-day.today{box-shadow:inset 0 0 0 1px var(--accent-line)}
.cal-day.mark{background:var(--accent-soft)}
.cal-day.due{background:rgba(251,191,36,.12)}
.cal-day.cap{background:rgba(74,222,128,.10)}
.cal-day.on{box-shadow:inset 0 0 0 1px var(--accent)}
.cal-day a{display:block;color:inherit}
.cal-n{display:block;font-size:10px;font-weight:700;color:var(--accent);line-height:1.2}
.cal-n.due{color:var(--warn)}
.cal-n.cap{color:var(--ok)}
.alerts .alert{border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;margin:0 0 10px;background:rgba(255,255,255,.03)}
.alerts .alert.ASK,.alerts .alert.upcoming{border-left:3px solid var(--warn)}
.alerts .alert.LATE{border-left:3px solid #E01B24}
.alerts .alert.CAPTURED{border-left:3px solid var(--ok)}
.alerts .alert.POSTED{border-left:3px solid var(--ok);opacity:.8}
.alerts .alert .k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.alerts .alert form{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:end}
.alerts .alert form input,.alerts .alert form button{font-size:13px}
.rx-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;padding:14px 18px;align-items:end}
.rx-form label{display:flex;flex-direction:column;gap:4px}
.rx-form .wide{grid-column:1/-1}
.rx-form button{min-height:44px}
/* # AG-OWNED: chrome/home/hamburger — SSOT: HOME_NAV.md (also ops/_ag-ui-brief.txt).
   Replace wrapping tabs with slim top bar + RIGHT overlay drawer.
   Consume user.entities / A.may_view_entity / A.is_ci_only. Do not revert
   entity isolation. Ali sees Group+STARQ+CI. CI occupants never see Starq. */
"""


def page(title, body, active, entity, dfrom, dto, stamp, code=None) -> str:
    # AG-OWNED: chrome/home/hamburger — this header/nav/switcher is yours to
    # replace. Keep date filter on report pages. Wire existing routes only.
    # Entity isolation is Elder's: filter the switcher by user.entities.
    n_open = decisions_open_count()
    tabs = [
        ("", "Dashboard"),
        ("sales", "Sales"),
        ("expenses", "Expenses"),
        ("banking", "Banking"),
        ("contacts", "Contacts"),
        ("products", "Products"),
        ("projects", "Projects"),
        ("reports", "Reports"),
        ("accounting", "Accounting"),
        ("settings", "Settings"),
        ("transactions", "Ops"),
        ("notes", "Notes"),
        ("decisions", f"Decisions · {n_open}" if n_open else "Decisions"),
        ("ops", "Club Ignition Ops"),
    ]
    if entity == "CI":
        tabs.insert(6, ("pos", "POS"))
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    nav = "".join(
        f'<a class="{"on" if (k == "" and active in ("", "home")) or (k and active == k) else ""}" href="/{k}?{qs}">{html.escape(v)}</a>'
        for k, v in tabs)
    user = A.current_user()
    ci_only = A.is_ci_only(user)
    ci = entity == "CI" or ci_only
    logo = "ci-logo.png" if ci else "starq-logo.png"
    fav = "ci-favicon.png" if ci else "starq-favicon.png"
    home = "/" if user else "/login"
    if ci_only:
        stamp_who = "<b>Club Ignition Pvt Ltd</b> · Ignition Ink"
        logo_alt = "Club Ignition"
        logo_title = "Command home"
        footer_conf = (
            "CONFIDENTIAL — Club Ignition Pvt Ltd (C30222026). "
            "Club Ignition Ops by the foundation engine."
        )
    elif ci:
        stamp_who = "<b>Club Ignition Pvt Ltd</b> · a Starq Technologies company"
        logo_alt = "Club Ignition"
        logo_title = "Command home"
        footer_conf = "CONFIDENTIAL — Starq Technologies Pvt Ltd (C29552026). the foundation engine pre-alpha."
    else:
        stamp_who = "<b>Starq Technologies Pvt Ltd</b> · group finance"
        logo_alt = "Starq Technologies"
        logo_title = "Command home"
        footer_conf = "CONFIDENTIAL — Starq Technologies Pvt Ltd (C29552026). the foundation engine pre-alpha."
    if user:
        who = (f'<div class="who"><span>{html.escape(user.name)}</span>'
               f'<span class="ver">{html.escape(user.seat_label())}</span>'
               f'<a href="/logout">Sign out</a></div>')
    elif A.google_configured():
        who = '<div class="who"><a href="/login">Sign in</a></div>'
    else:
        who = ""
    keep = (f'<input type="hidden" name="account" value="{code}">'
            if active == "journal" and code else "")
    sw_tab = "" if active == "ops" else active
    sw_extra = f"&account={code}" if sw_tab == "journal" and code else ""
    allowed = set(user.entities or []) if user else set(A.ALL_ENTITIES)
    segs = []
    for slug, val, label, icon in (
        ("group", "", "Group", None),
        ("starq", "STARQ", "Starq Technologies", "starq-logo.png"),
        ("club-ignition", "CI", "Club Ignition", "ci-logo.png"),
    ):
        if slug not in allowed:
            continue
        on = " on" if (entity or "") == val else ""
        ic = f'<img src="/assets/{icon}" alt="">' if icon else ""
        segs.append(f'<a class="{on.strip()}" href="/{sw_tab}?entity={val}'
                    f'&from={dfrom or ""}&to={dto or ""}{sw_extra}">'
                    f'{ic}<span class="lbl">{label}</span></a>')
    switch = f'<div class="switch">{"".join(segs)}</div>' if segs else ""
    warn = ""
    if dfrom and dto and dfrom > dto:
        warn = (f'<div class="note err"><b>The From date ({dfrom}) is after the To date ({dto})</b>'
                ' — nothing can fall in that range. Swap them.</div>')
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/png" href="/assets/{fav}">
<title>{html.escape(title)} — the foundation engine</title><style>{CSS}</style></head>
<body class="{'ci' if ci else ''}">
<header><div class="wrap">
<div class="hd"><a class="logo" href="{html.escape(home, quote=True)}" title="{html.escape(logo_title, quote=True)}"><img class="mark" src="/assets/{logo}"
 alt="{html.escape(logo_alt)} logo">starq<b>Books</b> <span class="ver">pre-alpha</span></a>
{switch}
{who}
<div class="stamp">{stamp_who}<br>read-only · rebuilt {stamp}</div></div>
<nav>{nav}</nav>
<div class="bar"><form method="get" action="/{active}">{keep}
<input type="hidden" name="entity" value="{entity or ''}">
<label for="f">From</label><input id="f" type="date" name="from" value="{dfrom or ''}">
<label for="t">To</label><input id="t" type="date" name="to" value="{dto or ''}">
<button type="submit">Apply</button></form></div>
</div></header>
<main class="wrap">{warn}{body}</main>
<footer><div class="wrap">
{footer_conf}
Bound to 127.0.0.1. Club Ignition Ops requires Google Sign-In (seats, not fused accounts).
Do not expose this through a tunnel.<br>This viewer reads <code>books.db</code>, which is rebuilt from the per-entity
journals in <code>journals/</code> on every page load. <b>To record a transaction, edit a journal.</b>
</div></footer></body></html>"""


def page_forbidden() -> str:
    return """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/png" href="/assets/ci-favicon.png">
<title>Not available — the foundation engine</title></head>
<body style="font-family:system-ui,sans-serif;background:#08090d;color:#F3F5FA;padding:12vh 24px">
<div style="max-width:440px;margin:auto">
<p style="font-weight:700">Club Ignition Ops <span style="color:#8E97B3;font-weight:500">by the foundation engine</span></p>
<h1 style="font-size:22px">That company is not on your desk.</h1>
<p style="color:#8E97B3;line-height:1.6">This Google account may only open Club Ignition books.
The other companies in this product are not visible on this session.</p>
<p><a href="/?entity=CI" style="color:#FF6A70">Club Ignition books</a>
 · <a href="/ops" style="color:#FF6A70">Ops</a></p>
</div></body></html>"""


# Display-only short codes. The ledger token stays "STARQ" in the journals
# and books.py — that is data; this map is applied at render time only.
ENTITY_SHORT = {"STARQ": "ST", "CI": "CI"}


def epill(e):
    """Entity badge: CSS class keeps the ledger token, the visible text is short."""
    return f'<span class="pill e-{e}">{ENTITY_SHORT.get(e, e)}</span>'


def acct_link(code, entity, dfrom, dto):
    """Ledger drill-down link. Carries the whole filter state, not just entity."""
    return f"/journal?account={code}&entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"


def scope_label(entity):
    user = A.current_user()
    ci_only = A.is_ci_only(user)
    if entity == "STARQ":
        return "Starq Technologies Pvt Ltd — parent company"
    if entity == "CI":
        if ci_only:
            return "Club Ignition Pvt Ltd"
        return "Club Ignition Pvt Ltd — subsidiary of Starq Technologies"
    return "Starq Group"


# The garage trades as IGNITION INK (registered business name BN60352026 of
# Club Ignition Pvt Ltd). Ops-facing labels use the trading name; the books
# themselves stay under the legal entity — the shop sign doesn't own a ledger.
OPS_CTA = ('<a class="cta" href="/ops"><img src="/assets/ci-logo.png" alt="">'
           'Club Ignition Ops by the foundation engine</a>')


def ops_box(entity):
    """Entry point to the Ignition Ink ops area: prominent in the CI view, a
    quieter card on the group view, absent from the Starq parent's own books."""
    if A.is_ci_only(A.current_user()) and entity != "CI":
        return ""
    if entity == "CI":
        return ('<div class="opsbox"><div><div class="t">Club Ignition Ops by the foundation engine</div>'
                '<div class="d">Ignition Ink workflow log — jobs, money, purchases, exceptions. '
                'Does not post the ledger.</div></div>' + OPS_CTA + '</div>')
    if entity is None:
        return ('<div class="opsbox"><div><div class="t">Club Ignition Ops by the foundation engine</div>'
                '<div class="d">Garage event log for Ignition Ink. Journals stay append-only.</div></div>'
                + OPS_CTA + '</div>')
    return ""


def home_qs(entity, dfrom, dto, month=None, on=None):
    parts = [f"entity={entity or ''}", f"from={dfrom or ''}", f"to={dto or ''}"]
    if month:
        parts.append(f"month={month}")
    if on:
        parts.append(f"on={on}")
    return "&".join(parts)


def _shift_month(ym: str, delta: int) -> str:
    y, m = int(ym[:4]), int(ym[5:7]) + delta
    while m < 1:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    return f"{y:04d}-{m:02d}"


def parse_multipart(content_type: str, body: bytes) -> tuple[dict, dict]:
    m = re.search(r"boundary=([^;]+)", content_type or "", re.I)
    if not m:
        return {}, {}
    boundary = m.group(1).strip().strip('"').encode("ascii", "replace")
    fields: dict[str, str] = {}
    files: dict[str, tuple[str, bytes]] = {}
    for raw_part in body.split(b"--" + boundary):
        if not raw_part or raw_part in (b"--", b"--\r\n") or raw_part.startswith(b"--"):
            continue
        if raw_part.startswith(b"\r\n"):
            raw_part = raw_part[2:]
        if b"\r\n\r\n" not in raw_part:
            continue
        head, payload = raw_part.split(b"\r\n\r\n", 1)
        if payload.endswith(b"\r\n"):
            payload = payload[:-2]
        disp = ""
        for line in head.decode("utf-8", "replace").split("\r\n"):
            if line.lower().startswith("content-disposition:"):
                disp = line.split(":", 1)[1].strip()
        name_m = re.search(r'name="([^"]+)"', disp)
        fn_m = re.search(r'filename="([^"]*)"', disp)
        if not name_m:
            continue
        name = name_m.group(1)
        if fn_m and fn_m.group(1):
            files[name] = (fn_m.group(1), payload)
        else:
            fields[name] = payload.decode("utf-8", "replace")
    return fields, files


def _safe_receipt_name(name: str) -> str:
    base = os.path.basename(name.replace("\\", "/"))
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base)[:80]
    return base or "receipt.bin"


def save_receipt_artefact(filename: str, data: bytes, period: str, kind: str) -> str:
    os.makedirs(RECEIPTS_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    name = f"{period or 'none'}_{kind or 'other'}_{stamp}_{_safe_receipt_name(filename)}"
    dest = os.path.join(RECEIPTS_DIR, name)
    root = os.path.abspath(RECEIPTS_DIR)
    path = _safe_engine_path(os.path.abspath(dest), RECEIPTS_DIR)
    if path != root and not path.startswith(root + os.sep):
        raise ValueError("artefact path escaped receipts dir")
    with open(path, "wb") as f:
        f.write(data)
    return "ops/artefacts/receipts/" + name


def save_receipt_stub(fields: dict) -> str:
    os.makedirs(RECEIPTS_DIR, exist_ok=True)
    period = (fields.get("period") or "none").strip()
    kind = (fields.get("kind") or "other").strip()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    name = f"{period}_{kind}_{stamp}.txt"
    dest = _safe_engine_path(os.path.join(RECEIPTS_DIR, name), RECEIPTS_DIR)
    lines = [
        f"kind={kind}",
        f"item_id={(fields.get('item_id') or '').strip()}",
        f"vendor={(fields.get('vendor') or '').strip()}",
        f"amount={(fields.get('amount') or '').strip()}",
        f"bill_date={(fields.get('bill_date') or '').strip()}",
        f"period={period}",
        f"notes={(fields.get('notes') or '').strip()}",
        "stub=1",
        "journals=not_posted",
        "",
    ]
    with open(dest, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return "ops/artefacts/receipts/" + name


def _seat_label(seat: str) -> str:
    return (A.SEATS.get(seat) or {}).get("label") or seat


def _mini_capture_form(item, period, user, entity, dfrom, dto):
    if user is None:
        return ""
    kinds = A.receipt_kinds_for_seat(user.acting_as)
    kind = (item.get("kind") or "").strip().lower()
    if kind not in kinds:
        return ""
    csrf = html.escape(user.csrf or "")
    amt = item.get("amount_mvr")
    amt_v = "" if amt is None else html.escape(str(amt))
    today = date.today().isoformat()
    qs = home_qs(entity, dfrom, dto)
    return (
        f'<form method="post" action="/receipt?{qs}" enctype="multipart/form-data">'
        f'<input type="hidden" name="csrf" value="{csrf}">'
        f'<input type="hidden" name="type" value="RECEIPT">'
        f'<input type="hidden" name="item_id" value="{html.escape(item.get("id") or "")}">'
        f'<input type="hidden" name="entity" value="{html.escape(entity or "")}">'
        f'<input type="hidden" name="kind" value="{html.escape(kind)}">'
        f'<input type="hidden" name="period" value="{html.escape(period)}">'
        f'<input type="hidden" name="next" value="/?{qs}">'
        f'<label>Amount MVR <input name="amount" inputmode="decimal" value="{amt_v}" required></label>'
        f'<label>Bill date <input type="date" name="bill_date" value="{today}" required></label>'
        f'<label>Vendor <input name="vendor" maxlength="120"></label>'
        f'<label>File <input type="file" name="file"></label>'
        f'<button type="submit">Capture</button></form>'
    )


def h_home(acc, entity, user, dfrom, dto, month=None, on=None, notice=None):
    """Entity-aware command home. Does not post journals. Reuses report_bs/bal."""
    today = date.today()
    if on and not month:
        month = on[:7]
    if not month:
        month = f"{today.year:04d}-{today.month:02d}"
    year, mon = int(month[:4]), int(month[5:7])
    cat = CAT.load_catalog(entity)
    events = O.load_events()
    seat = user.acting_as if user else ""
    kinds_ok = set(A.receipt_kinds_for_seat(seat)) if user else set()
    groups, totals, result = report_bs(acc, entity, dto)
    bmap = bal(entity, entity is None, None, dto)
    cash = sum((v for c, v in bmap.items() if c in CASH_CODES), Decimal("0"))
    gst = bmap.get("1220", Decimal("0"))
    deposit = bmap.get("1215", Decimal("0"))
    n_open = decisions_open_count()
    try:
        stats = O.stats()
    except Exception:
        stats = {"jobs": 0, "open": 0, "purchases": 0}
    need_n = sum(
        1 for e in O.events_for(etype="PURCHASE")
        if (e.get("fields") or {}).get("scm_step") == "need"
    )

    sql_counts = "SELECT e.date d, COUNT(*) c FROM entry e"
    args: tuple = ()
    if entity:
        sql_counts += " WHERE e.entity=?"
        args = (entity,)
    sql_counts += " GROUP BY e.date"
    journal_days = {r["d"]: r["c"] for r in q(sql_counts, args)}
    cap_days = CAT.capture_dates(events)
    due_days: dict[str, list] = {}
    for row in cat["calendar"]:
        nd = row.get("next_due") or ""
        if nd[:7] == month:
            due_days.setdefault(nd, []).append(row)

    qs = home_qs(entity, dfrom, dto, month)
    prev_m = _shift_month(month, -1)
    next_m = _shift_month(month, 1)
    prev_href = f"/?{home_qs(entity, dfrom, dto, prev_m)}"
    next_href = f"/?{home_qs(entity, dfrom, dto, next_m)}"
    title_m = date(year, mon, 1).strftime("%B %Y")

    cells = []
    for dow in ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"):
        cells.append(f'<div class="cal-dow">{dow}</div>')
    for day in pycal.Calendar(0).itermonthdays(year, mon):
        if day == 0:
            cells.append('<div class="cal-day out"></div>')
            continue
        iso = f"{year:04d}-{mon:02d}-{day:02d}"
        cls = ["cal-day"]
        if iso == today.isoformat():
            cls.append("today")
        if iso == on:
            cls.append("on")
        jc = journal_days.get(iso, 0)
        if jc:
            cls.append("mark")
        dc = due_days.get(iso) or []
        if dc:
            cls.append("due")
        cc = cap_days.get(iso, 0)
        if cc:
            cls.append("cap")
        marks = ""
        if jc:
            marks += f'<span class="cal-n">{jc}</span>'
        if dc:
            marks += f'<span class="cal-n due">{len(dc)}</span>'
        if cc:
            marks += f'<span class="cal-n cap">{cc}</span>'
        href = f"/?{home_qs(entity, dfrom, dto, month, iso)}"
        cells.append(
            f'<div class="{" ".join(cls)}"><a href="{href}">{day}{marks}</a></div>'
        )
    cal_html = (
        f'<div class="cal"><div class="cal-hd">'
        f'<a href="{prev_href}">Prev</a><b>{html.escape(title_m)}</b>'
        f'<a href="{next_href}">Next</a></div>'
        f'<div class="cal-grid">{"".join(cells)}</div></div>'
    )

    alerts = []
    if notice == "captured":
        alerts.append('<div class="alert CAPTURED"><div class="k">Receipt</div>'
                      "Captured. Waiting journal append (DEC-008). Ops did not post books.</div>")
    elif notice == "denied":
        alerts.append('<div class="alert LATE"><div class="k">Receipt</div>'
                      "Capture refused. Seat cannot log that kind, or the form was incomplete.</div>")

    if cash == 0:
        alerts.append(
            '<div class="alert"><div class="k">Cash</div>'
            f'<div class="v {signed_class(cash)}">{money(cash)}</div>'
            '<div class="n">MVR · no bank account open yet · 1110 / 1120 / 1121 / 1125</div></div>'
        )
    gst_item = cat["items_by_id"].get("gst-1220")
    if gst_item:
        alerts.append(
            '<div class="alert"><div class="k">GST 1220 · fact</div>'
            f'<div class="v {signed_class(gst)}">{money(gst)}</div>'
            '<div class="n">Not GST-registered. No 8% on invoices. Not a filing deadline.</div></div>'
        )
    stock = cat["items_by_id"].get("inv-dec007")
    if stock:
        note = html.escape(stock.get("note") or "SKU mins not on disk (DEC-007). Held-stock policy OPEN.")
        alerts.append(
            f'<div class="alert"><div class="k">Stock · no qty</div>'
            f'<span class="pill policy">policy</span> {note}</div>'
        )
    alerts.append(
        f'<div class="alert"><div class="k">Ops</div>'
        f'{stats.get("open", 0)} open jobs · {need_n} PURCHASE need'
        f' · {stats.get("jobs", 0)} jobs total. Empty is honest.</div>'
    )
    alerts.append(
        f'<div class="alert"><div class="k">Decisions</div>'
        f'{n_open} open. Zero is honest.</div>'
    )
    bar_bits = [
        html.escape(it.get("title") or "")
        for it in cat["items"]
        if it.get("id") in ("st-bar-6201", "st-bn-dynamics", "ci-bn-ignition-ink", "st-bn-hoadhaa")
    ]
    if bar_bits:
        alerts.append(
            '<div class="alert"><div class="k">BAR · static</div>'
            + " · ".join(bar_bits)
            + '<div class="n">Reference, not an expiry.</div></div>'
        )

    ask_html = []
    for it in cat["items"]:
        st = CAT.period_status(it, today, events)
        if not st:
            continue
        kind = (it.get("kind") or "").strip().lower()
        if kind not in kinds_ok and st["status"] not in ("CAPTURED", "POSTED"):
            # Nashid: no rent/utility ASK copy with a form; still skip the strip.
            continue
        if kind not in kinds_ok:
            continue
        cert = html.escape((st.get("certainty") or "").upper())
        form = _mini_capture_form(it, st["period"], user, entity, dfrom, dto)
        dep = ""
        if it.get("id") == "ci-kiev-rent":
            dep = f'<div class="n">Deposit 1215 · {money(deposit)} MVR (posted fact)</div>'
        ask_html.append(
            f'<div class="alert {html.escape(st["status"])}">'
            f'<div class="k">{html.escape(st["status"])} · {cert}</div>'
            f'{html.escape(st["copy"])}{dep}{form}</div>'
        )

    month_rx = CAT.receipts_in_month(events, year, mon)
    if not kinds_ok:
        month_rx = [
            e for e in month_rx
            if ((e.get("fields") or {}).get("kind") or "").strip().lower() in CAT.GARAGE_RECEIPT_KINDS
        ]
    elif kinds_ok != set(CAT.ALL_RECEIPT_KINDS):
        month_rx = [
            e for e in month_rx
            if ((e.get("fields") or {}).get("kind") or "").strip().lower() in kinds_ok
        ]
    rx_rows = []
    for e in month_rx:
        f = e.get("fields") or {}
        rx_rows.append(
            f'<tr><td class="code">{html.escape((f.get("bill_date") or e.get("ts") or "")[:10])}</td>'
            f'<td>{html.escape(f.get("kind") or "")}</td>'
            f'<td>{html.escape(f.get("vendor") or f.get("item_id") or "")}</td>'
            f'<td class="n">{html.escape(str(f.get("amount") or ""))}</td>'
            f'<td class="code">{html.escape(f.get("artefact_path") or "")}</td></tr>'
        )
    rx_body = "".join(rx_rows) or (
        '<tr><td colspan="5" style="color:var(--muted)">No receipts captured this month.</td></tr>'
    )

    add_form = ""
    if kinds_ok and user:
        opts = "".join(
            f'<option value="{html.escape(k)}">{html.escape(k)}</option>' for k in sorted(kinds_ok)
        )
        csrf = html.escape(user.csrf or "")
        today_s = today.isoformat()
        period_s = f"{today.year:04d}-{today.month:02d}"
        add_form = (
            '<div class="panel"><h2>Add receipt</h2>'
            f'<form class="rx-form" method="post" action="/receipt?{qs}" enctype="multipart/form-data">'
            f'<input type="hidden" name="csrf" value="{csrf}">'
            f'<input type="hidden" name="type" value="RECEIPT">'
            f'<input type="hidden" name="entity" value="{html.escape(entity or "")}">'
            f'<input type="hidden" name="next" value="/?{qs}">'
            f'<label>Kind <select name="kind" required>{opts}</select></label>'
            f'<label>Vendor <input name="vendor" maxlength="120" placeholder="as on the paper"></label>'
            f'<label>Amount MVR <input name="amount" inputmode="decimal" required></label>'
            f'<label>Bill date <input type="date" name="bill_date" value="{today_s}" required></label>'
            f'<label>Period <input name="period" value="{period_s}" pattern="\\d{{4}}-\\d{{2}}"></label>'
            f'<label>Item id <input name="item_id" maxlength="80" placeholder="optional catalog id"></label>'
            f'<label class="wide">Notes <input name="notes" maxlength="400"></label>'
            f'<label class="wide">File <input type="file" name="file"></label>'
            '<button type="submit">Capture receipt</button>'
            '<p class="n" style="grid-column:1/-1;color:var(--muted);margin:0">'
            "Does not post journals. File lands on D: under ops/artefacts/receipts/. "
            "A text stub is saved if no file is attached.</p>"
            "</form></div>"
        )

    day_panel = ""
    if on:
        where = ["e.date=?"]
        args_d: list = [on]
        if entity:
            where.append("e.entity=?")
            args_d.append(entity)
        rows = q(
            "SELECT e.date,e.entity,e.narration,e.ref,e.doc,"
            "(SELECT SUM(CAST(p.amount AS REAL)) FROM posting p WHERE p.entry_id=e.id AND CAST(p.amount AS REAL)>0) v "
            "FROM entry e WHERE " + " AND ".join(where) + " ORDER BY e.id",
            tuple(args_d),
        )
        jbody = "".join(
            f'<tr><td class="code">{r["date"]}</td><td>{epill(r["entity"])}</td>'
            f'<td>{html.escape(r["narration"])}'
            + (f'<br><span class="code">{html.escape(r["ref"])}</span>' if r["ref"] else "")
            + f'</td><td class="n">{r["v"]:,.2f}</td></tr>' for r in rows
        ) or '<tr><td colspan="4" style="color:var(--muted)">No journal rows this day.</td></tr>'
        due_bits = "".join(
            f'<li>{html.escape(r.get("title") or "")} · {html.escape((r.get("certainty") or "").upper())}'
            f' · next {html.escape(r.get("next_due") or "")}</li>'
            for r in due_days.get(on, [])
        )
        cap_bits = []
        for e in CAT.receipt_events(events):
            f = e.get("fields") or {}
            if (f.get("bill_date") or "")[:10] == on:
                cap_bits.append(
                    f'<li>{html.escape(f.get("kind") or "")} · {html.escape(f.get("vendor") or "")} · '
                    f'{html.escape(str(f.get("amount") or ""))}</li>'
                )
        day_panel = (
            f'<div class="panel"><h2>{html.escape(on)}</h2>'
            f'<table><thead><tr><th>Date</th><th>Entity</th><th>Narration</th>'
            f'<th class="n">Value</th></tr></thead><tbody>{jbody}</tbody></table>'
            + (f'<div style="padding:12px 18px"><b>Due items</b><ul>{due_bits}</ul></div>' if due_bits else "")
            + (f'<div style="padding:12px 18px"><b>Captured</b><ul>{"".join(cap_bits)}</ul></div>' if cap_bits else "")
            + "</div>"
        )

    recent = q(
        "SELECT e.date,e.entity,e.narration,e.ref,e.doc,"
        "(SELECT SUM(CAST(p.amount AS REAL)) FROM posting p WHERE p.entry_id=e.id AND CAST(p.amount AS REAL)>0) v "
        "FROM entry e" + ("" if not entity else " WHERE e.entity=?") +
        " ORDER BY e.date DESC, e.id DESC LIMIT 8",
        () if not entity else (entity,),
    )
    recent_body = "".join(
        f'<tr><td class="code">{r["date"]}</td><td>{epill(r["entity"])}</td>'
        f'<td>{html.escape(r["narration"])}'
        + (f'<br><span class="code">{html.escape(r["ref"])}</span>' if r["ref"] else "")
        + f'</td><td class="n">{r["v"]:,.2f}</td></tr>' for r in recent
    ) or '<tr><td colspan="4" style="color:var(--muted)">No entries.</td></tr>'

    hook = []
    for row in cat["accountability"]:
        if row.get("event") not in ("RECEIPT", "journal.append"):
            continue
        iid = row.get("item_id")
        if iid and iid not in cat["items_by_id"]:
            continue
        hook.append(
            f'<tr><td class="code">{html.escape(row.get("event") or "")}</td>'
            f'<td>{html.escape(row.get("item_id") or row.get("category_id") or "")}</td>'
            f'<td>{html.escape(_seat_label(row.get("seat_must_act") or ""))}</td>'
            f'<td class="code">{html.escape(row.get("debit_hint") or "—")} / '
            f'{html.escape(row.get("credit_hint") or "—")}</td>'
            f'<td>{html.escape(row.get("notes") or "")}</td></tr>'
        )

    out = [
        f'<h1>Command home</h1>',
        f'<p class="sub">{html.escape(scope_label(entity))} · receipts captured here are not books. '
        f'Ali journals daily (DEC-008).</p>',
        ops_box(entity),
    ]
    if entity is None:
        out.append(_group_consolidation_strip())
    out.extend([
        _engine_strip(entity),
        _draft_gates_panel(entity),
        _approvals_inbox_panel(entity, user),
        f'<div class="cards">'
        f'<div class="card"><div class="k">Cash</div><div class="v {signed_class(cash)}">{money(cash)}</div>'
        f'<div class="n">MVR · 1110 / 1120 / 1121 / 1125</div></div>'
        f'<div class="card"><div class="k">Result to date</div>'
        f'<div class="v {signed_class(result)}">{money(result)}</div>'
        f'<div class="n">{"profit" if result >= 0 else "loss"} · MVR</div></div>'
        f'</div>',
        f'<div class="home-grid">{cal_html}<div class="alerts">{"".join(ask_html)}{"".join(alerts)}</div></div>',
        day_panel,
        '<div class="panel"><h2>Receipts this month</h2><table><thead><tr>'
        '<th>Date</th><th>Kind</th><th>Vendor / item</th><th class="n">Amount</th><th>Artefact</th>'
        f'</tr></thead><tbody>{rx_body}</tbody></table></div>',
        add_form,
        '<div class="panel"><h2>Recent entries</h2><table><thead><tr><th>Date</th><th>Entity</th>'
        f'<th>Narration</th><th class="n">Value</th></tr></thead><tbody>{recent_body}</tbody></table></div>',
        '<div class="panel"><h2>Accountability</h2><table><thead><tr>'
        '<th>Event</th><th>Item</th><th>Seat</th><th>Dr / Cr hint</th><th>Notes</th>'
        f'</tr></thead><tbody>{"".join(hook) or "<tr><td colspan=5 style=color:var(--muted)>none</td></tr>"}'
        "</tbody></table></div>",
    ])
    return "".join(out)


def h_overview(acc, entity, dfrom, dto):
    groups, totals, result = report_bs(acc, entity, dto)
    cash = sum((v for c, v in bal(entity, entity is None, None, dto).items()
                if c in ("1110", "1120", "1121", "1125")), Decimal("0"))
    n = q("SELECT COUNT(*) c FROM entry" + ("" if not entity else " WHERE entity = ?"),
          () if not entity else (entity,))[0]["c"]
    last = q("SELECT MAX(date) d FROM entry" + ("" if not entity else " WHERE entity = ?"),
             () if not entity else (entity,))[0]["d"] or "—"
    sub = 'Overview' + (f' · to {dto}' if dto else '')
    if not entity:
        # The long consolidation explanation lives on the Notes tab now.
        sub += (f' · <a href="/notes?entity=&from={dfrom or ""}&to={dto or ""}"'
                ' style="border-bottom:1px dotted var(--muted)">management view'
                ' · intercompany eliminated &#9432;</a>')
    out = [f'<h1>{html.escape(scope_label(entity))}</h1>',
           f'<p class="sub">{sub}</p>']
    out.append(ops_box(entity))
    out.append(f"""<div class="cards">
<div class="card"><div class="k">Cash</div><div class="v {signed_class(cash)}">{money(cash)}</div>
<div class="n">MVR · no bank account open yet</div></div>
<div class="card"><div class="k">Total assets</div><div class="v {signed_class(totals['ASSET'])}">{money(totals['ASSET'])}</div><div class="n">MVR</div></div>
<div class="card"><div class="k">Total liabilities</div><div class="v {signed_class(totals['LIABILITY'])}">{money(totals['LIABILITY'])}</div><div class="n">MVR</div></div>
<div class="card"><div class="k">Result to date</div><div class="v {signed_class(result)}">{money(result)}</div>
<div class="n">{'profit' if result >= 0 else 'loss'} · MVR</div></div>
<div class="card"><div class="k">Entries posted</div><div class="v">{n}</div><div class="n">last {last}</div></div>
</div>""")
    rows = q("SELECT e.date,e.entity,e.narration,e.ref,e.doc,"
             "(SELECT SUM(CAST(p.amount AS REAL)) FROM posting p WHERE p.entry_id=e.id AND CAST(p.amount AS REAL)>0) v "
             "FROM entry e" + ("" if not entity else " WHERE e.entity=?") +
             " ORDER BY e.date DESC, e.id DESC LIMIT 15", () if not entity else (entity,))
    body = "".join(
        f'<tr><td class="code">{r["date"]}</td><td>{epill(r["entity"])}</td>'
        f'<td>{html.escape(r["narration"])}'
        + (f'<br><span class="code">{html.escape(r["ref"])}</span>' if r["ref"] else "")
        + f'</td><td class="n">{r["v"]:,.2f}</td></tr>' for r in rows)
    out.append('<div class="panel"><h2>Recent entries</h2><table><thead><tr><th>Date</th><th>Entity</th>'
               f'<th>Narration</th><th class="n">Value</th></tr></thead><tbody>{body}</tbody></table></div>')
    return "".join(out)


def _ops_events():
    path = getattr(O, "EVENTS_FILE", os.path.join(HERE, "ops", "events.jsonl"))
    if not os.path.isfile(path):
        return []
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def _event_rows(types, limit=40, entity=None):
    want = set(types)
    occ = entity if entity in ("STARQ", "CI") else None
    out = []
    for ev in reversed(_ops_events()):
        if ev.get("type") not in want:
            continue
        if occ and JO.occupancy_of(ev) != occ:
            continue
        out.append(ev)
        if len(out) >= limit:
            break
    return out


def _evt_table(events, cols):
    if not events:
        return '<p class="sub">None on disk yet. Capture is ops; GL is still the journal (DEC-008).</p>'
    th = "".join(f"<th>{html.escape(h)}</th>" for h, _k in cols)
    body = []
    for ev in events:
        tds = []
        for _h, key in cols:
            val = ev.get(key)
            extra = ev.get("payload") if isinstance(ev.get("payload"), dict) else None
            if extra is None and isinstance(ev.get("fields"), dict):
                extra = ev.get("fields")
            if val is None and extra:
                val = extra.get(key)
                if val is None and key == "supplier":
                    val = extra.get("vendor")
            if val is None:
                val = "—"
            tds.append(f"<td>{html.escape(str(val))}</td>")
        body.append(f"<tr>{''.join(tds)}</tr>")
    return (f'<div class="panel"><table><thead><tr>{th}</tr></thead>'
            f'<tbody>{"".join(body)}</tbody></table></div>')


def _engine_strip(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    cards = []
    for n in JO.engine_counts(occ):
        till_note = "0 until a sell price" if n["pos_till"] == 0 else "priced sale drafts"
        cage = "no cage"
        if n["occupancy"] == "CI":
            inv = M.inventory()
            line = next(
                (ln for ln in (inv.get("lines") or []) if ln.get("sku") == "INK-CAGE"),
                {},
            )
            st = line.get("qty_status") or "not_counted"
            qty = line.get("qty")
            if st == "counted" and qty is not None:
                cage = f"INK-CAGE counted {qty}"
            else:
                cage = f"INK-CAGE {st}"
                if qty is None:
                    cage += " · qty empty"
        else:
            cage = "no cage on Starq"
        label = html.escape(n["label"])
        cards.append(
            '<div class="card">'
            f'<div class="k">Engine · {label}</div>'
            f'<div class="v">{n["drafts"]}</div>'
            f'<div class="n">drafts · blocked {n["blocked"]} · no GL {n["no_gl"]}</div>'
            f'<div class="n">Receipts {n["receipts"]} · Purchases {n["purchases"]} · Banking {n["banking"]}</div>'
            f'<div class="n">POS consume {n["pos_consume"]} · POS till {n["pos_till"]} ({html.escape(till_note)})</div>'
            f'<div class="n">Docs unissued {n["docs_unissued"]} · issued {n["docs_issued"]}</div>'
            f'<div class="n">Payroll blocked {n["payroll_blocked"]} · {html.escape(cage)}</div>'
            "</div>"
        )
    return f'<div class="cards engine-strip">{"".join(cards)}</div>'


def _draft_gates_panel(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Next draft</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Group is not a company. "
            "No fake progress %.</p></div>"
        )
    report = JO.draft_gates(occ)
    scope = (
        "Starq occupancy — Starq gates only. Club Ignition till/cage stay on CI."
        if occ == "STARQ"
        else "Club Ignition occupancy — till/cage/issue gates. Not a Starq shop POS."
    )
    body = []
    for it in report.get("items") or []:
        flag = "blocking" if it.get("blocking") else "open"
        body.append(
            f'<tr><td class="code">{html.escape(it.get("label") or it.get("code") or "")}</td>'
            f'<td>{html.escape(flag)}</td>'
            f'<td>{html.escape(it.get("note") or "")}</td></tr>'
        )
    inner = "".join(body) or (
        '<tr><td colspan="3" style="color:var(--muted)">No occupancy gates listed.</td></tr>'
    )
    return (
        '<div class="panel"><h2>Next draft</h2>'
        f"<p>{html.escape(scope)} Honest blockers, not a progress bar. "
        f"{html.escape(report.get('reason') or '')} Tax 0. Never 8% GST.</p>"
        '<table><thead><tr><th>Gate</th><th>State</th><th>Why</th></tr></thead>'
        f'<tbody>{inner}</tbody></table></div>'
    )


def _scm_approve_form(entity, event_id, current_step, user, *, compact=False):
    if not user or not user.acting_as:
        return ""
    target = JO.scm_approve_target(current_step)
    if not target or target not in JO.SCM_APPROVE_STEPS:
        return ""
    if not A.seat_may_scm_step(user.acting_as, target):
        alt = "match" if current_step == "award" and A.seat_may_scm_step(user.acting_as, "match") else ""
        if not alt:
            return ""
        target = alt
    form, err = JO.prepare_scm_approve(
        event_id=event_id,
        scm_step=target,
        occupancy=entity,
        seat=user.acting_as,
    )
    if err or not form:
        return ""
    csrf = html.escape(A.csrf_token(user), quote=True)
    eid = html.escape(str(event_id), quote=True)
    ent = html.escape(str(entity or ""), quote=True)
    step = html.escape(target, quote=True)
    btn = f"Approve {target}"
    if compact:
        return (
            f'<form method="post" action="/scm/approve?entity={ent}" style="display:inline;margin:0">'
            f'<input type="hidden" name="csrf" value="{csrf}">'
            f'<input type="hidden" name="entity" value="{ent}">'
            f'<input type="hidden" name="event_id" value="{eid}">'
            f'<input type="hidden" name="scm_step" value="{step}">'
            f'<button type="submit">{html.escape(btn)}</button></form>'
        )
    return (
        f'<form method="post" action="/scm/approve?entity={ent}">'
        f'<input type="hidden" name="csrf" value="{csrf}">'
        f'<input type="hidden" name="entity" value="{ent}">'
        f'<input type="hidden" name="event_id" value="{eid}">'
        f'<input type="hidden" name="scm_step" value="{step}">'
        f'<button type="submit">{html.escape(btn)}</button></form>'
    )


def _approvals_inbox_panel(entity, user=None):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Approvals inbox</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Group is not a company. "
            "No invented approvals.</p></div>"
        )
    report = JO.sod_approvals_inbox(occ)
    scope = (
        "Starq occupancy — Starq SoD queue only."
        if occ == "STARQ"
        else "Club Ignition occupancy — cage need/quote/award/receive/match/pay SoD."
    )
    qs = f"entity={entity or ''}"
    if report.get("empty"):
        return (
            '<div class="panel"><h2>Approvals inbox</h2>'
            f"<p>{html.escape(scope)} {html.escape(report.get('reason') or '')}</p></div>"
        )
    body = []
    for it in report.get("items") or []:
        link_tab = it.get("link") or "expenses"
        href = f"/{link_tab}?{qs}"
        step = it.get("step") or ""
        approve = ""
        if link_tab == "expenses" and step in ("need", "quote", "award", "receive", "match"):
            approve = _scm_approve_form(entity, it.get("event_id"), step, user, compact=True)
        body.append(
            f'<tr><td class="code">{html.escape(it.get("date") or "")}</td>'
            f'<td>{html.escape(step)}</td>'
            f'<td>{html.escape(it.get("type") or "")}</td>'
            f'<td class="code">{html.escape(it.get("event_id") or "")}</td>'
            f'<td>{html.escape(it.get("summary") or "")}</td>'
            f'<td class="n">{html.escape(it.get("amount") or "—")}</td>'
            f'<td>{html.escape(it.get("seat_hint") or "")}</td>'
            f'<td>{approve or "—"}</td>'
            f'<td><a href="{href}">{html.escape(link_tab.title())}</a></td></tr>'
        )
    return (
        '<div class="panel"><h2>Approvals inbox</h2>'
        f"<p>{html.escape(scope)} Authorised seat approves one pending scm step when the event "
        "is on disk. Ops event only — journals follow outbox (DEC-008).</p>"
        '<table><thead><tr><th>Date</th><th>Step</th><th>Type</th><th>Event</th>'
        "<th>Summary</th><th class=\"n\">Amount</th><th>SoD seat</th><th>Approve</th><th>Link</th>"
        f"</tr></thead><tbody>{''.join(body)}</tbody></table></div>"
    )


def _group_consolidation_strip():
    hint = JO.intercompany_mirror_hint()
    if hint.get("empty") and hint.get("mirror_ok"):
        return (
            '<div class="panel"><h2>Group · intercompany</h2>'
            f"<p>{html.escape(hint.get('reason') or '')} "
            "Management view drops 1290/2490 — not a consolidation journal.</p></div>"
        )
    rows = []
    for h in hint.get("hints") or []:
        accts = ", ".join(h.get("accounts") or [])
        rows.append(
            f'<tr><td>{html.escape(h.get("occupancy") or "")}</td>'
            f'<td class="code">{html.escape(h.get("event_id") or "")}</td>'
            f'<td class="code">{html.escape(accts)}</td>'
            f'<td>{html.escape(h.get("narration") or "")}</td>'
            f'<td class="code">{html.escape(h.get("copy_into") or "")}</td></tr>'
        )
    mirror = "mirrors OK" if hint.get("mirror_ok") else "mirror check failed"
    inner = "".join(rows) or (
        '<tr><td colspan="5" style="color:var(--muted)">No intercompany draft legs on disk.</td></tr>'
    )
    return (
        '<div class="panel"><h2>Group · intercompany mirror hint</h2>'
        f"<p>{html.escape(hint.get('reason') or '')} Posted journals: {html.escape(mirror)}. "
        "Read-only — will not write a consolidation journal.</p>"
        '<table><thead><tr><th>Occupancy</th><th>Event</th><th>IC accounts</th>'
        "<th>Summary</th><th>Copy into</th></tr></thead>"
        f"<tbody>{inner}</tbody></table></div>"
    )


def _inventory_valuation_panel(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Inventory valuation</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Counted SKU with unit cost only.</p></div>"
        )
    report = JO.inventory_valuation(occ)
    if report.get("empty"):
        return (
            '<div class="panel"><h2>Inventory valuation</h2>'
            f"<p>{html.escape(report.get('reason') or 'Empty honest.')}</p></div>"
        )
    rows = []
    for r in report.get("rows") or []:
        ext = r.get("extension")
        ext_s = f"{ext:,.2f}" if ext is not None else "—"
        qty_s = "—" if r.get("qty") in (None, "") else html.escape(str(r.get("qty")))
        rows.append(
            f'<tr><td class="code">{html.escape(r.get("sku") or "")}</td>'
            f'<td>{html.escape(r.get("product_id") or "")}</td>'
            f'<td class="n">{qty_s}</td>'
            f'<td class="n">{r.get("unit_cost"):,.2f}</td>'
            f'<td class="n">{ext_s}</td></tr>'
        )
    total = report.get("total")
    foot = (
        f'<tr><td colspan="4"><b>Total</b></td><td class="n"><b>{total:,.2f}</b></td></tr>'
        if total is not None else ""
    )
    note = f'<p class="sub">{html.escape(report.get("reason") or "")}</p>' if report.get("reason") else ""
    return (
        '<div class="panel"><h2>Inventory valuation</h2>'
        "<p>Counted SKUs with unit cost on this occupancy. qty × unit cost only when both on disk.</p>"
        + note
        + '<table><thead><tr><th>SKU</th><th>Product</th><th class="n">Qty</th>'
        '<th class="n">Unit cost</th><th class="n">Extension</th></tr></thead>'
        f'<tbody>{"".join(rows)}{foot}</tbody></table></div>'
    )


def _sales_summary_panel(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Sales summary</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Issued INV + captures on disk only.</p></div>"
        )
    report = JO.sales_summary(occ)
    if report.get("empty"):
        return (
            '<div class="panel"><h2>Sales summary</h2>'
            f"<p>{html.escape(report.get('reason') or 'Empty honest.')}</p></div>"
        )
    issued_rows = []
    for r in report.get("issued") or []:
        issued_rows.append(
            f'<tr><td class="code">{html.escape(r.get("number") or "")}</td>'
            f'<td class="code">{html.escape(r.get("event_id") or "")}</td>'
            f'<td>{html.escape(r.get("contact_name") or "")}</td>'
            f'<td class="n">{r.get("amount"):,.2f}</td></tr>'
        )
    cap_rows = []
    for r in report.get("captures") or []:
        cap_rows.append(
            f'<tr><td class="code">{html.escape(r.get("date") or "")}</td>'
            f'<td>{html.escape(r.get("type") or "")}</td>'
            f'<td class="code">{html.escape(r.get("event_id") or "")}</td>'
            f'<td>{html.escape(r.get("customer") or r.get("job_no") or "")}</td>'
            f'<td class="n">{r.get("amount"):,.2f}</td></tr>'
        )
    parts = ['<div class="panel"><h2>Sales summary</h2>']
    if issued_rows:
        tot = report.get("total_issued")
        parts.append("<h3>Issued INV</h3>")
        parts.append(
            '<table><thead><tr><th>Number</th><th>Event</th><th>Customer</th>'
            f'<th class="n">Amount</th></tr></thead><tbody>{"".join(issued_rows)}'
            + (f'<tr><td colspan="3"><b>Subtotal</b></td><td class="n"><b>{tot:,.2f}</b></td></tr>' if tot is not None else "")
            + "</tbody></table>"
        )
    if cap_rows:
        tot = report.get("total_captures")
        parts.append("<h3>Capture events (unissued or pre-issue)</h3>")
        parts.append(
            '<table><thead><tr><th>Date</th><th>Type</th><th>Event</th><th>Party / job</th>'
            f'<th class="n">Amount</th></tr></thead><tbody>{"".join(cap_rows)}'
            + (f'<tr><td colspan="4"><b>Subtotal</b></td><td class="n"><b>{tot:,.2f}</b></td></tr>' if tot is not None else "")
            + "</tbody></table>"
        )
    parts.append(
        "<p class=\"sub\">No combined total — issued and captures are separate buckets on disk.</p></div>"
    )
    return "".join(parts)


def _payroll_summary_panel(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Payroll summary</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Employees with rate_mvr only.</p></div>"
        )
    report = JO.payroll_summary(occ)
    if report.get("empty"):
        return (
            '<div class="panel"><h2>Payroll summary</h2>'
            f"<p>{html.escape(report.get('reason') or 'Empty honest.')}</p></div>"
        )
    rows = []
    for r in report.get("rows") or []:
        rows.append(
            f'<tr><td class="code">{html.escape(r.get("id") or "")}</td>'
            f'<td>{html.escape(r.get("name") or "")}</td>'
            f'<td>{html.escape(r.get("seat") or "")}</td>'
            f'<td class="n">{r.get("rate_mvr"):,.2f}</td></tr>'
        )
    tot = report.get("total_rates")
    return (
        '<div class="panel"><h2>Payroll summary</h2>'
        f"<p>{html.escape(report.get('reason') or '')}</p>"
        '<table><thead><tr><th>Id</th><th>Name</th><th>Seat</th><th class="n">rate_mvr</th>'
        f"</tr></thead><tbody>{''.join(rows)}"
        f'<tr><td colspan="3"><b>Sum of rates</b></td><td class="n"><b>{tot:,.2f}</b></td></tr>'
        "</tbody></table></div>"
    )


def _contact_select(entity):
    if entity not in ("STARQ", "CI"):
        return ""
    rows = M.contacts(entity)
    if not rows:
        return ""
    opts = ['<option value="">— none (optional)</option>']
    for r in rows:
        opts.append(
            f'<option value="{html.escape(str(r.get("id") or ""))}">'
            f'{html.escape(str(r.get("id") or ""))} · {html.escape(str(r.get("name") or ""))}'
            "</option>"
        )
    return (
        '<label>Contact <select name="contact_id">'
        + "".join(opts)
        + "</select></label> "
    )


def _contact_action_links(entity, qs, row):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ or not isinstance(row, dict):
        return "—"
    cid = str(row.get("id") or "").strip()
    kind = str(row.get("kind") or "").strip().lower()
    if not cid or kind not in ("customer", "vendor"):
        return "—"
    actions = [
        f'<a href="/reports?{qs}&contact_id={html.escape(cid)}">Statement</a>',
        f'<a href="/accounting?{qs}&contact_id={html.escape(cid)}">Ledger view</a>',
    ]
    if kind == "customer":
        actions.append(f'<a href="/sales?{qs}&contact_id={html.escape(cid)}">Use on Sales</a>')
    if kind == "vendor":
        actions.append(f'<a href="/expenses?{qs}&contact_id={html.escape(cid)}">Use on Expenses</a>')
    return " · ".join(actions)


def _supplier_bill_panel(entity, user, qs, selected_contact_id=""):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Supplier bill</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Group is not a company. "
            "Will not invent a vendor or an amount.</p></div>"
        )
    scope = (
        "Starq occupancy — Starq vendors only. Club Ignition cage bills stay on CI."
        if occ == "STARQ"
        else "Club Ignition occupancy — occupancy vendor. Tax 0. Credit AP 2100. Not posted (DEC-008)."
    )
    vendors = JO.occupancy_vendors(occ)
    issued_po = [
        r for r in JO.load_issued()
        if str(r.get("kind") or "").upper() == "PO" and str(r.get("occupancy") or "") == occ
    ]
    seat = user.acting_as if user else ""
    may = bool(user) and JO.may_capture_bill(seat, occ)
    if not vendors:
        return (
            '<div class="panel"><h2>Supplier bill</h2>'
            f"<p>{html.escape(scope)} Authorised seat types amount. "
            "Vendor is a contact if one exists, else a name already on ops. "
            "Optional link to an issued PO. Tax 0.</p>"
            '<div class="note">No occupancy vendor. Add a vendor contact, or use a name already '
            "on ops. Will not invent a vendor. issued=0 has no PO to link.</div></div>"
        )
    if not may:
        names = ", ".join(html.escape(v.get("name") or "") for v in vendors[:8])
        return (
            '<div class="panel"><h2>Supplier bill</h2>'
            f"<p>{html.escape(scope)} Occupancy vendors on disk: {names}. "
            "Authorised seat types the amount. Form hidden until that seat is acting.</p></div>"
        )
    vopts = "".join(
        f'<option value="{html.escape(v.get("contact_id") or v.get("name") or "")}"'
        f'{" selected" if (v.get("contact_id") or v.get("name") or "") == selected_contact_id else ""}>'
        f'{html.escape(v.get("name") or "")}'
        f'{" · contact" if v.get("source") == "contact" else " · ops"}'
        "</option>"
        for v in vendors
    )
    popts = ['<option value="">— none (optional)</option>']
    for r in issued_po:
        popts.append(
            f'<option value="{html.escape(str(r.get("event_id") or ""))}">'
            f'{html.escape(str(r.get("number") or r.get("event_id") or ""))}</option>'
        )
    po_note = (
        "Optional issued PO. issued=0 — none to link."
        if not issued_po else
        "Optional link to an issued PO on this occupancy."
    )
    return (
        '<div class="panel"><h2>Supplier bill</h2>'
        f"<p>{html.escape(scope)} Type a real amount. Tax 0. Never 8% GST. "
        "Creates an ops event and an AP outbox draft. Ali still copies (DEC-008).</p>"
        f'<form method="post" action="/expenses/bill?{qs}">'
        f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
        f'<input type="hidden" name="entity" value="{html.escape(occ)}">'
        f'<input type="hidden" name="type" value="BILL">'
        f'<label>Vendor <select name="vendor_ref" required>{vopts}</select></label> '
        f'<label>Amount MVR <input name="amount" inputmode="decimal" required '
        'placeholder="type the figure"></label> '
        f'<label>Item <input name="item" maxlength="120" placeholder="optional"></label> '
        f'<label>Issued PO <select name="po_event_id">{"".join(popts)}</select></label> '
        '<button type="submit">Capture supplier bill</button>'
        f'<p class="n" style="margin:8px 0 0;color:var(--muted)">{html.escape(po_note)} '
        "Leftover paint refused. Will not invent a vendor.</p>"
        "</form></div>"
    )


def _customer_invoice_panel(entity, user, qs, selected_contact_id=""):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Customer invoice</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Group is not a company. "
            "Will not invent a customer or an amount.</p></div>"
        )
    gate_4110 = JO.income_credit_gate("4110", "STARQ") if occ == "STARQ" else None
    if occ == "STARQ":
        if gate_4110:
            scope = (
                "Starq occupancy — AR 1200. 4110 Starq Dynamics is refused: "
                + gate_4110
                + " 4100 company 6201 only if that BAR is on disk. No shop POS."
            )
        else:
            scope = (
                "Starq occupancy — AR 1200. 4110 is Starq Dynamics 8211 on disk; "
                "4100 is company 6201. No shop POS. Tax 0. Not posted (DEC-008)."
            )
    else:
        scope = (
            "Club Ignition occupancy — occupancy customer. Tax 0. Debit AR 1200. "
            "Not posted (DEC-008). Leftover paint refused."
        )
    customers = JO.occupancy_customers(occ)
    seat = user.acting_as if user else ""
    may = bool(user) and JO.may_capture_invoice(seat, occ)
    if not customers:
        return (
            '<div class="panel"><h2>Customer invoice</h2>'
            f"<p>{html.escape(scope)} Authorised seat types amount. "
            "Customer is a contact if one exists, else a name already on ops. "
            "Issue is a separate click. issued stays 0 until then. Tax 0.</p>"
            '<div class="note">No occupancy customer. Add a customer contact, or use a name already '
            "on ops. Will not invent a customer.</div></div>"
        )
    if not may:
        names = ", ".join(html.escape(v.get("name") or "") for v in customers[:8])
        return (
            '<div class="panel"><h2>Customer invoice</h2>'
            f"<p>{html.escape(scope)} Occupancy customers on disk: {names}. "
            "Authorised seat types the amount. Form hidden until that seat is acting.</p></div>"
        )
    copts = "".join(
        f'<option value="{html.escape(v.get("contact_id") or v.get("name") or "")}"'
        f'{" selected" if (v.get("contact_id") or v.get("name") or "") == selected_contact_id else ""}>'
        f'{html.escape(v.get("name") or "")}'
        f'{" · contact" if v.get("source") == "contact" else " · ops"}'
        "</option>"
        for v in customers
    )
    iopts = []
    if occ == "STARQ":
        if not gate_4110:
            iopts.append('<option value="4110">4110 Starq Dynamics 8211</option>')
        iopts.append('<option value="4100">4100 company 6201 software</option>')
        if gate_4110:
            iopts = ['<option value="4100">4100 company 6201 software</option>']
    else:
        iopts = [
            '<option value="4200">4200 paint</option>',
            '<option value="4210">4210 body</option>',
            '<option value="4220">4220 wrap</option>',
            '<option value="4230">4230 detailing</option>',
        ]
    return (
        '<div class="panel"><h2>Customer invoice</h2>'
        f"<p>{html.escape(scope)} Type a real amount. Tax 0. Never 8% GST. "
        "Creates an ops event and an AR 1200 outbox draft. Ali still copies (DEC-008). "
        "Issue uses the existing Issue control. issued stays 0 until that click.</p>"
        f'<form method="post" action="/sales/invoice?{qs}">'
        f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
        f'<input type="hidden" name="entity" value="{html.escape(occ)}">'
        f'<input type="hidden" name="type" value="INVOICE">'
        f'<label>Customer <select name="customer_ref" required>{copts}</select></label> '
        f'<label>Amount MVR <input name="amount" inputmode="decimal" required '
        'placeholder="type the figure"></label> '
        f'<label>Item <input name="item" maxlength="120" placeholder="optional"></label> '
        f'<label>Income <select name="income_account">{"".join(iopts)}</select></label> '
        '<button type="submit">Capture customer invoice</button>'
        '<p class="n" style="margin:8px 0 0;color:var(--muted)">'
        "Leftover paint refused. Will not invent a customer. Will not invent BAR clearance.</p>"
        "</form></div>"
    )


def _jobs_panel(entity, qs):
    if entity == "STARQ":
        return ""
    st = O.load_state()
    jobs = st.get("jobs") or {}
    try:
        snap = O.campaign_snapshot()
    except Exception:
        snap = {}
    station = html.escape(str(snap.get("station") or "Counter"))
    play = html.escape(str(snap.get("play") or snap.get("title") or "Take the call."))
    seq = html.escape(str(st.get("job_seq") or 0))
    if not jobs:
        return (
            '<div class="panel"><h2>Projects / jobs</h2>'
            f"<p>Bay empty · station <b>{station}</b>. {play}</p>"
            f'<p class="sub">job_seq {seq}. Same engine as Flutter /ops. '
            f'<a href="/ops?{qs}">Take the call</a></p></div>'
        )
    body = []
    for jno, job in list(jobs.items())[-20:]:
        if not isinstance(job, dict):
            job = {"summary": str(job)}
        body.append(
            f'<tr><td class="code">{html.escape(str(jno))}</td>'
            f'<td>{html.escape(str(job.get("customer") or "—"))}</td>'
            f'<td>{html.escape(str(job.get("vehicle") or "—"))}</td>'
            f'<td>{html.escape(str(job.get("status") or job.get("stage") or "—"))}</td></tr>'
        )
    return (
        '<div class="panel"><h2>Projects / jobs</h2>'
        '<table><thead><tr><th>Job</th><th>Customer</th><th>Vehicle</th><th>Stage</th></tr></thead>'
        f'<tbody>{"".join(body)}</tbody></table>'
        f'<p class="sub">Next: {station} — {play}</p></div>'
    )


def _job_amt(v):
    if v is None:
        return "— not on events"
    return html.escape(f"{v:,.2f}")


def _job_cost_panel(entity):
    """Real job amounts only. Empty bay / no figures stays honest."""
    occ = entity if entity in ("STARQ", "CI") else None
    if occ is None:
        return (
            '<div class="panel"><h2>Job costing</h2>'
            "<p>Open Starq or Club Ignition occupancy. Group is not a third job book. "
            "Amounts only if already on ops events.</p></div>"
        )
    rows = JO.job_costing(occ)
    scope = (
        "Starq occupancy — Starq job amounts only. Club Ignition garage jobs stay on CI."
        if occ == "STARQ"
        else "Club Ignition occupancy — garage job amounts already on events. Not posted (DEC-008)."
    )
    if not rows:
        empty = (
            "No Starq job amounts on disk. Will not invent labour, materials, or a customer."
            if occ == "STARQ"
            else "No valued job amounts on disk. Empty bay is honest. Will not invent labour or materials."
        )
        return (
            '<div class="panel"><h2>Job costing</h2>'
            f"<p>{html.escape(scope)}</p>"
            f'<div class="note">{html.escape(empty)}</div></div>'
        )
    body = []
    for r in rows:
        profit = r.get("profit")
        profit_s = "— will not invent" if profit is None else html.escape(f"{profit:,.2f}")
        body.append(
            f'<tr><td class="code">{html.escape(str(r.get("job_no") or ""))}</td>'
            f'<td>{html.escape(r.get("customer") or "—")}</td>'
            f'<td class="n">{_job_amt(r.get("quoted"))}</td>'
            f'<td class="n">{_job_amt(r.get("deposit"))}</td>'
            f'<td class="n">{_job_amt(r.get("revenue"))}</td>'
            f'<td class="n">{_job_amt(r.get("materials"))}</td>'
            f'<td class="n">{_job_amt(r.get("labour"))}</td>'
            f'<td class="n">{profit_s}</td></tr>'
        )
    return (
        '<div class="panel" id="job-costing"><h2>Job costing</h2>'
        f"<p>{html.escape(scope)} Revenue, materials, and labour only if already on the event. "
        "Profit only when revenue and a cost amount both exist. Tax 0. Never 8% GST.</p>"
        '<table><thead><tr><th>Job</th><th>Customer</th><th class="n">Quoted</th>'
        '<th class="n">Deposit</th><th class="n">Revenue</th><th class="n">Materials</th>'
        '<th class="n">Labour</th><th class="n">Profit</th></tr></thead>'
        f'<tbody>{"".join(body)}</tbody></table></div>'
    )


def tree_guard(here=None, cwd=None) -> str | None:
    """Refuse nested finance clone and wrong cwd. Live product is D:\\StarqTech\\the foundation engine."""
    here_n = os.path.normcase(os.path.realpath(HERE if here is None else here))
    cwd_n = os.path.normcase(os.path.realpath(os.getcwd() if cwd is None else cwd))
    if here_n != LIVE_ROOT:
        return "WRONG TREE. Live product is D:\\StarqTech\\the foundation engine"
    if NESTED_MARK in here_n or NESTED_MARK in cwd_n:
        return "WRONG TREE. Nested finance clone is stale. Live product is D:\\StarqTech\\the foundation engine"
    if cwd_n != LIVE_ROOT:
        return "WRONG CWD. cd D:\\StarqTech\\the foundation engine then python serve.py"
    return None


def _pr_rfq_panel(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>PR / RFQ (ladder)</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Will not invent vendor or amount.</p></div>"
        )
    rows = []
    for p in JO.proposals(80, occupancy=occ):
        if p.get("doc_kind") not in ("PR", "RFQ"):
            continue
        rows.append(p)
    scope = (
        "Starq occupancy — Starq need/quote events only."
        if occ == "STARQ"
        else "Club Ignition occupancy — cage need/quote before award/PO."
    )
    if not rows:
        return (
            '<div class="panel"><h2>PR / RFQ (ladder)</h2>'
            f"<p>{html.escape(scope)} Draft only. No vendor or amount invented. "
            "Award with amount still drafts unissued PO (issued=0).</p>"
            '<div class="note">No PR/RFQ drafts on disk for this occupancy yet.</div></div>'
        )
    body = []
    for p in rows:
        doc = p.get("document") or ""
        body.append(
            f'<tr><td>{html.escape(p.get("doc_kind") or "")}</td>'
            f'<td class="code">{html.escape(p.get("event_id") or "")}</td>'
            f'<td>{html.escape(p.get("status") or "")}</td>'
            f'<td><textarea class="draft-copy" readonly onclick="this.select()">'
            f'{html.escape(doc)}</textarea></td></tr>'
        )
    return (
        '<div class="panel"><h2>PR / RFQ (ladder)</h2>'
        f"<p>{html.escape(scope)} Purchase request before PO. RFQ before award. "
        "Drafts only — will not invent vendor or amount. Tax 0. Not posted (DEC-008).</p>"
        '<table><thead><tr><th>Kind</th><th>Event</th><th>Status</th><th>Document</th></tr></thead>'
        f'<tbody>{"".join(body)}</tbody></table></div>'
    )


def _pr_rfq_chain_panel(entity):
    """Linked need → quote → award chains with PR, RFQ, unissued PO drafts."""
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return ""
    chains = JO.procurement_chains(occ)
    if not chains:
        return ""
    scope = (
        "Starq occupancy — chained Starq purchase events only."
        if occ == "STARQ"
        else "Club Ignition occupancy — need / quote / award linked on disk."
    )
    blocks = []
    for row in chains:
        ch = row.get("chain") or {}
        award = ch.get("award") or {}
        ap = row.get("award_proposal") or {}
        need_id = (ch.get("need") or {}).get("id") or "—"
        quote_id = (ch.get("quote") or {}).get("id") or "—"
        award_id = award.get("id") or "—"
        po_doc = ap.get("document") or ""
        blocks.append(
            '<div class="panel" style="margin-top:12px">'
            f"<p><b>Chain</b> PR {html.escape(str(need_id))} → RFQ {html.escape(str(quote_id))}"
            f" → award {html.escape(str(award_id))} · unissued PO · issued=0</p>"
            f'<textarea class="draft-copy" readonly onclick="this.select()">'
            f"{html.escape(po_doc)}</textarea></div>"
        )
    return (
        '<div class="panel"><h2>PR / RFQ → award → PO (chains)</h2>'
        f"<p>{html.escape(scope)} Linked by need_event_id / quote_event_id or scm_ref on the events. "
        "Real amount on award only. Issue still separate. Tax 0. Not posted (DEC-008).</p>"
        + "".join(blocks)
        + "</div>"
    )


def _purchase_panel(entity, user=None):
    if entity == "STARQ":
        return ('<div class="note">Starq occupancy is light SCM only. Garage need / receive / match / pay '
                "is Club Ignition. Switch entity to see the cage.</div>")
    occ = entity if entity in ("STARQ", "CI") else None
    body = []
    for ev in reversed(_ops_events()):
        if ev.get("type") not in ("PURCHASE", "PARTS_PROCUREMENT"):
            continue
        if occ and JO.occupancy_of(ev) != occ:
            continue
        f = ev.get("fields") if isinstance(ev.get("fields"), dict) else {}
        step = str(f.get("scm_step") or "—")
        eid = ev.get("id") or ""
        approve = _scm_approve_form(entity, eid, step, user, compact=True) if step != "—" else ""
        body.append(
            f'<tr><td class="code">{html.escape(str(eid))}</td>'
            f'<td>{html.escape(str(ev.get("ts") or "")[:16])}</td>'
            f'<td>{html.escape(str(ev.get("type") or ""))}</td>'
            f'<td>{html.escape(step)}</td>'
            f'<td>{html.escape(str(f.get("supplier") or f.get("vendor") or "—"))}</td>'
            f'<td>{html.escape(str(f.get("item") or "—"))}</td>'
            f'<td class="n">{html.escape(str(f.get("amount") or "—"))}</td>'
            f'<td>{approve or "—"}</td></tr>'
        )
        if len(body) >= 15:
            break
    inner = "".join(body) or (
        '<tr><td colspan="8" style="color:var(--muted)">No purchase events. Cage: need then receive. '
        "Award / match / pay stay Ali office.</td></tr>"
    )
    return (
        '<div class="panel"><h2>Purchasing (SoD)</h2>'
        "<p>Need / quotes / award / receive / match / pay. Authorised seat approves the next scm step "
        "when the event is on disk. Journals stay Ali (DEC-008).</p>"
        '<table><thead><tr><th>Event</th><th>When</th><th>Type</th><th>Step</th><th>Supplier</th>'
        '<th>Item</th><th class="n">Amount</th><th>Approve</th></tr></thead>'
        f'<tbody>{inner}</tbody></table></div>'
    )


def h_projects(acc, entity, dfrom, dto, user=None):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            f'<h1>Projects</h1><p class="sub">{html.escape(scope_label(entity))} · '
            "Pick Starq or Club Ignition occupancy. Group is not a third job book.</p>"
            '<div class="note">No invented jobs or amounts.</div>'
        )
    report = JO.projects_index(occ)
    scope = (
        "Starq occupancy — professional services jobs on disk only."
        if occ == "STARQ"
        else "Club Ignition occupancy — garage jobs from ops/state and valued events."
    )
    if report.get("empty"):
        return (
            f'<h1>Projects</h1><p class="sub">{html.escape(scope_label(entity))} · {html.escape(scope)}</p>'
            f'<div class="note">{html.escape(report.get("reason") or "Empty honest.")}</div>'
            f'<p class="sub"><a href="/sales?{qs}#job-costing">Sales job costing</a></p>'
        )
    rows = []
    for it in report.get("items") or []:
        jno = it.get("job_no") or ""
        cost_href = f'/sales?{qs}&job={quote(str(jno))}#job-costing'
        ops_href = f'/ops/job?id={quote(str(jno))}' if it.get("writable") else ""
        link = f'<a href="{cost_href}">Job costing</a>'
        if ops_href and user:
            link += f' · <a href="{ops_href}">Ops job</a>'
        rows.append(
            f'<tr><td class="code">{html.escape(str(jno))}</td>'
            f'<td>{html.escape(it.get("customer") or "—")}</td>'
            f'<td>{html.escape(it.get("vehicle") or "—")}</td>'
            f'<td>{html.escape(it.get("status") or "—")}</td>'
            f'<td>{html.escape(it.get("source") or "")}</td>'
            f'<td>{link}</td></tr>'
        )
    return (
        f'<h1>Projects</h1><p class="sub">{html.escape(scope_label(entity))} · {html.escape(scope)} '
        f'{html.escape(report.get("reason") or "")}</p>'
        '<div class="panel"><h2>Jobs on disk</h2>'
        '<table><thead><tr><th>Job</th><th>Customer</th><th>Vehicle</th><th>Status</th>'
        '<th>Source</th><th>Link</th></tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table></div>'
        f'<p class="sub"><a href="/sales?{qs}#job-costing">Sales job costing panel</a></p>'
    )


def _pipe_cards(items, empty_label, kind):
    if not items:
        return f'<p class="empty">{html.escape(empty_label)}</p>'
    bits = []
    for it in items:
        num = it.get("number") or it.get("job_no") or ""
        who = it.get("customer") or it.get("item") or ""
        extra = it.get("amount") or it.get("qty") or ""
        bits.append(
            '<div class="pcard">'
            f'<div class="k">{html.escape(str(it.get("kind") or kind))} '
            f'{html.escape(str(num) or "—")}</div>'
            f'<div>{html.escape(str(who) or "—")}</div>'
            f'<div class="empty">{html.escape(str(extra))}</div>'
            "</div>"
        )
    return "".join(bits)


def _three_way_panel(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Three-way match</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Group is not a company. "
            "Will not invent a match.</p></div>"
        )
    report = JO.three_way_match(occ)
    scope = (
        "Starq occupancy — Starq issued docs only. Club Ignition cage stays on CI."
        if occ == "STARQ"
        else "Club Ignition occupancy — issued PO/INV and GRN drafts on disk. Not posted (DEC-008)."
    )
    if report.get("empty"):
        return (
            '<div class="panel"><h2>Three-way match</h2>'
            f"<p>{html.escape(scope)} Columns are PO / GRN / INV. "
            "issued=0 shows empty honest, not fake matches. Tax 0.</p>"
            f'<div class="note"><b>Empty honest:</b> {html.escape(report.get("reason") or "")} '
            f'Tax {html.escape(str(report.get("tax")))}.</div></div>'
        )
    return (
        '<div class="panel"><h2>Three-way match</h2>'
        f"<p>{html.escape(scope)} From issued documents and GRN drafts already on disk. "
        "Will not pair a sales INV onto a PO. Tax 0. Never 8% GST.</p>"
        '<div class="pipe">'
        f'<div class="col"><h3>PO</h3>{_pipe_cards(report.get("po") or [], "No issued PO.", "PO")}</div>'
        f'<div class="col"><h3>GRN</h3>{_pipe_cards(report.get("grn") or [], "No GRN draft.", "GRN")}</div>'
        f'<div class="col"><h3>INV</h3>{_pipe_cards(report.get("inv") or [], "No issued INV.", "INV")}</div>'
        "</div></div>"
    )


def _crm_pipeline_panel(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>CRM pipeline</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Will not invent a lead.</p></div>"
        )
    report = JO.crm_pipeline(occ)
    scope = (
        "Starq occupancy — Starq CALL/ops only. Club Ignition garage stays on CI."
        if occ == "STARQ"
        else "Club Ignition occupancy — existing CALL / garage steps. Not a lead seed."
    )
    if report.get("empty"):
        return (
            '<div class="panel"><h2>CRM pipeline</h2>'
            f"<p>{html.escape(scope)} Columns are the ops cycle already on disk. "
            "Will not invent a lead.</p>"
            f'<div class="note"><b>Empty honest:</b> {html.escape(report.get("reason") or "")}</div></div>'
        )
    cols = []
    cards = report.get("cards") or {}
    for name in report.get("columns") or JO.CRM_COLUMNS:
        items = cards.get(name) or []
        cols.append(
            f'<div class="col"><h3>{html.escape(name)}</h3>'
            + _pipe_cards(items, "—", name)
            + "</div>"
        )
    return (
        '<div class="panel"><h2>CRM pipeline</h2>'
        f"<p>{html.escape(scope)} Party and job only if already on the event. "
        "Need / receive stay on Expenses. No invented leads.</p>"
        f'<div class="pipe wide">{"".join(cols)}</div></div>'
    )


def _service_line_panel(entity):
    if entity == "STARQ":
        return ""
    stations = []
    try:
        quests = os.path.join(HERE, "ops", "catalog", "quests.json")
        with open(quests, encoding="utf-8") as f:
            stations = json.load(f).get("stations") or []
    except (OSError, json.JSONDecodeError):
        stations = []
    if not stations:
        return ""
    body = "".join(
        f'<tr><td>{html.escape(s.get("name") or s.get("id") or "")}</td>'
        f'<td>{html.escape(", ".join(s.get("events") or []))}</td>'
        f'<td>{html.escape(s.get("note") or "")}</td></tr>'
        for s in stations if isinstance(s, dict)
    )
    return (
        '<div class="panel"><h2>Service line (4520) — not POS</h2>'
        "<p>Paint-shop stations. Work posts as ops; income journals wait on a valued close (DEC-008). "
        "Starq occupancy has no shop floor.</p>"
        '<table><thead><tr><th>Station</th><th>Events</th><th>Note</th></tr></thead>'
        f'<tbody>{body}</tbody></table></div>'
    )


def _review_rows(entity, types=None, include_counts=False, banking_only=False):
    occ = entity if entity in ("STARQ", "CI") else None
    want = set(types) if types else None
    rows = []
    for p in JO.proposals(80, occupancy=occ):
        if want is not None and p.get("type") not in want:
            continue
        if occ and (p.get("occupancy") or "CI") != occ:
            continue
        if banking_only and not p.get("banking"):
            continue
        rows.append(p)
    if include_counts and occ != "STARQ" and not banking_only:
        for h in M.inventory_gl_holds():
            if want is not None and h.get("type") not in want:
                continue
            rows.append(h)
    if include_counts and occ in ("STARQ", "CI") and not banking_only:
        for h in M.payroll_gl_holds(occ):
            if want is not None and h.get("type") not in want:
                continue
            rows.append(h)
    return rows


def _draft_review_panel(entity, types=None, include_counts=False, title="Draft review (not posted)",
                        banking_only=False, show_validate=False):
    rows = _review_rows(entity, types, include_counts, banking_only=banking_only)
    user = A.current_user()
    seat = user.acting_as if user else ""
    occ = entity if entity in ("STARQ", "CI") else None
    nxt_po = JO.preview_next(occ, "PO") if occ else {}
    nxt_inv = JO.preview_next(occ, "INV") if occ else {}
    nxt_quo = JO.preview_next(occ, "QUO") if occ else {}
    qs = f"entity={entity or ''}"
    scope = (
        "Starq occupancy — only Starq drafts. Club Ignition garage drafts stay on CI."
        if entity == "STARQ"
        else "Club Ignition occupancy — CI drafts only. No Starq shop POS."
        if entity == "CI"
        else "Group view — both occupancies, labelled."
    )
    seq_note = ""
    if occ:
        seq_note = (
            f" Next PO {html.escape(nxt_po.get('shown') or '—')} (issued {html.escape(str(nxt_po.get('issued', 0)))}). "
            f"Next INV {html.escape(nxt_inv.get('shown') or '—')} (issued {html.escape(str(nxt_inv.get('issued', 0)))}). "
            f"Next QUO {html.escape(nxt_quo.get('shown') or '—')} (issued {html.escape(str(nxt_quo.get('issued', 0)))}). "
            "Award does not allocate. An authorised seat issues."
        )
    accounts = B.load_accounts() if show_validate else None
    n_pass = n_fail = n_ready = 0
    if show_validate:
        for p in rows:
            if not p.get("copy_ready"):
                continue
            n_ready += 1
            v = JO.validate_draft(p, accounts)
            p["_validate"] = v
            if v.get("ok"):
                n_pass += 1
            else:
                n_fail += 1
    if not rows:
        empty = (
            "No Starq outbox drafts. Garage / cage drafts are Club Ignition occupancy."
            if entity == "STARQ"
            else "No copy-ready drafts in this occupancy yet."
        )
        extra = (
            " Validate runs on copy-ready drafts only. Nothing is posted."
            if show_validate else ""
        )
        return (
            f'<div class="panel"><h2>{html.escape(title)}</h2>'
            f"<p>{html.escape(scope)}</p>"
            f'<div class="note"><b>DEC-008:</b> {html.escape(empty)} '
            f"{seq_note} "
            f"Ali copies into the entity journal. Ops never appends the ledger.{extra}</div></div>"
        )
    val_head = "<th>Validate</th>" if show_validate else ""
    summary = ""
    if show_validate:
        summary = (
            f'<div class="note"><b>Draft validate:</b> {n_ready} copy-ready · '
            f'{n_pass} PASS · {n_fail} FAIL. Occupancy, known accounts, debit=credit, tax 0, '
            "4300 leftover blocked, Starq no POS sale. Does not write <code>journals/</code>.</div>"
        )
    body = []
    for p in rows:
        ready = "yes" if p.get("copy_ready") else "no"
        dest = html.escape(p.get("copy_into") or "—")
        draft_html = ""
        st = p.get("status") or ""
        st_show = "DRAFT — not posted" if st == "draft" else st
        if p.get("draft"):
            draft_html = (
                f'<div class="sub">DRAFT — not posted</div>'
                f'<textarea class="draft-copy" readonly onclick="this.select()">'
                f'{html.escape(p["draft"])}</textarea>'
            )
        if p.get("document"):
            draft_html += (
                f'<textarea class="draft-copy" readonly onclick="this.select()">'
                f'{html.escape(p["document"])}</textarea>'
            )
            if p.get("doc_issued") and p.get("doc_number"):
                draft_html += f'<div class="sub">Issued {html.escape(p["doc_number"])}</div>'
            if occ and JO.may_print(p, occ):
                eid = html.escape(p.get("event_id") or "")
                dkind = html.escape(p.get("doc_kind") or "")
                draft_html += (
                    f'<div class="sub"><a href="/documents/print?entity={html.escape(occ)}'
                    f'&event_id={eid}&kind={dkind}" target="_blank" rel="noopener">Print {dkind} (local HTML)</a></div>'
                )
            elif occ and p.get("doc_kind") in ("PO", "INV", "QUO"):
                draft_html += (
                    '<div class="sub">Print refused: amount or customer missing. Will not invent.</div>'
                )
            if occ and JO.may_issue(p, seat, occ) and user:
                kind = p.get("doc_kind") or ""
                shown = (
                    (nxt_po if kind == "PO" else nxt_quo if kind == "QUO" else nxt_inv).get("shown") or ""
                )
                draft_html += (
                    f'<form method="post" action="/documents/issue?{qs}" style="margin-top:8px">'
                    f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
                    f'<input type="hidden" name="event_id" value="{html.escape(p.get("event_id") or "")}">'
                    f'<input type="hidden" name="kind" value="{html.escape(kind)}">'
                    f'<input type="hidden" name="occupancy" value="{html.escape(occ)}">'
                    + _contact_select(occ)
                    + f'<button type="submit">Issue {html.escape(kind)} {html.escape(shown)}</button>'
                    "</form>"
                )
        val_cell = ""
        if show_validate:
            v = p.get("_validate")
            if not p.get("copy_ready"):
                val_cell = '<td><span class="pill">skip</span></td>'
            elif v and v.get("ok"):
                val_cell = '<td><span class="pill ok">PASS</span></td>'
            else:
                why = html.escape("; ".join((v or {}).get("fails") or ["FAIL"]))
                val_cell = f'<td><span class="pill fail">FAIL</span><div class="sub">{why}</div></td>'
        body.append(
            f'<tr><td>{html.escape(p.get("occupancy_label") or p.get("occupancy") or "")}</td>'
            f'<td>{html.escape(p.get("type") or "")}</td>'
            f'<td>{html.escape(st_show)}</td>'
            f'<td class="code">{html.escape(p.get("accounts_s") or "—")}</td>'
            f'<td>{ready}</td>'
            f'<td class="code">{dest}</td>'
            f'{val_cell}'
            f'<td>{html.escape(p.get("reason") or "")}{draft_html}</td></tr>'
        )
    return (
        f'<div class="panel"><h2>{html.escape(title)}</h2>'
        f"<p>{html.escape(scope)}{seq_note} Select the box and copy. "
        "Then <code>python books.py check</code>. Ops never writes <code>journals/</code>.</p>"
        + summary +
        f'<table><thead><tr><th>Occupancy</th><th>Type</th><th>Status</th><th>Accounts</th>'
        f'<th>Copy-ready</th><th>Paste into</th>{val_head}<th>Draft</th></tr></thead>'
        f'<tbody>{"".join(body)}</tbody></table></div>'
    )


def _outbox_panel(entity, types):
    return _draft_review_panel(entity, types=types)


def _ops_txn_panel(entity, limit=25, qs=""):
    """Occupancy-correct ops events already on disk. Transaction log until GL posts."""
    occ = entity if entity in ("STARQ", "CI") else None
    rows = JO.occupancy_events(occ, limit=limit)
    scope = (
        "Starq occupancy — Starq events only. Garage / cage events stay on Club Ignition."
        if entity == "STARQ"
        else "Club Ignition occupancy — CI events only."
        if entity == "CI"
        else "Group view — both occupancies, labelled."
    )
    if not rows:
        empty = (
            "No Starq ops events on disk yet. Does not invent a Starq shop sale."
            if entity == "STARQ"
            else "None on disk yet. Capture is ops; GL is still the journal (DEC-008)."
        )
        return (
            '<div class="panel"><h2>Transactions (ops events)</h2>'
            f"<p>{html.escape(scope)} Events are the transaction log until a journal is copied. "
            "Amounts only if already on the event.</p>"
            f'<div class="note">{html.escape(empty)}</div>'
            + (f'<p class="sub"><a href="/transactions?{qs}">Full list</a></p>' if qs else "")
            + "</div>"
        )
    body = []
    for ev in rows:
        amt = ev.get("amount")
        amt_s = "—" if amt in (None, "") else html.escape(str(amt))
        body.append(
            f'<tr><td>{html.escape(str(ev.get("ts") or "")[:16])}</td>'
            f'<td>{html.escape(ev.get("occupancy_label") or ev.get("occupancy") or "")}</td>'
            f'<td class="code">{html.escape(ev.get("type") or "")}</td>'
            f'<td class="code">{html.escape(str(ev.get("job_no") or "—"))}</td>'
            f'<td>{html.escape(str(ev.get("item") or "—"))}</td>'
            f'<td class="n">{amt_s}</td></tr>'
        )
    more = f'<p class="sub"><a href="/transactions?{qs}">Full list</a></p>' if qs else ""
    return (
        '<div class="panel"><h2>Transactions (ops events)</h2>'
        f"<p>{html.escape(scope)} Events on disk are the transaction log until Ali copies a journal "
        "(DEC-008). Not fused with posted books. Amount only if already on the event — "
        "will not invent price, qty, or salary.</p>"
        '<table><thead><tr><th>When</th><th>Occupancy</th><th>Type</th><th>Job</th>'
        '<th>Item</th><th class="n">Amount</th></tr></thead>'
        f'<tbody>{"".join(body)}</tbody></table>{more}</div>'
    )


def _posted_journal_rows(entity, limit=25):
    """Posted journals via books.py parse. Not sqlite. Not the outbox."""
    summary = B.check_journals()
    entries = summary.get("_entries") or []
    occ = entity if entity in ("STARQ", "CI") else None
    rows = []
    for e in reversed(list(entries)):
        if occ and getattr(e, "entity", None) != occ:
            continue
        debit = sum(
            (p.amount for p in (e.postings or []) if p.amount and p.amount > 0),
            Decimal("0"),
        )
        rows.append({
            "date": e.date,
            "entity": e.entity,
            "narration": e.narration,
            "v": debit,
        })
        if len(rows) >= limit:
            break
    return rows, summary


def _perm_matrix_panel():
    """Read-only seat × action from permissions.json."""
    mx = M.permission_matrix()
    seats = mx.get("seats") or []
    events = mx.get("events") or []
    actions = mx.get("actions") or []
    ev_grid = mx.get("event_grid") or {}
    ac_grid = mx.get("action_grid") or {}

    def cell(yes):
        return '<td><span class="pill ok">yes</span></td>' if yes else '<td>—</td>'

    ev_th = "".join(f"<th>{html.escape(e)}</th>" for e in events)
    ev_body = []
    for seat in seats:
        row = ev_grid.get(seat) or {}
        tds = "".join(cell(row.get(e)) for e in events)
        ev_body.append(f'<tr><td class="code">{html.escape(seat)}</td>{tds}</tr>')
    ac_th = "".join(f"<th>{html.escape(a.get('label') or a.get('id') or '')}</th>" for a in actions)
    ac_body = []
    for seat in seats:
        row = ac_grid.get(seat) or {}
        tds = "".join(cell(row.get(a["id"])) for a in actions)
        ac_body.append(f'<tr><td class="code">{html.escape(seat)}</td>{tds}</tr>')
    inv = "".join(f"<li>{html.escape(x)}</li>" for x in (mx.get("invariants") or [])[:8])
    return (
        '<div class="panel"><h2>Permissions matrix</h2>'
        "<p>Read-only honesty from <code>ops/masters/permissions.json</code>. "
        "Seat × action. Ledger post is not an ops event (DEC-008). Not editable here.</p>"
        f'<p class="sub">{html.escape(mx.get("note") or "")}</p>'
        "<h3 class=\"sub\" style=\"margin:12px 18px 0\">Ops events</h3>"
        f'<table class="matrix"><thead><tr><th>Seat</th>{ev_th}</tr></thead>'
        f'<tbody>{"".join(ev_body)}</tbody></table>'
        "<h3 class=\"sub\" style=\"margin:12px 18px 0\">Named actions</h3>"
        f'<table class="matrix"><thead><tr><th>Seat</th>{ac_th}</tr></thead>'
        f'<tbody>{"".join(ac_body)}</tbody></table>'
        f'<ul class="sub">{inv}</ul></div>'
    )


def _audit_panel(entity):
    """Append-only master creates already logged. No invented history."""
    occ = entity if entity in ("STARQ", "CI") else None
    rows = M.load_audit(occ, limit=40)
    scope = (
        "Starq occupancy — Starq master writes only."
        if entity == "STARQ"
        else "Club Ignition occupancy — CI master writes only."
        if entity == "CI"
        else "Group view — both occupancies, labelled. Not a third company log."
    )
    if not rows:
        empty = (
            "No master-create audit rows on this occupancy. "
            "Contact / SKU / location / employee / price / count writes append here. "
            "Will not invent history."
        )
        return (
            '<div class="panel"><h2>Audit log</h2>'
            f"<p>{html.escape(scope)} Append-only <code>ops/master_audit.jsonl</code>. "
            "Not editable here. Journals untouched.</p>"
            f'<div class="note">{html.escape(empty)}</div></div>'
        )
    body = []
    for r in rows:
        body.append(
            f'<tr><td>{html.escape(str(r.get("ts") or "")[:19])}</td>'
            f'<td>{html.escape(str(r.get("occupancy") or ""))}</td>'
            f'<td class="code">{html.escape(str(r.get("action") or ""))}</td>'
            f'<td class="code">{html.escape(str(r.get("record_id") or "—"))}</td>'
            f'<td>{html.escape(str(r.get("person_id") or ""))}</td>'
            f'<td>{html.escape(str(r.get("seat") or ""))}</td>'
            f'<td>{html.escape(str(r.get("summary") or ""))}</td></tr>'
        )
    return (
        '<div class="panel"><h2>Audit log</h2>'
        f"<p>{html.escape(scope)} Append-only. Contact, SKU, location, employee, price, count. "
        "No fake rows. Not a GL post (DEC-008).</p>"
        f'<tbody>{"".join(body)}</tbody></table></div>'
    )


PRINT_CSS = """
@page{margin:18mm}
html,body{background:#fff;color:#111;font:14px/1.45 "Segoe UI",system-ui,sans-serif;margin:0}
body.doc{padding:24px;max-width:800px;margin:auto;position:relative}
.wm{position:fixed;top:36%;left:12%;font-size:110px;font-weight:800;letter-spacing:.12em;
color:rgba(180,40,40,.14);transform:rotate(-24deg);pointer-events:none;z-index:0}
.head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #111;padding-bottom:12px;position:relative;z-index:1}
.head h1{font-size:20px;margin:0 0 4px}
.head .meta{font-size:12px;color:#333}
.mark{width:42px;height:42px;object-fit:contain}
table{width:100%;border-collapse:collapse;margin:18px 0;position:relative;z-index:1}
th,td{text-align:left;padding:8px 0;border-bottom:1px solid #ddd}
td.n,th.n{text-align:right}
.note{font-size:12px;color:#444;margin-top:18px;position:relative;z-index:1}
.actions{margin:16px 0 24px;position:relative;z-index:1}
.actions button{background:#111;color:#fff;border:0;padding:8px 16px;border-radius:6px;font:inherit;cursor:pointer}
@media print{.actions{display:none} body.doc{padding:0}}
"""


def h_document_print_error(err: str) -> str:
    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<title>Print refused — the foundation engine</title></head>"
        "<body style=\"font-family:system-ui,sans-serif;padding:40px;max-width:640px\">"
        "<h1>Print refused</h1>"
        f"<p>{html.escape(err or 'Amount or customer missing on ops. Will not invent.')}</p>"
        "<p>Local only. Bound 127.0.0.1. Journals untouched (DEC-008).</p>"
        "</body></html>"
    )


def h_document_print(payload: dict) -> str:
    """Standalone print HTML. Occupancy letterhead. Tax 0. DRAFT watermark until issued."""
    lh = payload.get("letterhead") or {}
    occ = payload.get("occupancy")
    logo = "ci-logo.png" if occ == "CI" else "starq-logo.png"
    wm = payload.get("watermark") or ""
    wm_html = f'<div class="wm">{html.escape(wm)}</div>' if wm else ""
    tin = lh.get("tin") or "not on org master"
    gst_no = lh.get("gst_number") or "not on org master"
    bns = ", ".join(
        f"{x.get('name') or ''} {x.get('bn') or ''}".strip()
        for x in (lh.get("business_names") or [])
        if isinstance(x, dict)
    ) or "—"
    qty = payload.get("qty") or "not on event — will not invent"
    item = payload.get("item") or "not on event — will not invent"
    job = payload.get("job_no") or "not on event"
    number = payload.get("number") or "unissued — not allocated"
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(payload.get("title") or "Document")} — the foundation engine</title>
<style>{PRINT_CSS}</style></head>
<body class="doc">
{wm_html}
<div class="head">
<div>
<img class="mark" src="/assets/{logo}" alt="">
<h1>{html.escape(lh.get("legal_name") or "")}</h1>
<div class="meta">C {html.escape(lh.get("registry_c") or "")} · GST {html.escape(lh.get("gst_status") or "")}
 · TIN {html.escape(str(tin))} · GST no. {html.escape(str(gst_no))}</div>
<div class="meta">{html.escape(bns)}</div>
</div>
<div class="meta" style="text-align:right">
<b>{html.escape(payload.get("title") or "")}</b><br>
{html.escape(payload.get("occupancy_label") or "")}<br>
{html.escape(payload.get("date") or "")}<br>
No. {html.escape(str(number))}
</div>
</div>
<div class="actions">
<button type="button" onclick="window.print()">Print</button>
<span class="note">Local HTML. 127.0.0.1 only. Not a journal. DEC-008.</span>
</div>
<table>
<tr><th>{html.escape(payload.get("party_label") or "Party")}</th>
<td>{html.escape(payload.get("party") or "")}</td></tr>
<tr><th>Item</th><td>{html.escape(str(item))}</td></tr>
<tr><th>Qty</th><td>{html.escape(str(qty))}</td></tr>
<tr><th>Job</th><td>{html.escape(str(job))}</td></tr>
<tr><th>Amount</th><td class="n">{html.escape(payload.get("currency") or "MVR")} {html.escape(payload.get("amount") or "")}</td></tr>
<tr><th>Tax</th><td class="n">{html.escape(payload.get("tax") or "0")}</td></tr>
</table>
<p class="note">{html.escape(payload.get("tax_line") or "Tax: 0")} GST not registered. Leftover paint is not product.
{"Issued." if payload.get("issued") else "DRAFT until an authorised seat issues. Print does not allocate a number."}
Ops did not post.</p>
</body></html>"""


def h_sales(acc, entity, dfrom, dto, notice=None, user=None, contact_id=""):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    flash = ""
    if notice == "issued":
        flash = '<div class="note">Document issued. Sequence incremented. Journals untouched (DEC-008).</div>'
    elif notice == "issue_denied":
        flash = '<div class="note err">Issue refused. Wrong seat, occupancy, leftover paint, missing amount, or already issued.</div>'
    elif notice == "inv_captured":
        flash = '<div class="note">Customer invoice captured. AR 1200 draft is copy-ready. Journals untouched (DEC-008). issued stays 0 until Issue.</div>'
    elif notice == "inv_denied":
        flash = ('<div class="note err">Customer invoice refused. Wrong seat, occupancy, leftover paint, '
                 "missing amount, unknown customer, tax, or 4110/8211 BAR gate. Will not invent.</div>")
    if entity == "STARQ":
        prods = [p for p in M.products("STARQ") if p.get("active")]
        rows = "".join(
            f'<tr><td class="code">{html.escape(p["sku"])}</td><td>{html.escape(p["name"])}</td>'
            f'<td class="code">{html.escape(p["income_account"])}</td></tr>'
            for p in prods)
        return (
            f'<h1>Sales</h1><p class="sub">{html.escape(scope_label(entity))} · services mapped to BAR income. '
            "No shop POS on Starq. 4110 is Starq Dynamics 8211; 4100 is company 6201. "
            "Customer invoice: authorised seat types amount + occupancy customer "
            "(contact if exists, else ops name). AR 1200 draft. Tax 0. "
            "4110 credits only when BAR/8211 is on disk — will not invent BAR clearance. "
            "Valued CLOSE / receivable drafts copy into journals/starq/. Never 8% GST. Never 4300. "
            "Authorised seat issues ST-INV-; award/close/capture does not increment issued. "
            "Print is local HTML, letterhead from the org master, Tax 0, DRAFT until issued.</p>"
            + flash
            + _engine_strip(entity)
            + _customer_invoice_panel(entity, user, qs, contact_id)
            + _job_cost_panel(entity)
            + '<div class="panel"><table><thead><tr><th>SKU</th><th>Service</th><th>Income</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div>'
            + _outbox_panel(entity, ("INVOICE", "INVOICE_PAYMENT", "CLOSE", "FIN_RECEIVABLE", "AUTHORISATION"))
            + f'<p class="sub"><a href="/products?{qs}">Product master</a> · '
            f'<a href="/journal?{qs}">Journal</a></p>'
        )
    events = _event_rows(
        ("CALL", "BOOKING", "INTAKE", "ESTIMATE", "AUTHORISATION", "JOB_CARD",
         "HANDOVER", "INVOICE", "INVOICE_PAYMENT", "CLOSE"),
        40,
        entity,
    )
    return (
        f'<h1>Sales</h1><p class="sub">{html.escape(scope_label(entity))} · job cycle is the pipeline. '
        "Auto-journals from these events are the destination, not live (DEC-008). "
        "Customer invoice: authorised seat types amount + occupancy customer "
        "(contact if exists, else ops name). AR 1200. Tax 0. Never 8% GST. "
        "Valued invoice/close drafts an unissued INV and shows the next number. "
        "An authorised seat issues; award/capture does not increment issued. "
        "Cash/wallet receipt drafts against an issued INV only — unnamed will not invent 1110. "
        "Print is local HTML, letterhead from the org master, Tax 0, DRAFT until issued.</p>"
        + flash
        + _engine_strip(entity)
        + _customer_invoice_panel(entity, user, qs, contact_id)
        + _jobs_panel(entity, qs)
        + _job_cost_panel(entity)
        + _service_line_panel(entity)
        + _evt_table(events, (
            ("When", "ts"), ("Type", "type"), ("Job", "job_no"),
            ("Customer", "customer"), ("Vehicle", "vehicle"), ("Amount", "amount"),
        ))
        + _outbox_panel(entity, ("INVOICE", "INVOICE_PAYMENT", "CLOSE", "FIN_RECEIVABLE", "AUTHORISATION"))
        + f'<p class="sub"><a href="/ops?{qs}">Open Club Ignition Ops</a> · '
        f'<a href="/products?{qs}">Services</a></p>'
    )


def h_expenses(acc, entity, dfrom, dto, notice=None, user=None, contact_id=""):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    flash = ""
    if notice == "issued":
        flash = '<div class="note">Document issued. Sequence incremented. Journals untouched (DEC-008).</div>'
    elif notice == "issue_denied":
        flash = '<div class="note err">Issue refused. Wrong seat, occupancy, leftover paint, missing amount, or already issued.</div>'
    elif notice == "bill_captured":
        flash = '<div class="note">Supplier bill captured. AP draft is copy-ready. Journals untouched (DEC-008).</div>'
    elif notice == "bill_denied":
        flash = ('<div class="note err">Supplier bill refused. Wrong seat, occupancy, leftover paint, '
                 "missing amount, unknown vendor, or unissued PO. Will not invent.</div>")
    elif notice == "scm_approved":
        flash = '<div class="note">SCM step approved. Ops event logged. Journals untouched (DEC-008).</div>'
    elif notice == "scm_approve_denied":
        flash = '<div class="note err">SCM approve refused. Wrong seat, occupancy, missing event, or chain already advanced.</div>'
    events = _event_rows(
        ("RECEIPT", "BILL", "PURCHASE", "PARTS_PROCUREMENT", "FIN_PAYABLE"), 40, entity)
    return (
        f'<h1>Expenses</h1><p class="sub">{html.escape(scope_label(entity))} · purchasing + receipts. '
        "Capture is not a GL post. Need drafts PR; quote drafts RFQ — no invented vendor or amount. "
        "Award with an amount drafts an unissued PO (next number shown). "
        "Issued increments only when an authorised seat issues. "
        "GRN draft only against an issued PO with qty on the event — will not invent a count. "
        "Supplier bill: authorised seat types amount + occupancy vendor (contact if exists, else ops name). "
        "Optional issued PO. Tax 0. Ali still appends the journal (DEC-008).</p>"
        + flash
        + _engine_strip(entity)
        + _supplier_bill_panel(entity, user, qs, contact_id)
        + _pr_rfq_panel(entity)
        + _pr_rfq_chain_panel(entity)
        + _purchase_panel(entity, user)
        + _three_way_panel(entity)
        + _evt_table(events, (
            ("When", "ts"), ("Type", "type"), ("Supplier", "supplier"),
            ("Item", "item"), ("Amount", "amount"), ("Kind", "kind"),
        ))
        + _outbox_panel(entity, ("RECEIPT", "BILL", "PURCHASE", "FIN_PAYABLE"))
        + f'<p class="sub"><a href="/?{qs}">Ask / capture on Dashboard</a></p>'
    )


def h_banking(acc, entity, dfrom, dto):
    orgs = []
    if entity in ("STARQ", "CI"):
        one = M.org_for_entity(entity)
        if one:
            orgs = [one]
    else:
        orgs = [o for o in M.organizations() if isinstance(o, dict)]
    rows = []
    for org in orgs:
        occ_l = "Starq" if org.get("entity") == "STARQ" else "Club Ignition"
        show_occ = entity not in ("STARQ", "CI")
        for item in list(org.get("cash_accounts") or []) + list(org.get("bank_accounts") or []):
            if not isinstance(item, dict):
                continue
            c = item.get("code") or ""
            rows.append(
                "<tr>"
                + (f'<td>{html.escape(occ_l)}</td>' if show_occ else "")
                + f'<td class="code">{html.escape(str(c))}</td>'
                f'<td>{html.escape(item.get("label") or (acc.get(c) or {}).get("name") or "—")}</td>'
                f'<td>{html.escape(item.get("status") or "—")}</td></tr>'
            )
    head_occ = "<th>Occupancy</th>" if entity not in ("STARQ", "CI") else ""
    inner = "".join(rows) or (
        '<tr><td colspan="4" style="color:var(--muted)">No cash/bank rows on the org master.</td></tr>'
    )
    return (
        f'<h1>Banking</h1><p class="sub">{html.escape(scope_label(entity))} · cash and MIB from the company master. '
        "Statuses are facts on disk. MIB is not_opened. No feed. No invented opening. "
        "Not a bank statement. Named cash/wallet on receipts and payments drafts copy-ready text. "
        "Ali copies (DEC-008). Ops never posts.</p>"
        + _engine_strip(entity)
        + '<div class="panel"><h2>Cash and bank (org)</h2>'
        f'<table><thead><tr>{head_occ}<th>Code</th><th>Account</th><th>Status</th></tr></thead>'
        f'<tbody>{inner}</tbody></table></div>'
        + _draft_review_panel(
            entity,
            banking_only=True,
            title="Cash / wallet drafts (not posted, not a statement)",
        )
    )


def h_contacts(acc, entity, dfrom, dto, user=None, notice=None):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    rows = M.contacts(entity)
    derived = M.contacts_from_ops(entity)
    flash = ""
    if notice == "created":
        flash = '<div class="note">Contact saved on this occupancy master. No Gmail invented. Journals untouched.</div>'
    elif notice == "create_denied":
        flash = ('<div class="note err">Contact refused. Wrong occupancy or seat, empty name, '
                 "or that name is already on this master.</div>")
    elif notice == "from_call":
        flash = '<div class="note">CALL party saved to this occupancy master. Name was already on the CALL. Journals untouched.</div>'
    elif notice == "from_call_denied":
        flash = ('<div class="note err">CALL party refused. No name on the CALL, wrong occupancy, '
                 "or already on this master. Will not invent a party.</div>")
    master = ""
    if not rows:
        master = (
            '<div class="panel"><h2>Contact master</h2>'
            "<p>Empty until someone authorised adds a name here. No seed. No fake Gmails. File: "
            "<code>ops/masters/contacts.json</code>.</p></div>"
        )
    else:
        show_ent = entity not in ("STARQ", "CI")
        head = "<th>Occupancy</th>" if show_ent else ""
        body = "".join(
            "<tr>"
            + (f'<td class="code">{html.escape(r.get("entity") or "—")}</td>' if show_ent else "")
            + f'<td>{html.escape(r.get("kind") or "—")}</td><td>{html.escape(r.get("name") or "—")}</td>'
            f'<td>{html.escape(r.get("phone") or "—") or "—"}</td>'
            f'<td>{html.escape(r.get("email") or "") or "—"}</td>'
            f'<td>{_contact_action_links(entity, qs, r)}</td></tr>'
            for r in rows)
        master = (
            '<div class="panel"><h2>Contact master</h2>'
            "<p>Open a master contact directly into statement / ledger review. "
            "Sales and Expenses shortcuts only prefill an existing contact — no auto-create.</p>"
            f'<table><thead><tr>{head}<th>Type</th><th>Name</th><th>Phone</th><th>Email</th><th>Actions</th></tr></thead>'
            f'<tbody>{body}</tbody></table></div>'
        )
    can = (
        user
        and entity in ("STARQ", "CI")
        and A.may_view_books(user, entity)
        and M.may_create_contact(user.acting_as, entity)
    )
    if derived:
        dbody = []
        master_names = {(r.get("kind"), (r.get("name") or "").casefold()) for r in rows}
        for r in derived:
            add = ""
            call_id = str(r.get("call_event_id") or "")
            already = (r.get("kind"), (r.get("name") or "").casefold()) in master_names
            if can and call_id and r.get("kind") == "customer" and not already:
                add = (
                    f'<form method="post" action="/contacts/from-call?{qs}" style="display:inline">'
                    f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
                    f'<input type="hidden" name="occupancy" value="{html.escape(entity or "")}">'
                    f'<input type="hidden" name="event_id" value="{html.escape(call_id)}">'
                    '<button type="submit">Add CALL party to contacts</button></form>'
                )
            dbody.append(
                f'<tr><td>{html.escape(r.get("kind") or "")}</td><td>{html.escape(r.get("name") or "")}</td>'
                f'<td>{html.escape(r.get("phone") or "")}</td>'
                f'<td>{html.escape(r.get("label") or "ops-derived (not a master)")} {add}</td></tr>'
            )
        dbody = "".join(dbody)
        pipe = (
            '<div class="panel"><h2>Ops-derived names (not masters)</h2>'
            "<p>These appeared on garage ops events. They are not CRM rows. "
            "Add CALL party only when the CALL already has a name string — never invent the name.</p>"
            '<table><thead><tr><th>Type</th><th>Name</th><th>Phone</th><th>Source</th></tr></thead>'
            f'<tbody>{dbody}</tbody></table></div>'
        )
    else:
        pipe = ('<div class="note">No ops-derived customer or vendor name yet. '
                "Smoke / test calls are ignored. This list is not the master.</div>")
    form = ""
    if can:
        form = (
            '<div class="panel"><h2>Add contact</h2>'
            "<p>Name and type only. Occupancy is this books view. Email stays blank — do not invent Gmails.</p>"
            f'<form method="post" action="/contacts/create?{qs}">'
            f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
            f'<input type="hidden" name="occupancy" value="{html.escape(entity or "")}">'
            '<label>Name <input name="name" required maxlength="120"></label> '
            '<label>Type <select name="kind">'
            '<option value="customer">customer</option>'
            '<option value="vendor">vendor</option>'
            '<option value="other">other</option>'
            "</select></label> "
            '<button type="submit">Save to master</button></form></div>'
        )
    elif entity not in ("STARQ", "CI"):
        form = (
            '<div class="note">Open Starq or Club Ignition occupancy to add a contact. '
            "Group is a view, not a third master.</div>"
        )
    elif user and not A.may_view_books(user, entity):
        form = '<div class="note">This occupancy is not yours. Contact master stays on the company you can see.</div>'
    elif user and user.acting_as:
        form = '<div class="note">This seat cannot create contacts.</div>'
    return (
        f'<h1>Contacts</h1><p class="sub">{html.escape(scope_label(entity))} · master is occupancy-scoped. '
        "Ops names below are labeled, not masters. "
        "CRM pipeline uses CALL / ops steps already on disk — will not invent a lead. "
        "Statements open from master contacts only.</p>"
        + _engine_strip(entity)
        + flash + master + _crm_pipeline_panel(entity) + form + pipe
    )


def h_products(acc, entity, dfrom, dto, user=None, notice=None):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    rows = M.products(entity)
    inv_doc = M.inventory()
    inv = {ln.get("sku"): ln for ln in (inv_doc.get("lines") or [])}
    body = []
    for p in rows:
        ln = inv.get(p.get("sku") or "") or {}
        st = ln.get("qty_status") or "—"
        qty = ln.get("qty")
        qty_s = f"{st} {qty}" if st == "counted" and qty is not None else str(st)
        sp = p.get("sell_price_mvr")
        sp_s = "—" if sp in (None, "") else str(sp)
        body.append(
            f'<tr><td class="code">{html.escape(p.get("sku") or "")}</td>'
            f'<td>{html.escape(p.get("name") or "")}</td>'
            f'<td>{html.escape(p.get("type") or "")}</td>'
            f'<td class="code">{html.escape(str(p.get("income_account") or "—"))}</td>'
            f'<td>{html.escape(sp_s)}</td>'
            f'<td>{html.escape("yes" if p.get("active") else "no")}</td>'
            f'<td>{html.escape(qty_s)}</td>'
            f'<td>{html.escape(p.get("note") or "")}</td></tr>'
        )
    pol = html.escape(inv_doc.get("policy") or "")
    flash = ""
    if notice == "counted":
        flash = '<div class="note">Count saved. No journal posted. 1300 still waiting on DEC-008.</div>'
    elif notice == "count_denied":
        flash = '<div class="note err">Count refused. Leftover paint cannot be POS stock. Wrong seat or bad qty.</div>'
    elif notice == "priced":
        flash = '<div class="note">Sell price saved on this occupancy SKU. Empty stays empty. Not posted.</div>'
    elif notice == "price_denied":
        flash = (
            '<div class="note err">Sell price refused. Leftover paint cannot be priced. '
            "Wrong occupancy or seat, or not a number.</div>"
        )
    elif notice == "sku_created":
        flash = '<div class="note">SKU saved. Sell price empty. Qty empty. Not posted.</div>'
    elif notice == "sku_denied":
        flash = (
            '<div class="note err">SKU refused. Leftover paint cannot be created. '
            "Wrong occupancy or seat, duplicate, or empty id/name.</div>"
        )
    countable = [
        ln for ln in (inv_doc.get("lines") or [])
        if ln.get("qty_status") in ("not_counted", "counted") and ln.get("sku") != "INK-PAINT-LEFT"
    ]
    form = ""
    can = user and user.acting_as in M.COUNT_SEATS and entity == "CI" and countable
    if can:
        opts = "".join(
            f'<option value="{html.escape(ln["sku"])}">{html.escape(ln["sku"])}</option>'
            for ln in countable if ln.get("sku")
        )
        qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
        form = (
            '<div class="panel"><h2>Stock take</h2>'
            "<p>Writes qty. Optional unit cost builds a 1300 draft. Does not post. Does not open POS.</p>"
            f'<form method="post" action="/inventory/count?{qs}">'
            f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
            f'<label>SKU <select name="sku">{opts}</select></label> '
            f'<label>Qty <input name="qty" inputmode="decimal" required></label> '
            f'<label>Unit cost MVR <input name="unit_cost" inputmode="decimal" placeholder="optional"></label> '
            '<button type="submit">Record count</button></form></div>'
        )
    price_form = ""
    priceable = [
        p for p in rows
        if (p.get("sku") or "").upper() != "INK-PAINT-LEFT"
        and str(p.get("income_account") or "") != "4300"
        and p.get("active") is not False
    ]
    can_price = (
        user
        and entity in ("STARQ", "CI")
        and A.may_view_books(user, entity)
        and M.may_set_sell_price(user.acting_as, entity)
        and priceable
    )
    if can_price:
        popts = "".join(
            f'<option value="{html.escape(p.get("sku") or "")}">{html.escape(p.get("sku") or "")}</option>'
            for p in priceable if p.get("sku")
        )
        price_form = (
            '<div class="panel"><h2>Sell price</h2>'
            "<p>Optional. Occupancy-scoped. Leave empty to keep or clear null. "
            "Will not invent a figure. Leftover paint cannot be priced. "
            "Starq occupancy still has no shop POS.</p>"
            f'<form method="post" action="/products/price?{qs}">'
            f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
            f'<input type="hidden" name="occupancy" value="{html.escape(entity or "")}">'
            f'<label>SKU <select name="sku">{popts}</select></label> '
            f'<label>Sell price MVR <input name="sell_price_mvr" inputmode="decimal" placeholder="empty = none"></label> '
            '<button type="submit">Save sell price</button></form></div>'
        )
    elif entity not in ("STARQ", "CI"):
        price_form = '<div class="note">Open Starq or Club Ignition occupancy to set a sell price. Group is a view.</div>'
    elif user and entity in ("STARQ", "CI") and not A.may_view_books(user, entity):
        price_form = '<div class="note">This occupancy is not yours. Sell prices stay on the company you can see.</div>'
    elif user and user.acting_as and entity in ("STARQ", "CI"):
        price_form = '<div class="note">This seat cannot set a sell price.</div>'
    sku_form = ""
    can_sku = (
        user
        and entity in ("STARQ", "CI")
        and A.may_view_books(user, entity)
        and M.may_create_sku(user.acting_as, entity)
    )
    if can_sku:
        sku_form = (
            '<div class="panel"><h2>Add SKU</h2>'
            "<p>Id and name only. Sell price and qty stay empty. No seed catalogue. "
            "Leftover paint cannot be created again. Occupancy is this books view.</p>"
            f'<form method="post" action="/products/sku?{qs}">'
            f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
            f'<input type="hidden" name="occupancy" value="{html.escape(entity or "")}">'
            '<label>SKU <input name="sku" required maxlength="40"></label> '
            '<label>Name <input name="name" required maxlength="120"></label> '
            '<button type="submit">Save SKU</button></form></div>'
        )
    elif entity not in ("STARQ", "CI"):
        sku_form = '<div class="note">Open Starq or Club Ignition occupancy to add a SKU. Group is a view.</div>'
    elif user and entity in ("STARQ", "CI") and not A.may_view_books(user, entity):
        sku_form = '<div class="note">This occupancy is not yours. SKUs stay on the company you can see.</div>'
    elif user and user.acting_as and entity in ("STARQ", "CI"):
        sku_form = '<div class="note">This seat cannot create SKUs.</div>'
    if entity == "STARQ":
        pol = (
            "Starq occupancy — 6201/8211 services. No cage qty. No shop POS. "
            "Cage stock and leftover paint stay on Club Ignition."
        )
    elif entity == "CI":
        pol = (inv_doc.get("policy") or "") + " 4300 leftover paint is not for sale."
    else:
        pol = "Group view — occupancy SKUs in the table. Cage qty is Club Ignition, not Starq."
    return (
        f'<h1>Products</h1><p class="sub">{html.escape(scope_label(entity))} · {html.escape(pol)} '
        "sell_price_mvr empty is honest.</p>"
        + flash
        + _engine_strip(entity)
        + '<div class="panel"><table><thead><tr><th>SKU</th><th>Name</th><th>Type</th>'
        '<th>Income</th><th>Sell MVR</th><th>Active</th><th>Qty</th><th>Note</th></tr></thead>'
        f'<tbody>{"".join(body)}</tbody></table></div>'
        + form + price_form + sku_form
        + (f'<p class="sub"><a href="/pos?{qs}">CI till stub</a> — counted stock only. No Starq POS.</p>'
           if entity == "CI" else "")
    )


def h_pos(acc, entity, dfrom, dto, user=None, notice=None):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    if entity != "CI":
        return (
            f'<h1>POS</h1><p class="sub">{html.escape(scope_label(entity))} · no shop POS on Starq occupancy.</p>'
            + _engine_strip(entity)
            + '<div class="note">The till stub lives on Club Ignition occupancy. '
            "Starq sells 4100 / 4110 services through the journal, not a shop floor. "
            "This chrome does not open CI events or CI documents.</div>"
        )
    flash = ""
    if notice == "pos_ok":
        flash = '<div class="note">Stock consumed. Draft on Accounting if unit cost exists. Not posted.</div>'
    elif notice == "pos_sale":
        flash = '<div class="note">Sale draft from master sell_price_mvr. 4200–4230. Not posted. Not 8% GST.</div>'
    elif notice == "pos_denied":
        flash = (
            '<div class="note err">Till refused. No sell price (consume-only), leftover, oversell, '
            "wrong occupancy, or uncounted SKU.</div>"
        )
    lines = POS.sellable_lines()
    if not lines:
        return (
            f'<h1>POS</h1><p class="sub">{html.escape(scope_label(entity))} · CI stub. Consumes counted inventory.</p>'
            + flash + _engine_strip(entity) +
            '<div class="note">No counted SKU on hand. Record a stock take on Products first. '
            "Will not invent qty, a customer, or a sale price. Sale needs sell_price_mvr on Products. "
            "Leftover paint stays off the till.</div>"
            f'<p class="sub"><a href="/products?{qs}">Products / stock take</a></p>'
        )
    form = ""
    can = user and user.acting_as in POS.POS_SEATS
    if can:
        opts = "".join(
            f'<option value="{html.escape(ln["sku"])}">{html.escape(ln["sku"])} · on hand '
            f'{html.escape(str(ln.get("qty")))}</option>'
            for ln in lines if ln.get("sku")
        )
        priced = POS.priced_lines()
        sale_form = ""
        if priced:
            sopts = "".join(
                f'<option value="{html.escape(ln["sku"])}">{html.escape(ln["sku"])} · on hand '
                f'{html.escape(str(ln.get("qty")))} · sell '
                f'{html.escape(str(M.sell_price_mvr(ln.get("sku") or "")))}</option>'
                for ln in priced if ln.get("sku")
            )
            sale_form = (
                '<div class="panel"><h2>Sale (priced SKU)</h2>'
                "<p>Amount is qty × master sell_price_mvr. Not typed here. "
                "Revenue 4200–4230. COGS 5100/1300 only if unit cost exists. No 8% GST. No 4300.</p>"
                f'<form method="post" action="/pos/sell?{qs}">'
                f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
                f'<label>SKU <select name="sku">{sopts}</select></label> '
                f'<label>Qty <input name="qty" inputmode="decimal" required></label> '
                + _contact_select("CI")
                + '<button type="submit">Record sale draft</button></form></div>'
            )
        else:
            sale_form = (
                '<div class="note">No sell_price_mvr on counted SKUs. Consume-only remains. '
                "Set a real price on Products. Will not invent one.</div>"
            )
        form = (
            sale_form
            + '<div class="panel"><h2>Consume counted stock</h2>'
            "<p>No cash amount. No customer. COGS draft 5100/1300 only when unit cost is on the SKU.</p>"
            f'<form method="post" action="/pos/consume?{qs}">'
            f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
            f'<label>SKU <select name="sku">{opts}</select></label> '
            f'<label>Qty <input name="qty" inputmode="decimal" required></label> '
            '<button type="submit">Consume</button></form></div>'
        )
    else:
        form = '<div class="note">Sign in with a till / stores / director seat to consume stock.</div>'
    body = "".join(
        f'<tr><td class="code">{html.escape(ln.get("sku") or "")}</td>'
        f'<td>{html.escape(str(ln.get("qty")))}</td>'
        f'<td>{html.escape(str(ln.get("unit_cost") if ln.get("unit_cost") not in (None, "") else "—"))}</td>'
        f'<td>{html.escape(str(M.sell_price_mvr(ln.get("sku") or "") or "—"))}</td></tr>'
        for ln in lines
    )
    return (
        f'<h1>POS</h1><p class="sub">{html.escape(scope_label(entity))} · stub. Not a shop. '
        "Starq occupancy has no POS tab. Sale only when sell_price_mvr is on the SKU.</p>"
        + flash
        + _engine_strip(entity)
        + '<div class="panel"><h2>Counted on hand</h2>'
        '<table><thead><tr><th>SKU</th><th>Qty</th><th>Unit cost</th><th>Sell MVR</th></tr></thead>'
        f'<tbody>{body}</tbody></table></div>'
        + form
        + _draft_review_panel(entity, types={"POS_CONSUME", "POS_SALE"}, title="Till drafts")
        + f'<p class="sub"><a href="/accounting?{qs}">Draft review</a></p>'
    )


def _books_check_panel(entity):
    """Live `books.py check` line. Journals only. Never merges outbox into books.db."""
    summary = B.check_journals()
    cls = "note" if summary.get("ok") else "note err"
    occ_line = (
        " Outbox drafts below are not in this count and are not posted."
    )
    if entity in ("STARQ", "CI"):
        slot = (summary.get("by_entity") or {}).get(entity) or {}
        occ_line = (
            f" This occupancy’s journals: {int(slot.get('entries') or 0)} entries, "
            f"{int(slot.get('postings') or 0)} postings. "
            "Outbox drafts below are not in this count and are not posted."
        )
    err = ""
    if summary.get("error") and not summary.get("ok"):
        err = f'<pre>{html.escape(str(summary["error"])[:2000])}</pre>'
    return (
        '<div class="panel"><h2>books.py check</h2>'
        f'<div class="{cls}"><b>{html.escape(summary.get("line") or "")}</b>'
        f"{html.escape(occ_line)}</div>{err}"
        "<p>Live journals. Does not post. Does not merge drafts into <code>books.db</code>. "
        "Does not invent a trial-balance figure.</p></div>"
    )


def _aging_table(side: dict, label: str) -> str:
    lines = side.get("lines") or []
    if not lines:
        return f"<p>No open {html.escape(label)} on issued documents.</p>"
    buckets = side.get("buckets") or {}
    bcells = "".join(
        f'<td class="n">{html.escape(str(buckets.get(name) or "0"))}</td>'
        for name, _a, _b in JO.AGING_BUCKETS
    )
    body = "".join(
        f'<tr><td class="code">{html.escape(ln.get("number") or "")}</td>'
        f'<td>{html.escape(ln.get("issued_on") or "undated")}</td>'
        f'<td>{html.escape(ln.get("bucket") or "")}</td>'
        f'<td class="n">{html.escape(ln.get("amount") or "")}</td>'
        f'<td class="n">{html.escape(ln.get("applied") or "")}</td>'
        f'<td class="n">{html.escape(ln.get("remaining") or "")}</td></tr>'
        for ln in lines
    )
    return (
        f"<h3>{html.escape(label)}</h3>"
        f'<p>Open {html.escape(str(side.get("total") or "0"))}. '
        "Buckets from issued date. Tax from the tax master (live 0). "
        "Named cash/wallet receipts/pays on disk reduce open. GRN qty does not.</p>"
        '<table><thead><tr><th>Current</th><th>31-60</th><th>61-90</th><th>90+</th></tr></thead>'
        f'<tbody><tr>{bcells}</tr></tbody></table>'
        '<table><thead><tr><th>Number</th><th>Issued</th><th>Bucket</th>'
        '<th class="n">Amount</th><th class="n">Applied</th><th class="n">Open</th></tr></thead>'
        f'<tbody>{body}</tbody></table>'
    )


def _aging_panel(entity):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>AR/AP aging</h2>'
            "<p>Pick Starq or Club Ignition occupancy. Group is not a company. "
            "Will not invent aging.</p></div>"
        )
    report = JO.aging(occ)
    if report.get("empty"):
        return (
            '<div class="panel"><h2>AR/AP aging</h2>'
            f'<p>{html.escape(scope_label(entity))} · from issued PO/INV and named receipts on disk. '
            "issued=0 shows empty honest, not fake buckets.</p>"
            f'<div class="note"><b>Empty honest:</b> {html.escape(report.get("reason") or "")} '
            f'Tax {html.escape(str(report.get("tax")))}. DEC-008 — not posted GL.</div></div>'
        )
    return (
        '<div class="panel"><h2>AR/AP aging</h2>'
        f'<p>{html.escape(scope_label(entity))} · issued documents only. '
        f'As of {html.escape(report.get("as_of") or "")}. '
        "Occupancy-correct. Tax 0 until GST is Active.</p>"
        + _aging_table(report.get("ar") or {}, "Accounts receivable (issued INV)")
        + _aging_table(report.get("ap") or {}, "Accounts payable (issued PO)")
        + "</div>"
    )


def _statement_panel(entity, contact_id=""):
    occ = entity if entity in ("STARQ", "CI") else None
    if not occ:
        return (
            '<div class="panel"><h2>Statement of account</h2>'
            "<p>Pick Starq or Club Ignition. Will not invent a customer.</p></div>"
        )
    master = M.contacts(occ)
    if not master:
        return (
            '<div class="panel"><h2>Statement of account</h2>'
            f'<p>{html.escape(scope_label(entity))} · needs a master <code>contact_id</code>.</p>'
            '<div class="note"><b>contacts []</b> — Will not invent a customer or a statement. '
            "Add someone on Contacts first. Ops-derived names are not masters.</div></div>"
        )
    cid = str(contact_id or "").strip()
    if not cid:
        opts = "".join(
            f'<option value="{html.escape(r.get("id") or "")}">'
            f'{html.escape(r.get("id") or "")} · {html.escape(r.get("name") or "")}</option>'
            for r in master if isinstance(r, dict)
        )
        return (
            '<div class="panel"><h2>Statement of account</h2>'
            "<p>Issued PO/INV for a contact already on this occupancy master. "
            "Will not invent a customer.</p>"
            f'<form method="get"><input type="hidden" name="entity" value="{html.escape(occ)}"/>'
            f'<label>contact_id <select name="contact_id">{opts}</select></label> '
            '<button type="submit">Statement</button></form></div>'
        )
    stmt, err = JO.statement_of_account(occ, cid)
    if err or stmt is None:
        return (
            '<div class="panel"><h2>Statement of account</h2>'
            f'<div class="note err">{html.escape(err or "Statement refused.")}</div></div>'
        )
    if stmt.get("empty"):
        return (
            '<div class="panel"><h2>Statement of account</h2>'
            f'<p>{html.escape(stmt.get("contact_id") or "")} · '
            f'{html.escape(stmt.get("contact_name") or "")}. '
            f'{html.escape(stmt.get("reason") or "")}</p></div>'
        )
    body = "".join(
        f'<tr><td class="code">{html.escape(ln.get("number") or "")}</td>'
        f'<td>{html.escape(ln.get("kind") or "")}</td>'
        f'<td class="n">{html.escape(ln.get("amount") or "")}</td>'
        f'<td class="n">{html.escape(ln.get("applied") or "")}</td>'
        f'<td class="n">{html.escape(ln.get("remaining") or "")}</td></tr>'
        for ln in stmt.get("lines") or []
    )
    return (
        '<div class="panel"><h2>Statement of account</h2>'
        f'<p>{html.escape(stmt.get("contact_id") or "")} · '
        f'{html.escape(stmt.get("contact_name") or "")} · '
        f'open {html.escape(stmt.get("open") or "0")}. Tax {html.escape(str(stmt.get("tax")))}.</p>'
        '<table><thead><tr><th>Number</th><th>Kind</th>'
        '<th class="n">Amount</th><th class="n">Applied</th><th class="n">Open</th></tr></thead>'
        f'<tbody>{body}</tbody></table></div>'
    )


def h_reports(acc, entity, dfrom, dto, contact_id=""):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    return (
        f'<h1>Reports</h1><p class="sub">{html.escape(scope_label(entity))} · books reports. '
        "Dashboard is command home; Overview is the five-card recap. "
        "Check is journals only. Outbox is DRAFT — not posted.</p>"
        + _engine_strip(entity)
        + _books_check_panel(entity)
        + '<div class="cards">'
        f'<a class="card" href="/overview?{qs}"><div class="k">Overview</div><div class="n">Five cards</div></a>'
        f'<a class="card" href="/tb?{qs}"><div class="k">Trial balance</div><div class="n">Cumulative</div></a>'
        f'<a class="card" href="/pl?{qs}"><div class="k">Profit &amp; loss</div><div class="n">Income and expense</div></a>'
        f'<a class="card" href="/bs?{qs}"><div class="k">Balance sheet</div><div class="n">As at To date</div></a>'
        f'<a class="card" href="/accounting?{qs}"><div class="k">Accounting</div><div class="n">Outbox drafts, not auto-post</div></a>'
        "</div>"
        + _aging_panel(entity)
        + _statement_panel(entity, contact_id)
        + _inventory_valuation_panel(entity)
        + _sales_summary_panel(entity)
        + _payroll_summary_panel(entity)
        + _draft_review_panel(
            entity,
            include_counts=True,
            title="Outbox — DRAFT, not posted",
        )
    )


def h_accounting(acc, entity, dfrom, dto, contact_id=""):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    tax = M.tax()
    pos_link = ""
    if entity == "CI":
        pos_link = f'<a class="card" href="/pos?{qs}"><div class="k">POS stub</div><div class="n">CI counted stock only</div></a>'
    return (
        f'<h1>Accounting</h1><p class="sub">{html.escape(scope_label(entity))} · the consequence engine. '
        "Drafts are proposals. Journals remain SSOT. Check does not merge drafts.</p>"
        + _engine_strip(entity)
        + _books_check_panel(entity)
        + '<div class="cards">'
        f'<a class="card" href="/journal?{qs}"><div class="k">Journal</div><div class="n">Source of truth</div></a>'
        f'<a class="card" href="/accounts?{qs}"><div class="k">Chart of accounts</div><div class="n">includes 1300</div></a>'
        f'<a class="card" href="/transactions?{qs}"><div class="k">Ops</div><div class="n">Events log until GL posts</div></a>'
        + pos_link +
        "</div>"
        f'<div class="note"><b>Tax:</b> GST {html.escape(str(tax.get("gst_status")))}. '
        f'Live invoice rate {html.escape(str(tax.get("live_invoice_rate")))}%. '
        f'{html.escape(tax.get("note") or "")}</div>'
        + _aging_panel(entity)
        + _statement_panel(entity, contact_id)
        + _draft_review_panel(
            entity,
            include_counts=True,
            title="Outbox — DRAFT, not posted",
            show_validate=True,
        )
    )


def h_transactions(acc, entity, dfrom, dto):
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    posted, summary = _posted_journal_rows(entity, limit=25)
    if posted:
        body = "".join(
            f'<tr><td>{html.escape(r["date"] or "")}</td>'
            f'<td>{html.escape(r["entity"] or "")}</td>'
            f'<td>{html.escape(r["narration"] or "")}</td>'
            f'<td class="n">{(r["v"] or 0):,.2f}</td></tr>'
            for r in posted
        )
    else:
        body = '<tr><td colspan="4">No posted journal entries in this occupancy.</td></tr>'
    gl_note = (
        '<p>Posted books from <code>journals/</code> via <code>books.py check</code>. '
        "Not fused with ops events. Outbox drafts are not in this table.</p>"
    )
    if summary.get("error") and not summary.get("ok"):
        gl_note += f'<div class="note err"><pre>{html.escape(str(summary["error"])[:1200])}</pre></div>'
    return (
        f'<h1>Ops</h1><p class="sub">{html.escape(scope_label(entity))} · transactions log until GL posts. '
        "Ops events on disk are the transaction feed (DEC-008). Posted journals are separate — "
        "not fused. Will not invent amounts.</p>"
        + _engine_strip(entity)
        + _ops_txn_panel(entity, limit=40)
        + '<div class="panel"><h2>Posted journals</h2>'
        + gl_note
        + '<table><thead><tr><th>Date</th><th>Entity</th><th>Narration</th>'
        '<th class="n">Value</th></tr></thead>'
        f'<tbody>{body}</tbody></table></div>'
    )


def h_settings(acc, entity, dfrom, dto, user=None, notice=None):
    org = M.org_for_entity(entity)
    locs = M.locations(entity)
    if org:
        bn = "".join(
            f'<li>{html.escape(x.get("name") or "")} · {html.escape(x.get("bn") or "")} · '
            f'ISIC {html.escape(str(x.get("isic") or "—"))}</li>'
            for x in org.get("business_names") or [])
        head = (
            f'<h2>{html.escape(org["legal_name"])}</h2>'
            f'<p class="sub">C {html.escape(org["registry_c"])} · entity {html.escape(org["entity"])} · '
            f'{html.escape(org["base_currency"])} · GST {html.escape(str(org.get("gst_status")))}</p>'
            f'<p>Modules: {html.escape(", ".join(org.get("modules") or []))} · '
            f'Shop POS: {"yes" if org.get("pos") else "no"}</p>'
            f'<ul>{bn}</ul>'
        )
        seq = org.get("sequences") or {}
        if seq:
            srows = "".join(
                f'<tr><td class="code">{html.escape(k)}</td>'
                f'<td>{html.escape(str(v.get("prefix") or ""))}</td>'
                f'<td>{html.escape(str(v.get("next") if "next" in v else v.get("source") or "—"))}</td>'
                f'<td>{html.escape(str(v.get("issued") if "issued" in v else "—"))}</td></tr>'
                for k, v in seq.items() if isinstance(v, dict))
            head += (
                '<div class="panel"><h2>Document numbers</h2>'
                "<p>Prefixes reserved. Next number is shown. Issued increments only when an authorised "
                "seat issues a valued document. Award does not allocate. Job numbers still come from ops state.</p>"
                '<table><thead><tr><th>Doc</th><th>Prefix</th><th>Next / source</th><th>Issued</th></tr></thead>'
                f'<tbody>{srows}</tbody></table></div>'
            )
    elif not entity:
        head = (
            "<h2>Group</h2><p class=\"sub\">Ali’s consolidation view. Not a company. "
            "Switch to Starq or Club Ignition for occupancy settings.</p>"
        )
    else:
        head = "<p class=\"sub\">No organization record for this entity.</p>"
    loc_body = "".join(
        f'<tr><td>{html.escape(x.get("name") or "")}</td><td>{html.escape(x.get("kind") or "")}</td>'
        f'<td>{html.escape("yes" if x.get("is_warehouse") else "no")}</td>'
        f'<td>{html.escape(x.get("note") or "")}</td></tr>'
        for x in locs) or '<tr><td colspan="4">None</td></tr>'
    people = M.users(entity)
    people_body = "".join(
        f'<tr><td class="code">{html.escape(u.get("person_id") or "")}</td>'
        f'<td>{html.escape(u.get("label") or "")}</td>'
        f'<td>{html.escape(u.get("status") or "")}</td>'
        f'<td>{html.escape(", ".join(u.get("entities") or []))}</td>'
        f'<td>{html.escape(", ".join(u.get("seats") or []))}</td></tr>'
        for u in people) or '<tr><td colspan="5">None</td></tr>'
    qs = f"entity={entity or ''}&from={dfrom or ''}&to={dto or ''}"
    flash = ""
    if notice == "emp_created":
        flash = (
            '<div class="note">Employee saved on this occupancy roster. Name and seat only. '
            "No salary invented. users.json unchanged. Journals untouched.</div>"
        )
    elif notice == "emp_denied":
        flash = (
            '<div class="note err">Employee refused. Wrong occupancy or seat, empty name, '
            "Nashid on Starq, or that name+seat is already on this roster.</div>"
        )
    elif notice == "rate_set":
        flash = (
            '<div class="note">Payroll rate saved on this occupancy. Optional — empty clears. '
            "Payroll GL draft only when rate_mvr is on disk. Journals untouched.</div>"
        )
    elif notice == "rate_denied":
        flash = (
            '<div class="note err">Payroll rate refused. Wrong seat, occupancy, employee id, '
            "or not a positive number. Will not invent pay.</div>"
        )
    elif notice == "loc_created":
        flash = (
            '<div class="note">Location saved on this occupancy. Name and type only. '
            "No shop POS site. Journals untouched.</div>"
        )
    elif notice == "loc_denied":
        flash = (
            '<div class="note err">Location refused. Wrong occupancy or seat, empty name, '
            "shop/POS type, Starq garage/godown, leftover paint, or duplicate.</div>"
        )
    if entity in ("STARQ", "CI"):
        staff = M.employees(entity)
    else:
        staff = []
    if not staff:
        hr_master = (
            '<div class="panel"><h2>HR / payroll</h2>'
            "<p>Empty until someone authorised adds a name and job seat here. No seed. "
            "No invented pay. Login people stay in <code>users.json</code> above — "
            "this file is employment, not a second people master. "
            "<code>ops/masters/payroll.json</code>.</p></div>"
        )
    else:
        hbody = "".join(
            f'<tr><td class="code">{html.escape(r.get("id") or "")}</td>'
            f'<td>{html.escape(r.get("name") or "")}</td>'
            f'<td>{html.escape(r.get("seat") or "")}</td>'
            f'<td class="code">{html.escape(r.get("person_id") or "—")}</td>'
            f'<td>{html.escape("—" if r.get("rate_mvr") in (None, "") else str(r.get("rate_mvr")))}</td></tr>'
            for r in staff)
        hr_master = (
            '<div class="panel"><h2>HR / payroll</h2>'
            "<p>Employment on this occupancy. Rate stays blank until Ali writes a real figure. "
            "Payroll GL draft refuses while rates are empty.</p>"
            '<table><thead><tr><th>Id</th><th>Name</th><th>Seat</th><th>person_id</th><th>Rate</th></tr></thead>'
            f'<tbody>{hbody}</tbody></table></div>'
        )
    hr_rate_form = ""
    can_rate = (
        user
        and entity in ("STARQ", "CI")
        and staff
        and A.may_view_books(user, entity)
        and M.may_set_employee_rate(user.acting_as, entity)
    )
    if can_rate:
        ropts = "".join(
            f'<option value="{html.escape(r.get("id") or "")}">'
            f'{html.escape(r.get("id") or "")} · {html.escape(r.get("name") or "")}</option>'
            for r in staff if r.get("id")
        )
        hr_rate_form = (
            '<div class="panel"><h2>Payroll rate</h2>'
            "<p>Optional <code>rate_mvr</code> on an employment row. Ali types a real figure. "
            "Leave empty to clear. Payroll GL draft refuses while rates are empty. "
            "Will not invent salaries.</p>"
            f'<form method="post" action="/payroll/rate?{qs}">'
            f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
            f'<input type="hidden" name="occupancy" value="{html.escape(entity or "")}">'
            f'<label>Employee <select name="employee_id">{ropts}</select></label> '
            '<label>Rate MVR <input name="rate_mvr" inputmode="decimal" placeholder="empty = none"></label> '
            '<button type="submit">Save rate</button></form></div>'
        )
    elif staff and entity in ("STARQ", "CI") and user and user.acting_as and not M.may_set_employee_rate(user.acting_as, entity):
        hr_rate_form = '<div class="note">This seat cannot set payroll rates.</div>'
    hr_form = ""
    can_hr = (
        user
        and entity in ("STARQ", "CI")
        and A.may_view_books(user, entity)
        and M.may_create_employee(user.acting_as, entity)
    )
    if can_hr:
        opts = "".join(
            f'<option value="{html.escape(s)}">{html.escape(A.SEATS.get(s, {}).get("label", s))}</option>'
            for s in sorted(M.JOB_SEATS)
        )
        hr_form = (
            '<div class="panel"><h2>Add employee</h2>'
            "<p>Name and job seat only. Occupancy is this books view. No salary field. "
            "If the name already is a users.json person on this occupancy, person_id is linked. "
            "Otherwise it stays blank — we do not invent logins or Gmails.</p>"
            f'<form method="post" action="/payroll/employee?{qs}">'
            f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
            f'<input type="hidden" name="occupancy" value="{html.escape(entity or "")}">'
            '<label>Name <input name="name" required maxlength="120"></label> '
            f'<label>Seat <select name="seat">{opts}</select></label> '
            '<button type="submit">Save to roster</button></form></div>'
        )
    elif entity not in ("STARQ", "CI"):
        hr_form = (
            '<div class="note">Open Starq or Club Ignition occupancy to add an employee. '
            "Group is a view, not a third roster.</div>"
        )
    elif user and not A.may_view_books(user, entity):
        hr_form = '<div class="note">This occupancy is not yours. HR roster stays on the company you can see.</div>'
    elif user and user.acting_as:
        hr_form = '<div class="note">This seat cannot create employees.</div>'
    loc_form = ""
    can_loc = (
        user
        and entity in ("STARQ", "CI")
        and A.may_view_books(user, entity)
        and M.may_create_location(user.acting_as, entity)
    )
    if can_loc:
        loc_opts = "".join(
            f'<option value="{html.escape(k)}">{html.escape(k)}</option>'
            for k in sorted(M.LOCATION_KINDS)
        )
        loc_form = (
            '<div class="panel"><h2>Add location</h2>'
            "<p>Name and type only. Occupancy is this books view. Not a shop POS. "
            "Does not invent a shop floor.</p>"
            f'<form method="post" action="/locations/create?{qs}">'
            f'<input type="hidden" name="csrf" value="{html.escape(user.csrf or "")}">'
            f'<input type="hidden" name="occupancy" value="{html.escape(entity or "")}">'
            '<label>Name <input name="name" required maxlength="120"></label> '
            f'<label>Type <select name="kind">{loc_opts}</select></label> '
            '<button type="submit">Save location</button></form></div>'
        )
    elif entity not in ("STARQ", "CI"):
        loc_form = (
            '<div class="note">Open Starq or Club Ignition occupancy to add a location. '
            "Group is a view, not a third site list.</div>"
        )
    elif user and not A.may_view_books(user, entity):
        loc_form = '<div class="note">This occupancy is not yours. Locations stay on the company you can see.</div>'
    elif user and user.acting_as:
        loc_form = '<div class="note">This seat cannot create locations.</div>'
    return (
        f'<h1>Settings</h1><p class="sub">{html.escape(scope_label(entity))} · company, locations, users, permissions. '
        "Live Gmails stay in the gitignored allowlist. HR is occupancy employment, not a second people file.</p>"
        + _engine_strip(entity)
        + flash
        + f'<div class="panel">{head}</div>'
        '<div class="panel"><h2>Locations</h2>'
        + (
            "<p>H. Kiev godown stays on this occupancy until you add another real site. "
            "Create is name + type. No shop POS. No seed shops.</p>"
            if entity == "CI"
            else "<p>Starq occupancy has no shop floor. Create is name + type. No seed shops.</p>"
            if entity == "STARQ"
            else "<p>Locations are occupancy-scoped. Switch company to add a site. Group is not a third site list.</p>"
        )
        + '<table><thead><tr><th>Name</th><th>Kind</th><th>Warehouse</th><th>Note</th></tr></thead>'
        f'<tbody>{loc_body}</tbody></table></div>'
        + loc_form +
        '<div class="panel"><h2>Users</h2>'
        '<table><thead><tr><th>person_id</th><th>Label</th><th>Status</th><th>Entities</th><th>Seats</th></tr></thead>'
        f'<tbody>{people_body}</tbody></table></div>'
        + hr_master + hr_rate_form + hr_form +
        _perm_matrix_panel() +
        _audit_panel(entity) +
        '<div class="note">Nashid never sees Starq occupancy. Ledger poster still appends journals by hand (DEC-008). '
        f'{html.escape(M.payroll().get("note") or "")}</div>'
    )


def h_tb(acc, entity, dfrom, dto):
    rows, td, tc = report_tb(acc, entity, dto)
    body = "".join(
        f'<tr><td class="code">{c}</td><td><a href="{acct_link(c, entity, dfrom, dto)}">{html.escape(nm)}</a></td>'
        f'<td class="n">{money(d) if d else ""}</td><td class="n">{money(cr) if cr else ""}</td></tr>'
        for c, nm, d, cr in rows)
    warn = "" if td == tc else f'<div class="note err"><b>Out of balance by {money(td - tc)}.</b></div>'
    # The TB is cumulative; the From date does not apply (explained on /notes).
    return (f'<h1>Trial balance</h1><p class="sub">{html.escape(scope_label(entity))}'
            + (f' · as at {dto}' if dto else '') + '</p>' + warn +
            '<div class="panel"><table><thead><tr><th>Code</th><th>Account</th>'
            '<th class="n">Debit</th><th class="n">Credit</th></tr></thead><tbody>'
            + body + f'<tr class="total"><td></td><td>Total</td><td class="n">{money(td)}</td>'
            f'<td class="n">{money(tc)}</td></tr></tbody></table></div>')


def h_pl(acc, entity, dfrom, dto):
    out, tot, net = report_pl(acc, entity, dfrom, dto)
    def block(title, key):
        if not out[key]:
            return f'<tr class="sub"><td colspan="3">{title}</td></tr><tr><td colspan="3" style="color:var(--muted)">none</td></tr>'
        rows = "".join(
            f'<tr><td class="code">{c}</td><td><a href="{acct_link(c, entity, dfrom, dto)}">{html.escape(n)}</a></td>'
            f'<td class="n {signed_class(v)}">{money(v)}</td></tr>' for c, n, v in out[key])
        return (f'<tr class="sub"><td colspan="3">{title}</td></tr>{rows}'
                f'<tr class="sub"><td></td><td>Total {title.lower()}</td>'
                f'<td class="n">{money(tot[key])}</td></tr>')
    word = "Net profit" if net >= 0 else "Net loss"
    return (f'<h1>Profit and loss</h1><p class="sub">{html.escape(scope_label(entity))} · '
            f'{dfrom or "inception"} to {dto or "date"}</p>'
            '<div class="panel"><table><thead><tr><th>Code</th><th>Account</th>'
            f'<th class="n">MVR</th></tr></thead><tbody>{block("Income", "INCOME")}'
            f'{block("Cost of sales and expenses", "EXPENSE")}'
            f'<tr class="total"><td></td><td>{word}</td><td class="n">{money(abs(net))}</td></tr>'
            '</tbody></table></div>')


def h_bs(acc, entity, dfrom, dto):
    groups, totals, result = report_bs(acc, entity, dto)
    names = {"ASSET": "Assets", "LIABILITY": "Liabilities", "EQUITY": "Equity"}
    parts = []
    for g in ("ASSET", "LIABILITY", "EQUITY"):
        rows = "".join(
            f'<tr><td class="code">{c}</td><td><a href="{acct_link(c, entity, dfrom, dto)}">{html.escape(n)}</a></td>'
            f'<td class="n {signed_class(v)}">{money(v)}</td></tr>' for c, n, v in groups[g])
        if g == "EQUITY":
            rows += (f'<tr><td class="code">—</td><td>Result for the period</td>'
                     f'<td class="n {signed_class(result)}">{money(result)}</td></tr>')
        if not rows:
            rows = '<tr><td colspan="3" style="color:var(--muted)">none</td></tr>'
        parts.append(f'<tr class="sub"><td colspan="3">{names[g]}</td></tr>{rows}'
                     f'<tr class="sub"><td></td><td>Total {names[g].lower()}</td>'
                     f'<td class="n">{money(totals[g])}</td></tr>')
    lhs, rhs = totals["ASSET"], totals["LIABILITY"] + totals["EQUITY"]
    ok = ('<span class="pill ok">balanced</span>' if lhs == rhs
          else f'<span class="pill warn">out by {money(lhs - rhs)}</span>')
    # The BS is a position as at a date; From does not apply (explained on /notes).
    return (f'<h1>Balance sheet</h1><p class="sub">{html.escape(scope_label(entity))}'
            + (f' · as at {dto}' if dto else '') + f' &nbsp; {ok}</p>'
            '<div class="panel"><table><thead><tr><th>Code</th><th>Account</th>'
            f'<th class="n">MVR</th></tr></thead><tbody>{"".join(parts)}</tbody></table></div>')


def h_journal(acc, entity, code, dfrom=None, dto=None):
    if code and code in acc:
        rows, opening = report_ledger(acc, code, entity, dfrom, dto)
        body = ""
        if dfrom:
            body += (f'<tr><td class="code">{dfrom}</td><td></td>'
                     '<td style="color:var(--muted)">Balance brought forward</td><td class="n"></td>'
                     f'<td class="n {signed_class(opening)}">{money(opening)}</td></tr>')
        body += "".join(
            f'<tr><td class="code">{d}</td><td>{epill(e)}</td>'
            f'<td>{html.escape(nr)}'
            + (f'<br><span class="code">{html.escape(rf)}</span>' if rf else "")
            + (f'<br><span class="code">{html.escape(dc)}</span>' if dc else "")
            + f'</td><td class="n {signed_class(a)}">{money(a)}</td>'
              f'<td class="n {signed_class(r)}">{money(r)}</td></tr>'
            for d, e, nr, rf, dc, a, r in rows)
        # Only a genuine anomaly stays inline; the sign convention itself is
        # documented on the Notes tab.
        note = ""
        if rows and acc[code]["type"] in B.NATURAL_CREDIT and rows[-1][6] > 0:
            note = (f'<div class="note"><b>Closing balance {money(rows[-1][6])} DEBIT — unusual '
                    'for this account.</b> Accounts of this type normally carry a credit balance; '
                    'check the postings. Sign convention is on the Notes tab.</div>')
        span = ""
        if dfrom or dto:
            span = f' · {dfrom or "inception"} to {dto or "date"}'
        return (f'<h1>{html.escape(acc[code]["name"])}</h1>'
                f'<p class="sub">Account {code} · {html.escape(scope_label(entity))}{span}</p>{note}'
                '<div class="panel"><table><thead><tr><th>Date</th><th>Entity</th><th>Narration</th>'
                '<th class="n">Amount</th><th class="n">Balance</th></tr></thead><tbody>'
                + (body or '<tr><td colspan="5" style="color:var(--muted)">no movements</td></tr>')
                + '</tbody></table></div>')

    where, args = [], []
    if entity:
        where.append("e.entity=?")
        args.append(entity)
    if dfrom:
        where.append("e.date>=?")
        args.append(dfrom)
    if dto:
        where.append("e.date<=?")
        args.append(dto)
    sql = ("SELECT e.id,e.date,e.entity,e.narration,e.ref,e.doc,e.source,e.line_no FROM entry e"
           + (" WHERE " + " AND ".join(where) if where else "")
           + " ORDER BY e.date DESC, e.id DESC")
    out = []
    for r in q(sql, tuple(args)):
        ps = q("SELECT account,amount,memo FROM posting WHERE entry_id=? ORDER BY id", (r["id"],))
        lines = "".join(
            f'<tr><td class="code">{p["account"]}</td><td>{html.escape(acc[p["account"]]["name"])}'
            + (f' <span class="code">{html.escape(p["memo"])}</span>' if p["memo"] else "")
            + f'</td><td class="n {signed_class(Decimal(p["amount"]))}">{money(Decimal(p["amount"]))}</td></tr>'
            for p in ps)
        meta = " · ".join(x for x in [r["ref"], f'{r["source"]}:{r["line_no"]}'] if x)
        out.append(
            f'<div class="panel"><h2>{r["date"]} &nbsp;{epill(r["entity"])}&nbsp; '
            f'{html.escape(r["narration"])}</h2><table><tbody>{lines}</tbody></table>'
            f'<div style="padding:9px 18px;font-size:12px" class="code">{html.escape(meta)}'
            + (f' · {html.escape(r["doc"])}' if r["doc"] else "") + '</div></div>')
    span = "every entry, newest first"
    if dfrom or dto:
        span = f'entries {dfrom or "inception"} to {dto or "date"}, newest first'
    return (f'<h1>Journal</h1><p class="sub">{html.escape(scope_label(entity))} · {span}</p>'
            + ("".join(out) or '<div class="note">No entries in this scope.</div>'))


def h_accounts(acc, entity, dfrom=None, dto=None):
    rows = []
    for a in B.load_accounts().values():
        if a["heading"]:
            rows.append(f'<tr class="sub"><td colspan="5">{a["code"]} · {html.escape(a["name"])}</td></tr>')
            continue
        note = html.escape(a["note"])
        blocked = a["status"] == "blocked"
        # Scope and blocked status are enforced at post time, so show them as
        # facts about the account rather than burying them in the note text.
        scope = a["entities"]
        if scope == "STARQ" and not A.may_view_entity(A.current_user(), "starq"):
            continue
        scope_cell = ('<span class="pill">both</span>' if scope == "BOTH"
                      else f'<span class="pill warn">{ENTITY_SHORT.get(scope, scope)} only</span>')
        cls = "warn" if blocked or note.startswith(("Only", "Intercompany")) else ""
        label = ("⛔ BLOCKED — " + note) if blocked else note
        rows.append(
            f'<tr><td class="code">{a["code"]}</td>'
            f'<td><a href="{acct_link(a["code"], entity, dfrom, dto)}">{html.escape(a["name"])}</a></td>'
            f'<td><span class="pill">{a["type"]}</span></td>'
            f'<td>{scope_cell}</td>'
            f'<td>{f"<span class=\'pill {cls}\'>{label}</span>" if label else ""}</td></tr>')
    return ('<h1>Chart of accounts</h1>'
            '<p class="sub">Edit <code>accounts.csv</code> to change it. '
            '<b>Scope</b> is enforced — an account marked for one company cannot be posted in the '
            'other\'s journals. <b>Blocked</b> accounts are refused at post time, because the '
            'activity is outside that company\'s Business Activity Registration.</p>'
            '<div class="panel"><table><thead><tr><th>Code</th><th>Account</th><th>Type</th>'
            f'<th>Scope</th><th>Note</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>')


def h_notes(entity, user=None, notice=None):
    """Local occupancy notes (append-only file) plus read-only report guidance."""
    user = user or A.current_user()
    slug = _notes_slug(entity)
    local = load_local_notes(entity)
    flash = ""
    if notice == "note_appended":
        flash = '<div class="note">Note appended to the local file. Not a journal post.</div>'
    elif notice == "note_denied":
        flash = '<div class="note err">Note refused. Empty, too long, or no permission.</div>'
    append_form = ""
    if user and A.may_reply_decisions(user):
        append_form = (
            f'<form method="post" action="/notes/append">'
            f'<input type="hidden" name="entity" value="{entity or ""}">'
            f'<input type="hidden" name="csrf" value="{html.escape(A.csrf_token(user), quote=True)}">'
            '<label>Append a note <textarea name="text" rows="3" maxlength="4000" required '
            'placeholder="Free-form note for this occupancy — not a journal entry"></textarea></label>'
            '<button type="submit">Append</button></form>'
        )
    local_body = (
        f'<pre style="white-space:pre-wrap;margin:0">{html.escape(local)}</pre>'
        if local.strip()
        else '<div class="note">No local notes yet. Empty file until you append one.</div>'
    )
    group_panel = ""
    if A.may_view_entity(user, "group") or A.may_view_entity(user, "starq"):
        group_panel = (
        '<div class="panel"><h2>The Group view — why intercompany is eliminated</h2>'
        '<div style="padding:16px 18px;font-size:14px;line-height:1.7">'
        '<p style="margin:0 0 10px">The Group view adds both companies together and then drops the '
        'balances they hold <i>against each other</i>. Concrete example: Starq\u2019s books carry '
        '<b>MVR 102,000</b> as \u201cInvestment in subsidiary\u201d (account 1600) — its 51 shares in Club '
        'Ignition — and, until that subscription is actually paid, a matching MVR 102,000 owed to '
        'Club Ignition (2490). Club Ignition\u2019s books show the same money on its own side. Add the '
        'two balance sheets naively and the same 102,000 appears twice — once as Starq\u2019s asset, '
        'once inside CI\u2019s capital. So the group view drops accounts <span class="code">1290</span>, '
        '<span class="code">2490</span> and <span class="code">1600</span>: money the group owes '
        'itself is not money.</p>'
        '<p style="margin:0">This is a <b>management view, not statutory consolidation</b>. It does not '
        'compute non-controlling interest — Nashid\u2019s 49% of Club Ignition is not carved out — nor '
        'goodwill, nor elimination of unrealised intra-group profit. It answers one question: how much '
        'money does the group have, ignoring what the two companies owe each other. Year-end '
        'consolidation is the accountant\u2019s job.</p></div></div>'
        )
    return (
        '<h1>Notes</h1>'
        f'<p class="sub">{html.escape(scope_label(entity))} · local notes + how to read reports</p>'
        + flash
        + f'<div class="panel"><h2>Local notes ({html.escape(slug)})</h2>'
        f'<p>Append-only file on D: (<code>ops/notes/{html.escape(slug)}.txt</code>). '
        "Not journals. Not GL.</p>"
        + local_body
        + append_form
        + "</div>"
        + group_panel +
        '<details class="arch"><summary>How to read the reports (reference)</summary>'
        '<div class="panel"><h2>Director funding — the 2400 / 2410 assumption</h2>'
        '<div style="padding:16px 18px;font-size:14px;line-height:1.7">'
        '<p style="margin:0 0 10px">Pre-incorporation and registration costs are booked as '
        '<b>personally funded by the directors</b>: account <span class="code">2400</span> Due to '
        'director (Ali) and <span class="code">2410</span> Due to Managing Director (Nashid, CI only). '
        'That is an <b>assumption</b>, flagged in the journals themselves — if any item was in fact '
        'paid with company money (card or wallet), the credit side must be re-posted (e.g. 2410 '
        '\u2192 1125) before anyone is repaid.</p>'
        '<p style="margin:0">Every balance on these accounts is a related-party item and needs '
        'minuting. The workings are in '
        '<span class="code">BANK-RECONCILIATION-REGISTER.md</span>.</p></div></div>'

        '<div class="panel"><h2>How the date filters behave</h2>'
        '<div style="padding:16px 18px;font-size:14px;line-height:1.7">'
        '<p style="margin:0 0 10px"><b>Profit &amp; loss</b> uses the full From\u2013To range. '
        '<b>Trial balance</b> and <b>balance sheet</b> are cumulative positions <i>as at</i> the To '
        'date — the From date does not apply to them and is ignored there by design.</p>'
        '<p style="margin:0">An account <b>ledger</b> honours both dates: everything before From is '
        'collapsed into a single \u201cBalance brought forward\u201d row, so the running balance stays '
        'truthful; movements after To are simply not shown.</p></div></div>'

        '<div class="panel"><h2>Reading a ledger — the sign convention</h2>'
        '<div style="padding:16px 18px;font-size:14px;line-height:1.7">'
        '<p style="margin:0">Amounts are signed: <b>debits positive, credits negative</b>. Liability, '
        'equity and income accounts naturally carry credit (negative) balances — a negative number on '
        'those is normal, and the reports flip the sign for display where it reads better. A ledger '
        'that shows a <i>debit</i> closing balance on one of those accounts gets an inline warning, '
        'because that is usually a posting error.</p></div></div></details>'
    )


def _dec_head(d, pill):
    return (f'<h2>{html.escape(d.get("id", "?"))} · {html.escape(d.get("title", ""))} '
            f'&nbsp;{pill}</h2>')


def _dec_meta(d):
    return (f'<span class="meta code">raised by {html.escape(d.get("raised_by", "?"))} · '
            f'{html.escape((d.get("raised_at") or "")[:16].replace("T", " "))}</span>')


def h_decisions(entity):
    user = A.current_user()
    items = [
        d for d in load_decisions()
        if A.decision_visible(d, user) and A.decision_starqbooks_relevant(d)
    ]
    opens = [d for d in items if d.get("status") == "open"]
    answered = [d for d in items if d.get("status") == "answered"]
    actioned = [d for d in items if d.get("status") == "actioned"]
    out = ['<h1>Decisions</h1>',
           '<p class="sub">the foundation engine / journals inbox — filtered from '
           '<code>decisions.json</code>. Portal scm and Nexus deploy items stay out. '
           'You reply → the raising agent actions it.</p>']

    if not opens:
        out.append('<div class="note" style="border-left-color:var(--ok);background:rgba(74,222,128,.06)">'
                   'Nothing waiting on you. All raised items are answered or actioned.</div>')
    for d in opens:
        did = html.escape(d.get("id", ""), quote=True)
        opts = "".join(
            f'<button type="button" class="opt" data-v="{html.escape(o, quote=True)}" '
            f'onclick="document.getElementById(\'r-{did}\').value=this.dataset.v">'
            f'{html.escape(o)}</button>'
            for o in d.get("options") or [])
        out.append(
            f'<div class="panel dec">{_dec_head(d, "<span class=\'pill warn\'>open</span>")}'
            f'<div class="dbody"><p class="q">{html.escape(d.get("question", ""))}</p>'
            f'<p class="ctx">{html.escape(d.get("context", ""))}</p>{_dec_meta(d)}{opts}'
            f'<form method="post" action="/decisions/reply">'
            f'<input type="hidden" name="id" value="{did}">'
            f'<input type="hidden" name="entity" value="{entity or ""}">'
            f'<textarea name="reply" id="r-{did}" rows="3" maxlength="{MAX_REPLY}" required '
            f'placeholder="Your answer — pick an option above to prefill, or write your own"></textarea>'
            f'<button type="submit">Reply</button></form></div></div>')

    for d in answered:
        out.append(
            f'<div class="panel dec done">{_dec_head(d, "<span class=\'pill ok\'>answered</span>")}'
            f'<div class="dbody"><p class="q">{html.escape(d.get("question", ""))}</p>'
            f'<div class="reply">{html.escape(d.get("reply", ""))}</div>'
            f'<span class="meta code">replied '
            f'{html.escape((d.get("replied_at") or "")[:16].replace("T", " "))} · '
            f'waiting for {html.escape(d.get("raised_by", "the raising agent"))} to action it</span>'
            '</div></div>')

    if actioned:
        rows = "".join(
            f'<div class="panel dec done">{_dec_head(d, "<span class=\'pill\'>actioned</span>")}'
            f'<div class="dbody"><div class="reply">{html.escape(d.get("reply", ""))}</div>'
            + (f'<p class="ctx">{html.escape(d.get("actioned_note", ""))}</p>'
               if d.get("actioned_note") else "")
            + '</div></div>'
            for d in actioned)
        out.append(f'<details class="arch"><summary>Actioned — {len(actioned)} closed item'
                   f'{"s" if len(actioned) != 1 else ""} (full history)</summary>{rows}</details>')
    return "".join(out)


# Club Ignition Ops lives in ops.py — own chrome, own write path, never journals.


# -------------------------------------------------------------- server ----

def is_fc_or_payer(user) -> bool:
    if user is None:
        return False
    acting = getattr(user, "acting_as", "") or ""
    seats = set(getattr(user, "seats", []) or [])
    return acting in ("financial_controller", "payer") or bool(seats & {"financial_controller", "payer"})


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _token(self):
        return A.token_from_headers(self.headers.get("Cookie"))

    def _user(self):
        return A.get_user_by_token(self._token())

    def _redirect(self, loc, cookie=None):
        self.send_response(303)
        self.send_header("Location", loc)
        self.send_header("Cache-Control", "no-store")
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def _html(self, body: str, status=200, cookie=None):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, data, status=200, cookie=None):
        body = json.dumps(data, indent=2, ensure_ascii=False)
        raw = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self, max_n=65536):
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = 0
        if not 0 < n <= max_n:
            return {}
        try:
            raw = self.rfile.read(n).decode("utf-8", "replace")
            if raw.startswith("{") or raw.startswith("["):
                return json.loads(raw)
            parsed = parse_qs(raw)
            return {k: (v[0] if v else "") for k, v in parsed.items()}
        except Exception:
            return {}

    def _api_meta(self):
        self._json({
            "product": "the foundation engine",
            "api_version": "0.0.1",
            "capabilities": ["ops", "google_auth", "role_seats"]
        })

    def _api_me(self, user):
        if user is None:
            self._json({"ok": False, "error": "unauthenticated"}, status=401)
            return
        self._json({
            "ok": True,
            "user": {
                "email": user.email,
                "name": user.name,
                "person_id": user.person_id,
                "seats": user.seats,
                "acting_as": user.acting_as,
                "seat_label": user.seat_label(),
                "csrf": user.csrf,
                "allowed_entities": A.allowed_entities(user),
            }
        })

    def _api_auth_google(self, body):
        cred = (body.get("credential") or body.get("id_token") or "").strip()
        email_hint = (body.get("email") or "").strip().lower()
        claims, err = A.verify_google_id_token(cred)
        email = (claims or {}).get("email") if claims else email_hint
        if not email:
            O.record_auth_event(
                "auth.denied",
                f"Google sign-in denied ({err or 'no claims'})",
                email=email or None,
                fields={"reason": err or "no_claims"},
            )
            self._json({"ok": False, "error": err or "verify_failed"}, status=401)
            return
        person = A.lookup_person(email)
        if person is None:
            O.record_auth_event(
                "auth.denied",
                f"not on allowlist: {email or 'unknown'}",
                email=email or None,
                fields={"reason": "not_allowlisted"},
            )
            self._json({"ok": False, "error": "not_allowlisted"}, status=403)
            return
        token, user = A.create_session(person)
        tok = A.bind_user(user)
        try:
            O.record_auth_event("auth.login", f"{user.name} signed in as {user.seat_label()}", user=user)
        finally:
            A.reset_user(tok)
        self._json({
            "ok": True,
            "user": {
                "email": user.email,
                "name": user.name,
                "person_id": user.person_id,
                "seats": user.seats,
                "acting_as": user.acting_as,
                "seat_label": user.seat_label(),
                "csrf": user.csrf,
                "allowed_entities": A.allowed_entities(user),
            }
        }, cookie=A.cookie_header(token))

    def _api_auth_seat(self, user, body):
        if user is None:
            self._json({"ok": False, "error": "unauthenticated"}, status=401)
            return
        csrf = body.get("csrf") or ""
        if not A.csrf_ok(user, csrf):
            self._json({"ok": False, "error": "csrf_mismatch"}, status=400)
            return
        seat = (body.get("seat") or "").strip()
        prev = user.acting_as
        updated, err = A.switch_seat(user, seat)
        if err or updated is None:
            self._json({"ok": False, "error": err or "seat_switch_failed"}, status=400)
            return
        tok = A.bind_user(updated)
        try:
            O.record_auth_event(
                "auth.role_switch",
                f"{updated.name} switched {prev} → {updated.acting_as}",
                user=updated,
                fields={"from_seat": prev, "to_seat": updated.acting_as},
            )
        finally:
            A.reset_user(tok)
        self._json({
            "ok": True,
            "user": {
                "email": updated.email,
                "name": updated.name,
                "person_id": updated.person_id,
                "seats": updated.seats,
                "acting_as": updated.acting_as,
                "seat_label": updated.seat_label(),
                "csrf": updated.csrf,
                "allowed_entities": A.allowed_entities(updated),
            }
        })

    def _api_ops_pulse(self, user):
        if user is None:
            self._json({"ok": False, "error": "unauthenticated"}, status=401)
            return
        st = O.load_state()
        jobs = O.jobs_sorted(st)
        events = O.load_events()[:30]
        if not is_fc_or_payer(user):
            events = [
                e for e in events
                if e.get("type") != "PURCHASE" or (e.get("fields") or {}).get("scm_step") in ("need", "receive")
            ]
        self._json({
            "ok": True,
            "jobs": jobs,
            "events": events,
            "campaign": O.campaign_snapshot(user),
            "seq": {
                "job_seq": st.get("job_seq"),
                "event_seq": st.get("event_seq"),
            }
        })

    def _api_ops_job(self, user, job_id):
        if user is None:
            self._json({"ok": False, "error": "unauthenticated"}, status=401)
            return
        st = O.load_state()
        job = st.get("jobs", {}).get(job_id)
        if not job:
            self._json({"ok": False, "error": "job_not_found"}, status=404)
            return
        events = O.events_for(job_id)
        if not is_fc_or_payer(user):
            events = [
                e for e in events
                if e.get("type") != "PURCHASE" or (e.get("fields") or {}).get("scm_step") in ("need", "receive")
            ]
        self._json({
            "ok": True,
            "job": job,
            "events": events,
        })

    def _api_ops_purchases(self, user):
        if user is None:
            self._json({"ok": False, "error": "unauthenticated"}, status=401)
            return
        events = O.events_for(etype="PURCHASE")
        if not is_fc_or_payer(user):
            events = [e for e in events if (e.get("fields") or {}).get("scm_step") in ("need", "receive")]
        self._json({
            "ok": True,
            "purchases": events,
        })

    def _api_ops_event(self, user, body):
        if user is None:
            self._json({"ok": False, "error": "unauthenticated"}, status=401)
            return
        csrf = body.get("csrf") or ""
        if not A.csrf_ok(user, csrf):
            self._json({"ok": False, "error": "csrf_mismatch"}, status=400)
            return
        event, err = O.record_event(body)
        if err:
            self._json({"ok": False, "error": err}, status=400)
            return
        self._json({"ok": True, "event": event})

    def _read_form(self, max_n=65536):
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = 0
        if not 0 < n <= max_n:
            try:
                if n > 0:
                    self.rfile.read(min(n, max_n))
            except OSError:
                pass
            return None
        raw = parse_qs(self.rfile.read(n).decode("utf-8", "replace"))
        return {k: (v[0] if v else "") for k, v in raw.items()}

    def _read_post(self, max_n=8_000_000):
        """URL-encoded or multipart. Receipt files only; still never opens journals."""
        ctype = self.headers.get("Content-Type") or ""
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = 0
        if not 0 < n <= max_n:
            try:
                if n > 0:
                    self.rfile.read(min(n, max_n))
            except OSError:
                pass
            return None, {}
        raw = self.rfile.read(n)
        if "multipart/form-data" in ctype.lower():
            return parse_multipart(ctype, raw)
        decoded = parse_qs(raw.decode("utf-8", "replace"))
        return {k: (v[0] if v else "") for k, v in decoded.items()}, {}

    def _logout(self):
        token = self._token()
        user = A.destroy_session(token)
        if user:
            O.record_auth_event("auth.logout", f"{user.name} signed out", user=user)
        elif token:
            O.record_auth_event("auth.logout", "session cleared")
        self._redirect("/login", A.cookie_header(None))

    def _google_post(self, form: dict):
        # AG-OWNED: verify_google_id_token must become real. Elder only stamps session/audit.
        cred = (form.get("credential") or form.get("id_token") or "").strip()
        claims, err = A.verify_google_id_token(cred)
        email = (claims or {}).get("email") if claims else ""
        nxt_raw = form.get("next") or "/"
        if err or not claims:
            O.record_auth_event(
                "auth.denied",
                f"Google sign-in denied ({err or 'no claims'})",
                email=email or None,
                fields={"reason": err or "no_claims"},
            )
            flash = A.public_google_error(err or "no_claims")
            self._html(A.page_login(A.safe_next(nxt_raw, "/"), flash=flash, denied=True))
            return
        person = A.lookup_person(email)
        if person is None:
            O.record_auth_event(
                "auth.denied",
                f"not on allowlist: {email or 'unknown'}",
                email=email or None,
                fields={"reason": "not_allowlisted"},
            )
            self._html(A.page_login(A.safe_next(nxt_raw, "/"), flash="This Google account is not on the Club Ignition allowlist.", denied=True))
            return
        token, user = A.create_session(person)
        nxt = A.coerce_next(user, A.safe_next(nxt_raw, A.default_books_path(user)))
        tok = A.bind_user(user)
        try:
            O.record_auth_event("auth.login", f"{user.name} signed in as {user.seat_label()}", user=user)
        finally:
            A.reset_user(tok)
        self._redirect(nxt, A.cookie_header(token))

    def _seat_post(self, form: dict):
        user = self._user()
        if user is None:
            self._redirect("/login?next=/ops")
            return
        if not A.csrf_ok(user, form.get("csrf") or ""):
            self.send_error(400, "Bad CSRF token.")
            return
        prev = user.acting_as
        updated, err = A.switch_seat(user, (form.get("seat") or "").strip())
        if err or updated is None:
            tok = A.bind_user(user)
            try:
                self._html(O.page_dashboard(flash=err or "Could not switch seat."))
            finally:
                A.reset_user(tok)
            return
        tok = A.bind_user(updated)
        try:
            O.record_auth_event(
                "auth.role_switch",
                f"{updated.name} switched {prev} → {updated.acting_as}",
                user=updated,
                fields={"from_seat": prev, "to_seat": updated.acting_as},
            )
            self._html(O.page_dashboard(flash=f"Acting as {updated.seat_label()}."))
        finally:
            A.reset_user(tok)

    def send_asset(self, name):
        ctype = ASSET_FILES.get(name)
        path = _safe_engine_path(os.path.join(ASSETS_DIR, name), ASSETS_DIR) if ctype else None
        if not ctype or not os.path.isfile(path):
            self.send_error(404, "No such asset")
            return
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        # Brand marks do not change between deployments; let the browser keep them.
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        p = u.path.strip("/")
        g = parse_qs(u.query)
        entity = (g.get("entity", [""])[0] or "") or None
        if entity not in B.ENTITIES:
            entity = None
        dfrom = clean_date(g.get("from", [""])[0] or None)
        dto = clean_date(g.get("to", [""])[0] or None)
        code = g.get("account", [""])[0] or None
        user = self._user()
        tok = A.bind_user(user)
        try:
            if p.startswith("assets/"):
                self.send_asset(p[len("assets/"):])
                return
            if p == "favicon.ico":
                fav = "ci-favicon.png" if (user is None or A.is_ci_only(user)) else "starq-favicon.png"
                self.send_asset(fav)
                return
            if p == "login":
                nxt = A.safe_next((g.get("next") or ["/"])[0], "/")
                if user:
                    self._redirect(A.coerce_next(user, nxt))
                    return
                self._html(A.page_login(nxt))
                return
            if p == "logout":
                self._logout()
                return
            if p == "auth/google/callback":
                # AG-OWNED: if they use auth-code, handle query ?code= here.
                self._html(A.page_login("/ops", flash="Authorization-code callback is not wired yet.", denied=True))
                return

            if p == "api/meta":
                self._api_meta()
                return
            if p == "api/me":
                self._api_me(user)
                return
            if p == "api/ops/pulse":
                self._api_ops_pulse(user)
                return
            if p == "api/ops/job":
                job_id = (g.get("id") or [""])[0]
                self._api_ops_job(user, job_id)
                return
            if p == "api/ops/purchases":
                self._api_ops_purchases(user)
                return

            if p == "documents/print":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=" + quote(u.path or "/documents/print"))
                    return
                raw_entity = (g.get("entity") or [""])[0]
                occ = raw_entity.strip().upper() if raw_entity else ""
                if occ not in ("STARQ", "CI"):
                    self._html(h_document_print_error("Occupancy required."), 400)
                    return
                ledger, action = A.books_access(user, occ, True)
                if action == "login":
                    self._redirect("/login?next=" + quote(self.path or "/documents/print"))
                    return
                if action == "forbid" or ledger != occ:
                    self._html(page_forbidden(), 403)
                    return
                payload, err = JO.print_payload(
                    event_id=(g.get("event_id") or [""])[0],
                    kind=(g.get("kind") or [""])[0],
                    occupancy=occ,
                )
                if err or payload is None:
                    self._html(h_document_print_error(err or "Print refused."), 400)
                    return
                self._html(h_document_print(payload))
                return

            if p == "ops" or p.startswith("ops/"):
                if user is None:
                    self._redirect("/login?next=" + quote(u.path or "/ops"))
                    return
                out = O.dispatch_get(u.path, g)
                self._html(out)
                return

            if A.google_configured() and user is None:
                self._redirect("/login?next=" + quote(u.path or "/"))
                return

            if p not in BOOKS_TABS:
                # Never fall through to Group overview — that leaked books on /login.
                loc = A.default_books_path(user) if user else "/login"
                self._redirect(loc)
                return

            raw_entity = (g.get("entity") or [""])[0] if "entity" in g else ""
            explicit = "entity" in g
            ledger, action = A.books_access(user, raw_entity, explicit)
            month = clean_month((g.get("month") or [""])[0] or None)
            on_day = clean_date((g.get("on") or [""])[0] or None)
            notice = (g.get("notice") or [""])[0]
            if notice not in ("captured", "denied", "counted", "count_denied", "pos_ok", "pos_denied",
                              "pos_sale", "issued", "issue_denied", "created", "create_denied",
                              "emp_created", "emp_denied", "rate_set", "rate_denied",
                              "priced", "price_denied",
                              "sku_created", "sku_denied", "bill_captured", "bill_denied",
                              "inv_captured", "inv_denied",
                              "scm_approved", "scm_approve_denied"):
                notice = None
            if action == "login":
                self._redirect("/login?next=" + quote(u.path or "/"))
                return
            if action == "forbid":
                self._html(page_forbidden(), 403)
                return
            if action == "coerce":
                tab = f"/{p}" if p and p not in ("home",) else "/"
                if p == "overview":
                    tab = "/overview"
                ent = ledger or ""
                extra = f"&account={code}" if p == "journal" and code else ""
                extra_cal = ""
                if p in ("", "home"):
                    extra_cal = f"&month={month or ''}&on={on_day or ''}"
                self._redirect(
                    f"{tab}?entity={ent}&from={dfrom or ''}&to={dto or ''}{extra}{extra_cal}"
                )
                return
            entity = ledger

            err = ensure_db()
            stamp = datetime.now().strftime("%H:%M:%S")
            if err:
                body = ('<div class="note err"><b>The journals do not parse, so nothing was posted.</b>'
                        f'<pre>{html.escape(err)}</pre></div>')
                out = page("Error", body, "", entity, dfrom, dto, stamp)
            else:
                acc = acct_map()
                try:
                    if p == "tb":
                        body = h_tb(acc, entity, dfrom, dto)
                    elif p == "pl":
                        body = h_pl(acc, entity, dfrom, dto)
                    elif p == "bs":
                        body = h_bs(acc, entity, dfrom, dto)
                    elif p == "journal":
                        body = h_journal(acc, entity, code, dfrom, dto)
                    elif p == "accounts":
                        body = h_accounts(acc, entity, dfrom, dto)
                    elif p == "notes":
                        body = h_notes(entity, user, notice)
                    elif p == "decisions":
                        body = h_decisions(entity)
                    elif p == "overview":
                        body = h_overview(acc, entity, dfrom, dto)
                    elif p == "sales":
                        contact_id = (g.get("contact_id") or [""])[0]
                        body = h_sales(acc, entity, dfrom, dto, notice, user, contact_id)
                    elif p == "expenses":
                        contact_id = (g.get("contact_id") or [""])[0]
                        body = h_expenses(acc, entity, dfrom, dto, notice, user, contact_id)
                    elif p == "banking":
                        body = h_banking(acc, entity, dfrom, dto)
                    elif p == "contacts":
                        body = h_contacts(acc, entity, dfrom, dto, user, notice)
                    elif p == "products":
                        body = h_products(acc, entity, dfrom, dto, user, notice)
                    elif p == "projects":
                        body = h_projects(acc, entity, dfrom, dto, user)
                    elif p == "pos":
                        body = h_pos(acc, entity, dfrom, dto, user, notice)
                    elif p == "reports":
                        contact_id = (g.get("contact_id") or [""])[0]
                        body = h_reports(acc, entity, dfrom, dto, contact_id)
                    elif p == "accounting":
                        contact_id = (g.get("contact_id") or [""])[0]
                        body = h_accounting(acc, entity, dfrom, dto, contact_id)
                    elif p == "transactions":
                        body = h_transactions(acc, entity, dfrom, dto)
                    elif p == "settings":
                        body = h_settings(acc, entity, dfrom, dto, user, notice)
                    else:
                        p = ""
                        body = h_home(acc, entity, user, dfrom, dto, month, on_day, notice)
                except Exception as exc:  # a report bug must not take the server down
                    body = f'<div class="note err"><b>Report failed.</b><pre>{html.escape(repr(exc))}</pre></div>'
                titles = {"": "Dashboard", "home": "Dashboard", "overview": "Overview",
                          "tb": "Trial balance", "pl": "Profit and loss",
                          "bs": "Balance sheet", "journal": "Journal", "accounts": "Chart of accounts",
                          "notes": "Notes", "decisions": "Decisions",
                          "sales": "Sales", "expenses": "Expenses", "banking": "Banking",
                          "contacts": "Contacts", "products": "Products", "projects": "Projects",
                          "reports": "Reports",
                          "accounting": "Accounting", "settings": "Settings",
                          "transactions": "Ops", "pos": "POS"}
                out = page(titles.get(p, "Overview"), body, p, entity, dfrom, dto, stamp,
                           code if code in acc else None)

            self._html(out)
        finally:
            A.reset_user(tok)

    def do_POST(self):
        # Write routes. None of these open a journal.
        path = urlparse(self.path).path
        user = self._user()
        tok = A.bind_user(user)
        try:
            if path == "/logout":
                self._logout()
                return
            if path == "/api/auth/google":
                body = self._read_json()
                self._api_auth_google(body)
                return
            if path == "/api/auth/seat":
                body = self._read_json()
                self._api_auth_seat(user, body)
                return
            if path == "/api/ops/event":
                body = self._read_json()
                self._api_ops_event(user, body)
                return
            if path == "/auth/google":
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                self._google_post(form)
                return
            if path == "/auth/seat":
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                self._seat_post(form)
                return
            if path == "/receipt":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/")
                    return
                form, files = self._read_post()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                kind = (form.get("kind") or "").strip().lower()
                period = clean_month((form.get("period") or "").strip() or None)
                if not period:
                    bd = clean_date((form.get("bill_date") or "").strip() or None)
                    period = bd[:7] if bd else ""
                form["type"] = "RECEIPT"
                form["kind"] = kind
                form["period"] = period or ""
                if ent in ("STARQ", "CI"):
                    form["entity"] = ent
                file_part = files.get("file")
                try:
                    if file_part and file_part[0] and file_part[1]:
                        form["artefact_path"] = save_receipt_artefact(
                            file_part[0], file_part[1], period or "none", kind or "other"
                        )
                    else:
                        form["artefact_path"] = save_receipt_stub(form)
                except Exception:
                    form["artefact_path"] = save_receipt_stub(form)
                _event, err = O.record_event(form)
                notice = "denied" if err else "captured"
                self._redirect(f"/?entity={ent}&notice={notice}")
                return
            if path == "/expenses/bill":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/expenses")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                if ent not in ("STARQ", "CI"):
                    self._redirect("/expenses?notice=bill_denied")
                    return
                if not A.may_view_books(user, ent):
                    self._html(page_forbidden(), 403)
                    return
                form["type"] = "BILL"
                form["entity"] = ent
                ref = (form.get("vendor_ref") or "").strip()
                if ref.startswith("CI-CT-") or ref.startswith("ST-CT-"):
                    form["contact_id"] = ref
                elif ref:
                    form["vendor"] = ref
                    form["supplier"] = ref
                _event, err = O.record_event(form)
                notice = "bill_denied" if err else "bill_captured"
                self._redirect(f"/expenses?entity={ent}&notice={notice}")
                return
            if path == "/sales/invoice":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/sales")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                if ent not in ("STARQ", "CI"):
                    self._redirect("/sales?notice=inv_denied")
                    return
                if not A.may_view_books(user, ent):
                    self._html(page_forbidden(), 403)
                    return
                form["type"] = "INVOICE"
                form["entity"] = ent
                ref = (form.get("customer_ref") or "").strip()
                if ref.startswith("CI-CT-") or ref.startswith("ST-CT-"):
                    form["contact_id"] = ref
                elif ref:
                    form["customer"] = ref
                _event, err = O.record_event(form)
                notice = "inv_denied" if err else "inv_captured"
                self._redirect(f"/sales?entity={ent}&notice={notice}")
                return
            if path == "/ops/event":
                if user is None:
                    self._redirect("/login?next=/ops/log")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                event, err = O.record_event(form)
                if err:
                    out = O.page_log(form.get("job_no") or None, flash=err)
                else:
                    job = (event or {}).get("job_no")
                    flash = f"Logged {(event or {}).get('id')} · {(event or {}).get('type')}"
                    if job:
                        out = O.page_job(job, flash=flash)
                    else:
                        out = O.page_dashboard(flash=flash)
                self._html(out)
                return
            if path == "/inventory/count":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/products")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                err = M.apply_stock_count(
                    form.get("sku") or "",
                    form.get("qty") or "",
                    person_id=user.person_id if user else "",
                    seat=user.acting_as if user else "",
                    unit_cost_raw=form.get("unit_cost") or "",
                )
                notice = "count_denied" if err else "counted"
                self._redirect(f"/products?entity={ent}&notice={notice}")
                return
            if path == "/pos/consume":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/pos")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                err = POS.consume(
                    form.get("sku") or "",
                    form.get("qty") or "",
                    person_id=user.person_id if user else "",
                    seat=user.acting_as if user else "",
                    occupancy=ent if ent in ("STARQ", "CI") else "",
                )
                notice = "pos_denied" if err else "pos_ok"
                self._redirect(f"/pos?entity={ent}&notice={notice}")
                return
            if path == "/pos/sell":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/pos")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                err = POS.sell(
                    form.get("sku") or "",
                    form.get("qty") or "",
                    person_id=user.person_id if user else "",
                    seat=user.acting_as if user else "",
                    occupancy=ent if ent in ("STARQ", "CI") else "",
                    contact_id=form.get("contact_id") or "",
                )
                notice = "pos_denied" if err else "pos_sale"
                self._redirect(f"/pos?entity={ent}&notice={notice}")
                return
            if path == "/products/price":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/products")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                occ = (form.get("occupancy") or "").strip().upper()
                if occ not in ("STARQ", "CI"):
                    occ = ent if ent in ("STARQ", "CI") else ""
                if occ and not A.may_view_books(user, occ):
                    self._html(page_forbidden(), 403)
                    return
                _row, err = M.set_sell_price(
                    form.get("sku") or "",
                    form.get("sell_price_mvr") or "",
                    occupancy=occ,
                    seat=user.acting_as if user else "",
                    person_id=user.person_id if user else "",
                )
                notice = "price_denied" if err else "priced"
                self._redirect(f"/products?entity={ent}&notice={notice}")
                return
            if path == "/products/sku":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/products")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                occ = (form.get("occupancy") or "").strip().upper()
                if occ not in ("STARQ", "CI"):
                    occ = ent if ent in ("STARQ", "CI") else ""
                if occ and not A.may_view_books(user, occ):
                    self._html(page_forbidden(), 403)
                    return
                _row, err = M.create_sku(
                    sku=form.get("sku") or "",
                    name=form.get("name") or "",
                    occupancy=occ,
                    seat=user.acting_as if user else "",
                    person_id=user.person_id if user else "",
                )
                notice = "sku_denied" if err else "sku_created"
                self._redirect(f"/products?entity={ent}&notice={notice}")
                return
            if path == "/scm/approve":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/expenses")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                if ent not in ("STARQ", "CI"):
                    self._redirect("/expenses?notice=scm_approve_denied")
                    return
                if not A.may_view_books(user, ent):
                    self._html(page_forbidden(), 403)
                    return
                tab = (form.get("return_tab") or "expenses").strip().lower()
                if tab not in ("expenses", "sales", "home", ""):
                    tab = "expenses"
                target = f"/{tab}" if tab and tab != "home" else "/"
                approve_form, perr = JO.prepare_scm_approve(
                    event_id=form.get("event_id") or "",
                    scm_step=form.get("scm_step") or "",
                    occupancy=ent,
                    seat=user.acting_as if user else "",
                )
                if perr or not approve_form:
                    self._redirect(f"{target}?entity={ent}&notice=scm_approve_denied")
                    return
                _event, err = O.record_event(approve_form)
                notice = "scm_approve_denied" if err else "scm_approved"
                self._redirect(f"{target}?entity={ent}&notice={notice}")
                return
            if path == "/documents/issue":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/sales")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                occ = (form.get("occupancy") or "").strip().upper()
                if occ not in ("STARQ", "CI"):
                    occ = ent if ent in ("STARQ", "CI") else ""
                kind = (form.get("kind") or "").strip().upper()
                tab = "expenses" if kind == "PO" else "sales"
                if occ and not A.may_view_books(user, occ):
                    self._html(page_forbidden(), 403)
                    return
                rec, err = JO.issue_document(
                    event_id=form.get("event_id") or "",
                    kind=kind,
                    occupancy=occ,
                    seat=user.acting_as if user else "",
                    person_id=user.person_id if user else "",
                    contact_id=form.get("contact_id") or "",
                )
                notice = "issue_denied" if err else "issued"
                self._redirect(f"/{tab}?entity={ent}&notice={notice}")
                return
            if path == "/contacts/create":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/contacts")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                occ = (form.get("occupancy") or "").strip().upper()
                if occ not in ("STARQ", "CI"):
                    occ = ent if ent in ("STARQ", "CI") else ""
                if occ and not A.may_view_books(user, occ):
                    self._html(page_forbidden(), 403)
                    return
                _row, err = M.create_contact(
                    name=form.get("name") or "",
                    kind=form.get("kind") or "",
                    occupancy=occ,
                    seat=user.acting_as if user else "",
                    person_id=user.person_id if user else "",
                )
                notice = "create_denied" if err else "created"
                self._redirect(f"/contacts?entity={ent}&notice={notice}")
                return
            if path == "/contacts/from-call":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/contacts")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                occ = (form.get("occupancy") or "").strip().upper()
                if occ not in ("STARQ", "CI"):
                    occ = ent if ent in ("STARQ", "CI") else ""
                if occ and not A.may_view_books(user, occ):
                    self._html(page_forbidden(), 403)
                    return
                _row, err = M.create_contact_from_call(
                    event_id=form.get("event_id") or "",
                    occupancy=occ,
                    seat=user.acting_as if user else "",
                    person_id=user.person_id if user else "",
                )
                notice = "from_call_denied" if err else "from_call"
                self._redirect(f"/contacts?entity={ent}&notice={notice}")
                return
            if path == "/locations/create":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/settings")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                occ = (form.get("occupancy") or "").strip().upper()
                if occ not in ("STARQ", "CI"):
                    occ = ent if ent in ("STARQ", "CI") else ""
                if occ and not A.may_view_books(user, occ):
                    self._html(page_forbidden(), 403)
                    return
                _row, err = M.create_location(
                    name=form.get("name") or "",
                    kind=form.get("kind") or "",
                    occupancy=occ,
                    seat=user.acting_as if user else "",
                    person_id=user.person_id if user else "",
                )
                notice = "loc_denied" if err else "loc_created"
                self._redirect(f"/settings?entity={ent}&notice={notice}")
                return
            if path == "/payroll/employee":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/settings")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                occ = (form.get("occupancy") or "").strip().upper()
                if occ not in ("STARQ", "CI"):
                    occ = ent if ent in ("STARQ", "CI") else ""
                if occ and not A.may_view_books(user, occ):
                    self._html(page_forbidden(), 403)
                    return
                _row, err = M.create_employee(
                    name=form.get("name") or "",
                    seat=form.get("seat") or "",
                    occupancy=occ,
                    actor_seat=user.acting_as if user else "",
                    person_id=user.person_id if user else "",
                )
                notice = "emp_denied" if err else "emp_created"
                self._redirect(f"/settings?entity={ent}&notice={notice}")
                return
            if path == "/payroll/rate":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/settings")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                occ = (form.get("occupancy") or "").strip().upper()
                if occ not in ("STARQ", "CI"):
                    occ = ent if ent in ("STARQ", "CI") else ""
                if occ and not A.may_view_books(user, occ):
                    self._html(page_forbidden(), 403)
                    return
                _row, err = M.set_employee_rate(
                    form.get("employee_id") or "",
                    form.get("rate_mvr") or "",
                    occupancy=occ,
                    seat=user.acting_as if user else "",
                    person_id=user.person_id if user else "",
                )
                notice = "rate_denied" if err else "rate_set"
                self._redirect(f"/settings?entity={ent}&notice={notice}")
                return
            if path == "/notes/append":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/notes")
                    return
                if not A.may_reply_decisions(user):
                    self.send_error(403, "Local notes are for director / FC / ledger poster seats.")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                if not A.csrf_ok(user, form.get("csrf") or ""):
                    self.send_error(400, "Bad CSRF token.")
                    return
                u = urlparse(self.path)
                g = parse_qs(u.query)
                ent = (g.get("entity") or [form.get("entity") or ""])[0] or ""
                if ent and ent not in B.ENTITIES and ent != "":
                    ent = ""
                if ent and not A.may_view_books(user, ent):
                    self._html(page_forbidden(), 403)
                    return
                err = append_local_notes(
                    ent,
                    form.get("text") or "",
                    person_id=user.person_id if user else "",
                    seat=user.acting_as if user else "",
                )
                notice = "note_denied" if err else "note_appended"
                self._redirect(f"/notes?entity={ent}&notice={notice}")
                return
            if path == "/decisions/reply":
                if A.google_configured() and user is None:
                    self._redirect("/login?next=/decisions")
                    return
                if A.google_configured() and not A.may_reply_decisions(user):
                    self.send_error(403, "Decisions are for the director / FC / ledger poster seats.")
                    return
                form = self._read_form()
                if form is None:
                    self.send_error(400, "Bad request body.")
                    return
                did = form.get("id") or ""
                reply = (form.get("reply") or "").strip()[:MAX_REPLY]
                entity = form.get("entity") or ""
                if entity not in B.ENTITIES:
                    entity = ""
                if entity and not A.may_view_books(user, entity):
                    self._html(page_forbidden(), 403)
                    return
                items = load_decisions()
                item = next((d for d in items if d.get("id") == did), None)
                if item is None or item.get("status") != "open" or not reply:
                    self.send_error(400, "Unknown decision id, item not open, or empty reply.")
                    return
                if not A.decision_visible(item, user) or not A.decision_starqbooks_relevant(item):
                    self._html(page_forbidden(), 403)
                    return
                item["reply"] = reply
                item["replied_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
                item["status"] = "answered"
                save_decisions(items)
                self._redirect(f"/decisions?entity={entity}")
                return
            try:
                n = min(int(self.headers.get("Content-Length", "0") or 0), 65536)
                if n > 0:
                    self.rfile.read(n)
            except (ValueError, OSError):
                pass
            self.send_error(405, "Ledger is read-only. Edit a journal, or POST /ops/event for workflow.")
        finally:
            A.reset_user(tok)


def main():
    why = tree_guard()
    if why:
        print(why, file=sys.stderr)
        print(f"This process is {HERE}", file=sys.stderr)
        print(f"cwd is {os.getcwd()}", file=sys.stderr)
        print("Stop this Python. cd D:\\StarqTech\\the foundation engine then python serve.py", file=sys.stderr)
        return 2
    # Windows consoles default to cp1252, which cannot print the Dhivehi and
    # symbol characters that appear in journal narrations (they surface here
    # through parse-error messages). Never let a print kill the server.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    err = ensure_db()
    if err:
        print("Warning — the journals do not currently parse:\n", file=sys.stderr)
        print(err, file=sys.stderr)
        print("\nThe viewer will start and show the error.\n", file=sys.stderr)
    srv = None
    for port in PORTS:
        try:
            srv = ExclusiveHTTPServer((HOST, port), Handler)
            break
        except OSError as exc:
            print(f"  port {port} is already serving ({exc.errno}), trying the next one", file=sys.stderr)
    if srv is None:
        print(f"Could not bind any of {PORTS}. Add a free port to PORTS in serve.py.", file=sys.stderr)
        return 1

    url = f"http://{HOST}:{srv.server_address[1]}"
    print(f"the foundation engine viewer — {url}   (Ctrl-C to stop)")
    print("Books: read-only journals. Ops: http://127.0.0.1:%s/ops (Google sign-in / seats)."
          % srv.server_address[1])
    print("Login shell: %s/login" % url)
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
        srv.server_close()


if __name__ == "__main__":
    raise SystemExit(main())
