#!/usr/bin/env python3
"""Occupancy-scoped employee create. No seed, no invented pay, no journals."""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import auth as A
import masters as M
import serve as S

PAYROLL = os.path.join(HERE, "ops", "masters", "payroll.json")
USERS = os.path.join(HERE, "ops", "masters", "users.json")


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
    raw = open(PAYROLL, encoding="utf-8").read()
    users_raw = open(USERS, encoding="utf-8").read()
    data0 = json.loads(raw)
    _assert(data0.get("employees") == [], "live roster must stay empty until Ali adds someone")
    _assert(data0.get("pay_runs") == [], "no invented pay runs")
    journals = _journal_stamp()
    prev_audit = M._AUDIT_ROWS
    M._AUDIT_ROWS = []
    try:
        _assert(not M.may_create_employee("director", None), "Group is not a roster")
        _assert(not M.may_create_employee("technician", "CI"), "tech cannot create")
        _assert(not M.may_create_employee("counter", "CI"), "counter is CRM not HR")
        _assert(M.may_create_employee("managing_director", "CI"), "CI MD can create CI")
        _assert(M.may_create_employee("director", "STARQ"), "Ali director can create Starq")
        _assert(not M.may_create_employee("director", "GROUP"), "no GROUP occupancy")

        blocked = M.payroll_gl_holds("CI")
        _assert(len(blocked) == 1, blocked)
        _assert(blocked[0]["status"] == "blocked", blocked[0])
        _assert(blocked[0].get("draft") in (None, ""), "empty roster must not draft GL")
        _assert("Will not invent" in (blocked[0].get("reason") or ""), blocked[0])

        row, err = M.create_employee(
            name="   ", seat="technician", occupancy="CI",
            actor_seat="director", person_id="ali",
        )
        _assert(err is not None, "empty name")
        row, err = M.create_employee(
            name="fake@gmail.com", seat="technician", occupancy="CI",
            actor_seat="director", person_id="ali",
        )
        _assert(err is not None, "gmail as name")
        row, err = M.create_employee(
            name="Bay helper", seat="technician", occupancy="CI",
            actor_seat="technician", person_id="nashid",
        )
        _assert(err is not None, "tech refused")
        row, err = M.create_employee(
            name="Bay helper", seat="technician", occupancy="",
            actor_seat="director", person_id="ali",
        )
        _assert(err is not None, "no occupancy")
        row, err = M.create_employee(
            name="nashid", seat="technician", occupancy="STARQ",
            actor_seat="director", person_id="ali",
        )
        _assert(err is not None, "Nashid never Starq")
        _assert(json.loads(open(PAYROLL, encoding="utf-8").read())["employees"] == [],
                "refusals must not write")

        row, err = M.create_employee(
            name="Bay helper", seat="technician", occupancy="CI",
            actor_seat="managing_director", person_id="nashid",
        )
        _assert(err is None, err)
        _assert(row["entity"] == "CI", row)
        _assert(row["seat"] == "technician", row)
        _assert(row["rate_mvr"] is None, "must not invent pay")
        _assert(row["person_id"] == "", "unknown name is not a login user")
        _assert(row["id"].startswith("CI-EE-"), row)

        row, err = M.create_employee(
            name="bay helper", seat="technician", occupancy="CI",
            actor_seat="director", person_id="ali",
        )
        _assert(err is not None, "duplicate")

        holds = M.payroll_gl_holds("CI")
        _assert(holds[0]["status"] == "blocked", holds[0])
        _assert("Rates empty" in (holds[0].get("reason") or ""), holds[0])
        _assert(holds[0].get("draft") in (None, ""), "no invented payroll amount")

        row, err = M.create_employee(
            name="ali", seat="director", occupancy="STARQ",
            actor_seat="financial_controller", person_id="ali",
        )
        _assert(err is None, err)
        _assert(row["entity"] == "STARQ", row)
        _assert(row["id"].startswith("ST-EE-"), row)
        _assert(row["person_id"] == "ali", "honest link to users.json")
        _assert(row["rate_mvr"] is None, row)

        row, err = M.create_employee(
            name="nashid", seat="managing_director", occupancy="CI",
            actor_seat="managing_director", person_id="nashid",
        )
        _assert(err is None, err)
        _assert(row["person_id"] == "nashid", row)
        _assert(row["rate_mvr"] is None, row)

        ci_only = M.employees("CI")
        st_only = M.employees("STARQ")
        _assert(all(r["entity"] == "CI" for r in ci_only), ci_only)
        _assert(all(r["entity"] == "STARQ" for r in st_only), st_only)
        _assert(all(r.get("rate_mvr") in (None, "") for r in ci_only + st_only), "no salaries")

        nashid = _user(person_id="nashid", acting_as="managing_director",
                       entities=["club-ignition"])
        _assert(A.may_view_books(nashid, "CI") and not A.may_view_books(nashid, "STARQ"),
                "Nashid occupancy")
        html_ci = S.h_settings({}, "CI", "", "", nashid)
        _assert("Add employee" in html_ci, "CI MD gets create form")
        _assert("Bay helper" in html_ci, html_ci)
        html_st = S.h_settings({}, "STARQ", "", "", nashid)
        _assert("Add employee" not in html_st, "Nashid must not get a Starq HR form")
        tech = _user(person_id="nashid", acting_as="technician", entities=["club-ignition"])
        html_tech = S.h_settings({}, "CI", "", "", tech)
        _assert("Add employee" not in html_tech, "tech no form")
        _assert("cannot create employees" in html_tech, html_tech)

        ali = _user(person_id="ali", acting_as="director",
                    entities=["starq", "club-ignition", "group"],
                    email="founder@example.com")
        html_group = S.h_settings({}, None, "", "", ali)
        _assert("Add employee" not in html_group, "Group is not a write occupancy")
        _assert("not a third roster" in html_group, html_group)
        html_ali_st = S.h_settings({}, "STARQ", "", "", ali)
        _assert("Add employee" in html_ali_st, "Ali Starq form")
        _assert("ali" in html_ali_st, html_ali_st)
        _assert("Bay helper" not in html_ali_st, "CI name must not leak onto Starq roster")
        _assert("person_id" in html_ali_st, "users.json still shown")

        row, err = M.set_employee_rate(
            "CI-EE-1", "1500", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is None, err)
        _assert(float(row["rate_mvr"]) == 1500, row)
        html_rate = S.h_settings({}, "CI", "", "", ali)
        _assert("Payroll rate" in html_rate, "rate form when roster exists")
        _assert("1500" in html_rate, html_rate)
        row, err = M.set_employee_rate(
            "CI-EE-1", "", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is None, err)
        _assert(row["rate_mvr"] is None, "empty clears rate")

        live_users = json.loads(open(USERS, encoding="utf-8").read())
        _assert(live_users == json.loads(users_raw), "must not rewrite users.json")

        tmp = json.loads(open(PAYROLL, encoding="utf-8").read())
        for r in tmp["employees"]:
            if r.get("id") == "CI-EE-1":
                r["rate_mvr"] = 1000
        open(PAYROLL, "w", encoding="utf-8").write(json.dumps(tmp, indent=2) + "\n")
        drafted = M.payroll_gl_holds("CI")
        _assert(drafted[0]["status"] == "draft", drafted[0])
        _assert("1,000.00" in (drafted[0].get("draft") or ""), drafted[0])
        _assert("6100" in (drafted[0].get("accounts") or []), drafted[0])
        still_st = M.payroll_gl_holds("STARQ")
        _assert(still_st[0]["status"] == "blocked", "Starq rate still empty")

        _assert(_journal_stamp() == journals, "create must not touch journals/")
    finally:
        M._AUDIT_ROWS = prev_audit
        open(PAYROLL, "w", encoding="utf-8").write(raw)
    live = json.loads(open(PAYROLL, encoding="utf-8").read())
    _assert(live.get("employees") == [], "restore empty roster")
    _assert(json.loads(open(USERS, encoding="utf-8").read()) == json.loads(users_raw),
            "users.json restored")
    print("OK — occupancy employee create, empty roster restored, journals untouched")


if __name__ == "__main__":
    main()
