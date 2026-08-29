#!/usr/bin/env python3
"""Occupancy-scoped contact create. No seed, no fake Gmails, no journals."""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import auth as A
import masters as M
import serve as S

CONTACTS = os.path.join(HERE, "ops", "masters", "contacts.json")


def _assert(cond, msg):
    if not cond:
        raise SystemExit(f"FAIL: {msg}")


def _journal_stamp():
    root = os.path.join(HERE, "journals")
    out = []
    for dirpath, _d, files in os.walk(root):
        for fn in files:
            if fn.endswith(".journal"):
                p = os.path.join(dirpath, fn)
                out.append((p, os.path.getmtime(p), os.path.getsize(p)))
    return out


def _user(*, person_id, acting_as, entities, email="nobody@localhost"):
    return A.User(
        email=email,
        person_id=person_id,
        name=person_id,
        seats=[acting_as],
        acting_as=acting_as,
        csrf="test",
        session_key="test",
        default_seat=acting_as,
        entities=list(entities),
    )


def main():
    raw = open(CONTACTS, encoding="utf-8").read()
    data0 = json.loads(raw)
    _assert(data0.get("contacts") == [], "live master must stay empty until Ali adds someone")
    journals = _journal_stamp()
    prev_audit = M._AUDIT_ROWS
    M._AUDIT_ROWS = []
    try:
        _assert(not M.may_create_contact("director", None), "Group is not a master")
        _assert(not M.may_create_contact("technician", "CI"), "tech cannot create")
        _assert(M.may_create_contact("managing_director", "CI"), "CI MD can create CI")
        _assert(M.may_create_contact("director", "STARQ"), "Ali director can create Starq")
        _assert(not M.may_create_contact("director", "GROUP"), "no GROUP occupancy")

        row, err = M.create_contact(
            name="   ", kind="customer", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "empty name")
        row, err = M.create_contact(
            name="fake@gmail.com", kind="customer", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "gmail as name")
        row, err = M.create_contact(
            name="Walk-in", kind="customer", occupancy="CI",
            seat="technician", person_id="nashid",
        )
        _assert(err is not None, "tech refused")
        row, err = M.create_contact(
            name="Walk-in", kind="customer", occupancy="",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "no occupancy")
        _assert(json.loads(open(CONTACTS, encoding="utf-8").read())["contacts"] == [],
                "refusals must not write")

        row, err = M.create_contact(
            name="Walk-in", kind="customer", occupancy="CI",
            seat="managing_director", person_id="nashid",
        )
        _assert(err is None, err)
        _assert(row["entity"] == "CI", row)
        _assert(row["kind"] == "customer", row)
        _assert(row["email"] == "", "must not invent email")
        _assert(row["id"].startswith("CI-CT-"), row)

        row, err = M.create_contact(
            name="walk-in", kind="customer", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "duplicate")

        row, err = M.create_contact(
            name="Parts house", kind="vendor", occupancy="STARQ",
            seat="financial_controller", person_id="ali",
        )
        _assert(err is None, err)
        _assert(row["entity"] == "STARQ", row)
        _assert(row["id"].startswith("ST-CT-"), row)
        _assert(row["kind"] == "vendor", row)

        ci_only = M.contacts("CI")
        st_only = M.contacts("STARQ")
        _assert(all(r["entity"] == "CI" for r in ci_only), ci_only)
        _assert(all(r["entity"] == "STARQ" for r in st_only), st_only)
        _assert(not any(r.get("email") for r in ci_only + st_only), "no gmails")

        nashid = _user(person_id="nashid", acting_as="managing_director",
                       entities=["club-ignition"])
        _assert(A.may_view_books(nashid, "CI") and not A.may_view_books(nashid, "STARQ"),
                "Nashid occupancy")
        html_ci = S.h_contacts({}, "CI", "", "", nashid)
        _assert("Add contact" in html_ci, "CI MD gets create form")
        _assert("Ops-derived names (not masters)" in html_ci or "not the master" in html_ci, html_ci)
        html_st = S.h_contacts({}, "STARQ", "", "", nashid)
        _assert("Add contact" not in html_st, "Nashid must not get a Starq create form")
        tech = _user(person_id="nashid", acting_as="technician", entities=["club-ignition"])
        html_tech = S.h_contacts({}, "CI", "", "", tech)
        _assert("Add contact" not in html_tech, "tech no form")
        _assert("cannot create contacts" in html_tech, html_tech)

        ali = _user(person_id="ali", acting_as="director",
                    entities=["starq", "club-ignition", "group"],
                    email="a.musthaq@gmail.com")
        html_group = S.h_contacts({}, None, "", "", ali)
        _assert("Add contact" not in html_group, "Group is not a write occupancy")
        _assert("not a third master" in html_group, html_group)
        html_ali_st = S.h_contacts({}, "STARQ", "", "", ali)
        _assert("Add contact" in html_ali_st, "Ali Starq form")
        _assert("Parts house" in html_ali_st, html_ali_st)
        _assert("Walk-in" not in html_ali_st, "CI name must not leak onto Starq master list")
        _assert("Statement" in html_ali_st, "master contact should link to statement")
        _assert("Ledger view" in html_ali_st, "master contact should link to ledger view")
        _assert("/expenses?entity=STARQ" in html_ali_st, "vendor should link back to Expenses")

        derived = M.contacts_from_ops("CI")
        for d in derived:
            _assert(d.get("source") == "ops", d)
            _assert(d.get("master") is False, d)
            _assert("not a master" in (d.get("label") or ""), d)
            _assert("@" not in (d.get("name") or ""), d)
            _assert(d.get("entity") == "CI", d)

        import journal_outbox as JO
        orig_load = JO.load_events
        JO.load_events = lambda: [
            {"id": "E-T-CI-NM", "type": "CALL",
             "fields": {"entity": "CI", "customer": "CI Party Leak"}},
            {"id": "E-T-ST-NM", "type": "CALL",
             "fields": {"entity": "STARQ", "customer": "Starq Party Leak"}},
        ]
        try:
            ci_n = M.contacts_from_ops("CI")
            st_n = M.contacts_from_ops("STARQ")
            _assert(any(d.get("name") == "CI Party Leak" for d in ci_n), ci_n)
            _assert(not any(d.get("name") == "Starq Party Leak" for d in ci_n), ci_n)
            _assert(any(d.get("name") == "Starq Party Leak" for d in st_n), st_n)
            _assert(not any(d.get("name") == "CI Party Leak" for d in st_n), st_n)
        finally:
            JO.load_events = orig_load
        orig_load = JO.load_events
        call_named = {
            "id": "E-T-CALL-NAMED",
            "type": "CALL",
            "fields": {"customer": "Aisha", "phone": "7770000"},
        }
        call_empty = {"id": "E-T-CALL-EMPTY", "type": "CALL", "fields": {}}
        JO.load_events = lambda: [call_named, call_empty]
        try:
            row, err = M.create_contact_from_call(
                event_id="E-T-CALL-EMPTY", occupancy="CI",
                seat="managing_director", person_id="nashid",
            )
            _assert(err is not None, "empty CALL name")
            row, err = M.create_contact_from_call(
                event_id="E-T-CALL-NAMED", occupancy="STARQ",
                seat="director", person_id="ali",
            )
            _assert(err is not None, "CI CALL is not Starq")
            row, err = M.create_contact_from_call(
                event_id="E-T-CALL-NAMED", occupancy="CI",
                seat="managing_director", person_id="nashid",
            )
            _assert(err is None, err)
            _assert(row["name"] == "Aisha", row)
            _assert(row["entity"] == "CI", row)
            _assert(row["kind"] == "customer", row)
            _assert(row["email"] == "", row)
            html_call = S.h_contacts({}, "CI", "", "", nashid)
            _assert("Add CALL party to contacts" in html_call or "Aisha" in html_call, html_call)
        finally:
            JO.load_events = orig_load

        _assert(_journal_stamp() == journals, "create must not touch journals/")
    finally:
        M._AUDIT_ROWS = prev_audit
        open(CONTACTS, "w", encoding="utf-8").write(raw)
    live = json.loads(open(CONTACTS, encoding="utf-8").read())
    _assert(live.get("contacts") == [], "restore empty master")
    print("OK — occupancy contact create, empty master restored, journals untouched")


if __name__ == "__main__":
    main()
