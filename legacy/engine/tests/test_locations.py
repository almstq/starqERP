#!/usr/bin/env python3
"""Occupancy-scoped location create. Keep H. Kiev. No fake shops. Restore."""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import auth as A
import masters as M
import serve as S

LOCS = os.path.join(HERE, "ops", "masters", "locations.json")


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
    raw = open(LOCS, encoding="utf-8").read()
    data0 = json.loads(raw)
    names0 = {(r.get("entity"), r.get("name")) for r in data0.get("locations") or []}
    _assert(("CI", "H. Kiev godown") in names0, "live must keep H. Kiev")
    _assert(("STARQ", "Starq occupancy — no shop floor") in names0, "live Starq no-shop")
    journals = _journal_stamp()
    prev_audit = M._AUDIT_ROWS
    M._AUDIT_ROWS = []
    try:
        _assert(not M.may_create_location("director", None), "Group is not a site list")
        _assert(not M.may_create_location("technician", "CI"), "tech cannot create")
        _assert(M.may_create_location("managing_director", "CI"), "CI MD can create CI")
        _assert(M.may_create_location("director", "STARQ"), "Ali director can create Starq")
        _assert(not M.may_create_location("director", "GROUP"), "no GROUP occupancy")

        row, err = M.create_location(
            name="   ", kind="office", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "empty name")
        row, err = M.create_location(
            name="Malé Shop", kind="pos", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "POS type refused")
        row, err = M.create_location(
            name="Starq shop", kind="workshop", occupancy="STARQ",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "Starq workshop refused")
        row, err = M.create_location(
            name="H. Kiev godown", kind="workshop", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "do not clone H. Kiev")
        row, err = M.create_location(
            name="Leftover paint bay", kind="other", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None, "leftover paint not a site")
        live_mid = json.loads(open(LOCS, encoding="utf-8").read())
        _assert(len(live_mid.get("locations") or []) == len(data0.get("locations") or []),
                "refusals must not write")

        row, err = M.create_location(
            name="Counter desk", kind="office", occupancy="CI",
            seat="managing_director", person_id="nashid",
        )
        _assert(err is None, err)
        _assert(row["entity"] == "CI", row)
        _assert(row["kind"] == "office", row)
        _assert(row["is_pos"] is False, row)
        _assert(row["id"].startswith("CI-LOC-"), row)

        row, err = M.create_location(
            name="Books desk", kind="office", occupancy="STARQ",
            seat="director", person_id="ali",
        )
        _assert(err is None, err)
        _assert(row["entity"] == "STARQ", row)
        _assert(row["id"].startswith("ST-LOC-"), row)

        ci_only = M.locations("CI")
        st_only = M.locations("STARQ")
        _assert(all(r["entity"] == "CI" for r in ci_only), ci_only)
        _assert(all(r["entity"] == "STARQ" for r in st_only), st_only)
        _assert(any(r.get("name") == "H. Kiev godown" for r in ci_only), ci_only)
        _assert(not any(r.get("is_pos") for r in ci_only + st_only), "no POS sites")

        nashid = _user(person_id="nashid", acting_as="managing_director",
                       entities=["club-ignition"])
        html_ci = S.h_settings({}, "CI", "", "", nashid)
        _assert("Add location" in html_ci, "CI MD gets location form")
        _assert("H. Kiev godown" in html_ci, html_ci)
        html_st = S.h_settings({}, "STARQ", "", "", nashid)
        _assert("Add location" not in html_st, "Nashid must not get a Starq location form")
        tech = _user(person_id="nashid", acting_as="technician", entities=["club-ignition"])
        html_tech = S.h_settings({}, "CI", "", "", tech)
        _assert("Add location" not in html_tech, "tech no form")

        ali = _user(person_id="ali", acting_as="director",
                    entities=["starq", "club-ignition", "group"],
                    email="founder@example.com")
        html_group = S.h_settings({}, None, "", "", ali)
        _assert("Add location" not in html_group, "Group is not a write occupancy")
        html_ali_st = S.h_settings({}, "STARQ", "", "", ali)
        _assert("Add location" in html_ali_st, "Ali Starq form")
        _assert("Books desk" in html_ali_st, html_ali_st)
        _assert("Counter desk" not in html_ali_st, "CI name must not leak onto Starq locations")
        _assert("H. Kiev godown" not in html_ali_st, "H. Kiev stays CI")

        _assert(_journal_stamp() == journals, "create must not touch journals/")
    finally:
        M._AUDIT_ROWS = prev_audit
        open(LOCS, "w", encoding="utf-8").write(raw)
    live = json.loads(open(LOCS, encoding="utf-8").read())
    names = {(r.get("entity"), r.get("name")) for r in live.get("locations") or []}
    _assert(("CI", "H. Kiev godown") in names, "restore H. Kiev")
    _assert(("STARQ", "Starq occupancy — no shop floor") in names, "restore Starq no-shop")
    _assert(len(live.get("locations") or []) == len(data0.get("locations") or []),
            "restore location count")
    print("OK — occupancy location create, H. Kiev kept, restored, journals untouched")


if __name__ == "__main__":
    main()
