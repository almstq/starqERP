#!/usr/bin/env python3
"""
the foundation engine — a small double-entry ledger for Starq Technologies and its subsidiaries.

The journals are the books. Each entity keeps its own folder — journals/starq/ for
the parent, journals/club-ignition/ for the subsidiary — and an entry posted in the
wrong entity's folder is rejected. The SQLite database is a rebuildable index.
Delete books.db and run `post` and you get it back. Never edit books.db by hand.

Usage
    python books.py check                 validate journals, post nothing
    python books.py post                  rebuild books.db from the journals
    python books.py accounts              print the chart of accounts
    python books.py tb    [filters]       trial balance
    python books.py pl    [filters]       profit and loss
    python books.py bs    [filters]       balance sheet
    python books.py ledger 2400 [filters] every movement on one account
    python books.py entities              list entities and their totals

Filters
    --entity STARQ        one entity only (default: each entity separately)
    --consolidated        all entities combined, intercompany eliminated
    --from 2026-08-01     period start (pl only)
    --to 2026-08-31       period end / as-at date
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sqlite3
import sys
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "books.db")
ACCOUNTS_CSV = os.path.join(HERE, "accounts.csv")
JOURNAL_DIR = os.path.join(HERE, "journals")

# Signed convention: debits positive, credits negative.
# Accounts whose natural balance is a credit are negated for display.
NATURAL_CREDIT = {"LIABILITY", "EQUITY", "INCOME"}

ENTITIES = {
    "STARQ": ("Starq Technologies Pvt Ltd", "C29552026", "1186669"),
    "CI": ("Club Ignition Pvt Ltd", "C30222026", "1186844"),
}

# Each entity's journals live in their own folder. A journal filed under one
# entity's folder may not contain another entity's entries — that is the whole
# point of keeping the books separately.
ENTITY_DIRS = {
    "starq": "STARQ",
    "club-ignition": "CI",
}

# Intercompany balances dropped by --consolidated.
# This is a working view, NOT statutory consolidation: it does not compute
# non-controlling interest, goodwill, or eliminate unrealised intra-group profit.
# Nashid's 49% of Club Ignition is not carved out. Year-end consolidation is a
# job for the accountant; this flag only answers "how much money does the group
# have, ignoring what the two companies owe each other".
INTERCOMPANY = {"1290", "2490", "2495", "1600"}

HEADER_RE = re.compile(
    r'^(?P<date>\d{4}-\d{2}-\d{2})\s+'
    r'(?P<entity>[A-Z][A-Z0-9_]*)\s+'
    r'"(?P<narration>[^"]*)"'
    r'(?P<tags>.*)$'
)
POSTING_RE = re.compile(
    r'^\s+(?P<account>\d{4})\s+'
    r'(?P<amount>-?[\d,]*\.?\d*)?\s*'
    r'(?:#\s*(?P<memo>.*))?$'
)
TAG_RE = re.compile(r'(\w+):(\S+)')


class LedgerError(Exception):
    pass


@dataclass
class Posting:
    account: str
    amount: Decimal | None
    memo: str = ""


@dataclass
class Entry:
    date: str
    entity: str
    narration: str
    tags: dict = field(default_factory=dict)
    postings: list = field(default_factory=list)
    source: str = ""
    line_no: int = 0


def money(raw: str) -> Decimal:
    try:
        return Decimal(raw.replace(",", ""))
    except InvalidOperation:
        raise LedgerError(f"not a number: {raw!r}")


def load_accounts() -> dict:
    accounts = {}
    with open(ACCOUNTS_CSV, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            code = row["code"].strip()
            note = (row.get("note") or "").strip()
            entities = (row.get("entities") or "BOTH").strip().upper() or "BOTH"
            accounts[code] = {
                "code": code,
                "name": row["name"].strip(),
                "type": row["type"].strip().upper(),
                "note": note,
                "heading": note == "heading",
                # Which entity may post to this account. "BOTH" or an entity code.
                # A garage income account has no business in Starq's books, and
                # 1600 has no business in the subsidiary's.
                "entities": entities,
                "status": (row.get("status") or "active").strip().lower() or "active",
            }
    return accounts


def account_allows(acc: dict, entity: str) -> bool:
    scope = acc.get("entities", "BOTH")
    return scope in ("BOTH", "", entity)


def parse_journal(path: str, accounts: dict, name: str | None = None,
                  only_entity: str | None = None) -> list:
    entries: list[Entry] = []
    current: Entry | None = None
    errors: list[str] = []
    name = name or os.path.basename(path)

    with open(path, encoding="utf-8") as fh:
        for n, raw in enumerate(fh, 1):
            line = raw.rstrip("\n").rstrip()
            if not line.strip() or line.lstrip().startswith("#"):
                continue

            if not line[0].isspace():
                if current:
                    entries.append(current)
                m = HEADER_RE.match(line)
                if not m:
                    errors.append(f"{name}:{n}: cannot read entry header — {line.strip()!r}")
                    current = None
                    continue
                entity = m.group("entity")
                if entity not in ENTITIES:
                    errors.append(f"{name}:{n}: unknown entity {entity!r}")
                elif only_entity and entity != only_entity:
                    errors.append(
                        f"{name}:{n}: {entity} entry in the {only_entity} folder — "
                        f"each entity's journals stay in their own folder")
                current = Entry(
                    date=m.group("date"),
                    entity=entity,
                    narration=m.group("narration"),
                    tags=dict(TAG_RE.findall(m.group("tags") or "")),
                    source=name,
                    line_no=n,
                )
                continue

            if current is None:
                errors.append(f"{name}:{n}: posting with no entry above it")
                continue

            m = POSTING_RE.match(line)
            if not m:
                errors.append(f"{name}:{n}: cannot read posting — {line.strip()!r}")
                continue
            code = m.group("account")
            if code not in accounts:
                errors.append(f"{name}:{n}: account {code} is not in accounts.csv")
                continue
            if accounts[code]["heading"]:
                errors.append(f"{name}:{n}: {code} is a heading, you cannot post to it")
                continue
            if not account_allows(accounts[code], current.entity):
                errors.append(
                    f"{name}:{n}: {code} {accounts[code]['name']} belongs to "
                    f"{accounts[code]['entities']}, not {current.entity}")
                continue
            if accounts[code]["status"] == "blocked":
                # A regulatory stop, not a typo. These accounts exist so the
                # shape of the business is visible, but posting to one means
                # something was billed that the BAR does not cover.
                reason = accounts[code]["note"] or "blocked"
                errors.append(f"{name}:{n}: {code} is BLOCKED — {reason}")
                continue
            amount_raw = m.group("amount")
            try:
                amount = money(amount_raw) if amount_raw else None
            except LedgerError as exc:
                errors.append(f"{name}:{n}: {exc}")
                continue
            current.postings.append(Posting(code, amount, (m.group("memo") or "").strip()))

    if current:
        entries.append(current)

    for e in entries:
        where = f"{e.source}:{e.line_no}"
        if len(e.postings) < 2:
            errors.append(f"{where}: an entry needs at least two postings")
            continue
        blanks = [p for p in e.postings if p.amount is None]
        if len(blanks) > 1:
            errors.append(f"{where}: only one posting may be left blank to auto-balance")
            continue
        known = sum((p.amount for p in e.postings if p.amount is not None), Decimal("0"))
        if blanks:
            blanks[0].amount = -known
        elif known != 0:
            errors.append(f"{where}: does not balance, out by {known:+,.2f} — {e.narration!r}")

    if errors:
        raise LedgerError("\n".join(errors))
    return entries


def journal_files() -> list:
    """Every .journal file, as (path, display_name, only_entity) tuples.

    Files sit in per-entity folders (journals/starq/, journals/club-ignition/)
    which pin the entity. A .journal loose in journals/ itself still parses,
    but with no entity pin — move it into its folder.
    """
    out = []
    for root, dirs, files in os.walk(JOURNAL_DIR):
        dirs.sort()
        rel_dir = os.path.relpath(root, JOURNAL_DIR)
        top = rel_dir.split(os.sep)[0]
        only = ENTITY_DIRS.get(top)
        for f in sorted(files):
            if not f.endswith(".journal"):
                continue
            rel = f if rel_dir == "." else os.path.join(rel_dir, f).replace(os.sep, "/")
            out.append((os.path.join(root, f), rel, only))
    return out


def load_all(accounts: dict) -> list:
    if not os.path.isdir(JOURNAL_DIR):
        raise LedgerError(f"no journals directory at {JOURNAL_DIR}")
    entries: list[Entry] = []
    files = journal_files()
    if not files:
        raise LedgerError(f"no .journal files under {JOURNAL_DIR}")
    problems = []
    for path, rel, only in files:
        try:
            entries.extend(parse_journal(path, accounts, name=rel, only_entity=only))
        except LedgerError as exc:
            problems.append(str(exc))
    if problems:
        raise LedgerError("\n".join(problems))
    entries.sort(key=lambda e: (e.date, e.source, e.line_no))
    return entries


def mirror_errors(entries: list) -> list:
    """The intercompany current account must net to zero across the group.

    Every real intercompany item is a 1290 debit in one entity and a 2490
    credit in the other, so group-wide the two accounts sum to nothing. If
    they don't, one side was booked and the other was forgotten — which is
    how intercompany balances quietly diverge and then take a day to unpick.
    The rule was written in accounts.csv and F-05 from the start; this makes
    the tool enforce it instead of asking a human to remember.

    Share capital is deliberately NOT in here — an unpaid subscription sits in
    2495 against the subsidiary's 3110 contra-equity, which is a different
    relationship and does not belong in a running current account.
    """
    total = Decimal("0")
    seen = False
    for e in entries:
        for p in e.postings:
            if p.account in ("1290", "2490"):
                total += p.amount or Decimal("0")
                seen = True
    if seen and total != 0:
        return [f"intercompany does not mirror: 1290 and 2490 net to "
                f"{total:+,.2f} across the group, and must net to zero. "
                f"One leg of an intercompany item is missing — run "
                f"`books.py ledger 1290` and `books.py ledger 2490`."]
    return []


SCHEMA = """
DROP TABLE IF EXISTS posting;
DROP TABLE IF EXISTS entry;
DROP TABLE IF EXISTS account;
CREATE TABLE account (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
    note TEXT, is_heading INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE entry (
    id INTEGER PRIMARY KEY, date TEXT NOT NULL, entity TEXT NOT NULL,
    narration TEXT NOT NULL, ref TEXT, doc TEXT, source TEXT, line_no INTEGER
);
CREATE TABLE posting (
    id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entry(id),
    account TEXT NOT NULL REFERENCES account(code),
    amount TEXT NOT NULL,   -- signed, as text to keep Decimal exact
    memo TEXT
);
CREATE INDEX ix_posting_account ON posting(account);
CREATE INDEX ix_entry_date ON entry(date);
"""


def check_journals() -> dict:
    """Parse journals and mirrors. Never posts. Never reads the outbox."""
    empty = {
        "ok": False,
        "entries": 0,
        "postings": 0,
        "balanced": False,
        "error": "",
        "line": "REJECTED — the journals were not posted",
        "by_entity": {},
    }
    try:
        accounts = load_accounts()
        entries = load_all(accounts)
    except LedgerError as exc:
        empty["error"] = str(exc)
        return empty
    problems = mirror_errors(entries)
    by_entity: dict[str, dict] = {}
    for e in entries:
        slot = by_entity.setdefault(e.entity, {"entries": 0, "postings": 0})
        slot["entries"] += 1
        slot["postings"] += len(e.postings)
    n = sum(len(e.postings) for e in entries)
    if problems:
        empty["entries"] = len(entries)
        empty["postings"] = n
        empty["error"] = "\n".join(problems)
        empty["by_entity"] = by_entity
        return empty
    return {
        "ok": True,
        "entries": len(entries),
        "postings": n,
        "balanced": True,
        "error": "",
        "line": (
            f"OK — {len(entries)} entries, {n} postings, all balanced, "
            "intercompany mirrors."
        ),
        "by_entity": by_entity,
        "_accounts": accounts,
        "_entries": entries,
    }


def post(accounts: dict, entries: list) -> None:
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    con.executemany(
        "INSERT INTO account (code,name,type,note,is_heading) VALUES (?,?,?,?,?)",
        [(a["code"], a["name"], a["type"], a["note"], int(a["heading"])) for a in accounts.values()],
    )
    for e in entries:
        cur = con.execute(
            "INSERT INTO entry (date,entity,narration,ref,doc,source,line_no) VALUES (?,?,?,?,?,?,?)",
            (e.date, e.entity, e.narration, e.tags.get("ref"), e.tags.get("doc"), e.source, e.line_no),
        )
        eid = cur.lastrowid
        con.executemany(
            "INSERT INTO posting (entry_id,account,amount,memo) VALUES (?,?,?,?)",
            [(eid, p.account, str(p.amount), p.memo) for p in e.postings],
        )
    con.commit()
    con.close()


def balances(entity=None, consolidated=False, date_from=None, date_to=None) -> dict:
    con = sqlite3.connect(DB)
    sql = ("SELECT p.account, p.amount FROM posting p JOIN entry e ON e.id = p.entry_id WHERE 1=1")
    args: list = []
    if entity and not consolidated:
        sql += " AND e.entity = ?"
        args.append(entity)
    if date_from:
        sql += " AND e.date >= ?"
        args.append(date_from)
    if date_to:
        sql += " AND e.date <= ?"
        args.append(date_to)
    out: dict = {}
    for code, amt in con.execute(sql, args):
        if consolidated and code in INTERCOMPANY:
            continue
        out[code] = out.get(code, Decimal("0")) + Decimal(amt)
    con.close()
    return {k: v for k, v in out.items() if v != 0}


def chart() -> dict:
    con = sqlite3.connect(DB)
    rows = con.execute("SELECT code,name,type,is_heading FROM account ORDER BY code").fetchall()
    con.close()
    return {r[0]: {"code": r[0], "name": r[1], "type": r[2], "heading": bool(r[3])} for r in rows}


def display(code: str, amount: Decimal, acc: dict) -> Decimal:
    return -amount if acc[code]["type"] in NATURAL_CREDIT else amount


def fmt(d: Decimal) -> str:
    return f"{d:>14,.2f}"


def rule(char="-", n=64) -> str:
    return char * n


def scopes(args) -> list:
    if args.consolidated:
        print("\n  note: --consolidated drops intercompany balances only. It is a management\n"
              "  view, not statutory consolidation — no non-controlling interest is computed.")
        return [("GROUP (management view)", None, True)]
    if args.entity:
        return [(args.entity, args.entity, False)]
    return [(k, k, False) for k in ENTITIES]


def cmd_tb(args) -> None:
    acc = chart()
    for label, ent, con in scopes(args):
        bal = balances(ent, con, None, args.to)
        print(f"\nTRIAL BALANCE — {label}" + (f"  as at {args.to}" if args.to else ""))
        print(rule("="))
        print(f"{'Account':<44}{'Debit':>14}{'Credit':>14}")
        print(rule())
        td = tc = Decimal("0")
        for code in sorted(bal):
            v = bal[code]
            d, c = (v, Decimal("0")) if v > 0 else (Decimal("0"), -v)
            td += d
            tc += c
            print(f"{code} {acc[code]['name'][:38]:<39}{fmt(d) if d else '':>14}{fmt(c) if c else '':>14}")
        print(rule())
        print(f"{'':<44}{fmt(td)}{fmt(tc)}")
        if td != tc:
            print(f"  ** OUT OF BALANCE by {td - tc:+,.2f} **")


def cmd_pl(args) -> None:
    acc = chart()
    for label, ent, con in scopes(args):
        bal = balances(ent, con, args.from_, args.to)
        period = f"{args.from_ or 'inception'} to {args.to or 'date'}"
        print(f"\nPROFIT AND LOSS — {label}   {period}")
        print(rule("="))
        total = Decimal("0")
        for group, types in (("INCOME", ("INCOME",)), ("COST OF SALES AND EXPENSES", ("EXPENSE",))):
            sub = Decimal("0")
            rows = [(c, v) for c, v in sorted(bal.items()) if acc[c]["type"] in types]
            print(f"\n{group}")
            if not rows:
                print("  (none)")
            for code, v in rows:
                dv = display(code, v, acc)
                sub += dv
                print(f"  {code} {acc[code]['name'][:40]:<41}{fmt(dv)}")
            print(f"  {'':<45}{rule('-', 14)}")
            print(f"  {'Total ' + group.title():<45}{fmt(sub)}")
            total = sub if group == "INCOME" else total - sub
        print(rule())
        word = "PROFIT" if total >= 0 else "LOSS"
        print(f"{'NET ' + word:<47}{fmt(abs(total))}")


def cmd_bs(args) -> None:
    acc = chart()
    for label, ent, con in scopes(args):
        bal = balances(ent, con, None, args.to)
        print(f"\nBALANCE SHEET — {label}" + (f"  as at {args.to}" if args.to else ""))
        print(rule("="))
        result = Decimal("0")
        for code, v in bal.items():
            if acc[code]["type"] == "INCOME":
                result += -v
            elif acc[code]["type"] == "EXPENSE":
                result -= v
        totals = {}
        labels = {"ASSET": ("ASSETS", "Total assets"),
                  "LIABILITY": ("LIABILITIES", "Total liabilities"),
                  "EQUITY": ("EQUITY", "Total equity")}
        for group in ("ASSET", "LIABILITY", "EQUITY"):
            heading, total_label = labels[group]
            sub = Decimal("0")
            rows = [(c, v) for c, v in sorted(bal.items()) if acc[c]["type"] == group]
            print(f"\n{heading}")
            if not rows and group != "EQUITY":
                print("  (none)")
            for code, v in rows:
                dv = display(code, v, acc)
                sub += dv
                print(f"  {code} {acc[code]['name'][:40]:<41}{fmt(dv)}")
            if group == "EQUITY":
                sub += result
                print(f"  ---- Result for the period{'':<20}{fmt(result)}")
            print(f"  {'':<45}{rule('-', 14)}")
            print(f"  {total_label:<45}{fmt(sub)}")
            totals[group] = sub
        print(rule())
        lhs = totals["ASSET"]
        rhs = totals["LIABILITY"] + totals["EQUITY"]
        print(f"{'Assets':<47}{fmt(lhs)}")
        print(f"{'Liabilities + Equity':<47}{fmt(rhs)}")
        print("  ** BALANCE SHEET DOES NOT BALANCE **" if lhs != rhs else "  balanced")


def cmd_ledger(args) -> None:
    acc = chart()
    con = sqlite3.connect(DB)
    sql = ("SELECT e.date, e.entity, e.narration, e.ref, p.amount, p.memo "
           "FROM posting p JOIN entry e ON e.id = p.entry_id WHERE p.account = ?")
    a: list = [args.account]
    if args.entity:
        sql += " AND e.entity = ?"
        a.append(args.entity)
    if args.from_:
        sql += " AND e.date >= ?"
        a.append(args.from_)
    if args.to:
        sql += " AND e.date <= ?"
        a.append(args.to)
    rows = con.execute(sql + " ORDER BY e.date, e.id", a).fetchall()
    con.close()
    name = acc.get(args.account, {}).get("name", "?")
    print(f"\nLEDGER — {args.account} {name}")
    print(rule("=", 96))
    print(f"{'Date':<12}{'Ent':<7}{'Narration':<44}{'Amount':>14}{'Balance':>16}")
    print(rule("-", 96))
    run = Decimal("0")
    for date, ent, narr, ref, amt, memo in rows:
        run += Decimal(amt)
        label = narr if not ref else f"{narr} [{ref}]"
        print(f"{date:<12}{ent:<7}{label[:43]:<44}{fmt(Decimal(amt))}{run:>16,.2f}")
    print(rule("-", 96))
    print(f"{'':<63}{'closing':>14}{run:>16,.2f}")
    acct_type = acc.get(args.account, {}).get("type")
    if acct_type in NATURAL_CREDIT and run != 0:
        side = "credit" if run < 0 else "DEBIT (unusual for this account)"
        print(f"{'':<63}{'':>14}{abs(run):>16,.2f}  {side}")


def cmd_accounts(args) -> None:
    for a in load_accounts().values():
        if a["heading"]:
            print(f"\n{a['code']}  {a['name']}")
        else:
            scope = "" if a["entities"] == "BOTH" else f"[{a['entities']}] "
            mark = "BLOCKED " if a["status"] == "blocked" else ""
            note = f"   — {mark}{a['note']}" if (a["note"] or mark) else ""
            print(f"  {a['code']}  {a['name']:<46}{a['type']:<10}{scope}{note}")


def cmd_entities(args) -> None:
    con = sqlite3.connect(DB)
    print(f"\n{'Code':<8}{'Entity':<34}{'Reg. No.':<13}{'TIN':<10}{'Entries':>8}")
    print(rule("-", 74))
    for code, (name, reg, tin) in ENTITIES.items():
        n = con.execute("SELECT COUNT(*) FROM entry WHERE entity = ?", (code,)).fetchone()[0]
        print(f"{code:<8}{name:<34}{reg:<13}{tin:<10}{n:>8}")
    con.close()


def main() -> int:
    # The Windows console defaults to cp1252 and mangles the dashes in account names.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    p = argparse.ArgumentParser(prog="books", description="the foundation engine — double-entry ledger")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--entity", choices=list(ENTITIES))
        sp.add_argument("--consolidated", action="store_true")
        sp.add_argument("--from", dest="from_", metavar="YYYY-MM-DD")
        sp.add_argument("--to", metavar="YYYY-MM-DD")
        return sp

    sub.add_parser("check")
    sub.add_parser("post")
    sub.add_parser("accounts")
    sub.add_parser("entities")
    common(sub.add_parser("tb"))
    common(sub.add_parser("pl"))
    common(sub.add_parser("bs"))
    common(sub.add_parser("ledger")).add_argument("account")

    args = p.parse_args()

    if args.cmd == "accounts":
        cmd_accounts(args)
        return 0

    if args.cmd in ("check", "post"):
        summary = check_journals()
        if not summary["ok"]:
            print("REJECTED — the journals were not posted:\n", file=sys.stderr)
            print(summary["error"], file=sys.stderr)
            return 1
        if args.cmd == "check":
            print(summary["line"])
            return 0
        post(summary["_accounts"], summary["_entries"])
        print(f"Posted {summary['entries']} entries ({summary['postings']} postings) "
              f"to {os.path.basename(DB)}.")
        return 0

    if not os.path.exists(DB):
        print("No books.db yet. Run:  python books.py post", file=sys.stderr)
        return 1

    {"tb": cmd_tb, "pl": cmd_pl, "bs": cmd_bs, "ledger": cmd_ledger, "entities": cmd_entities}[args.cmd](args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
