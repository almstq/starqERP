#!/usr/bin/env python3
"""Occupancy-scoped sell_price_mvr. Empty restored. Leftover never priced. No journals."""
from __future__ import annotations

import json
import os
import sys
from decimal import Decimal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import auth as A
import masters as M
import serve as S

PRODUCTS = os.path.join(HERE, "ops", "masters", "products.json")
INVENTORY = os.path.join(HERE, "ops", "masters", "inventory.json")


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


def _prices_empty(data):
    for p in data.get("products") or []:
        sku = str(p.get("sku") or "")
        if sku == "INK-PAINT-LEFT":
            _assert("sell_price_mvr" not in p, p)
            continue
        _assert(p.get("sell_price_mvr") in (None, ""), p)


def main():
    raw = open(PRODUCTS, encoding="utf-8").read()
    inv_raw = open(INVENTORY, encoding="utf-8").read()
    data0 = json.loads(raw)
    _prices_empty(data0)
    journals = _journal_stamp()
    prev_audit = M._AUDIT_ROWS
    M._AUDIT_ROWS = []
    try:
        _assert(not M.may_set_sell_price("director", None), "Group is not a write occupancy")
        _assert(not M.may_set_sell_price("technician", "CI"), "tech cannot price")
        _assert(M.may_set_sell_price("managing_director", "CI"), "CI MD can price CI")
        _assert(M.may_set_sell_price("director", "STARQ"), "Ali director can price Starq")
        _assert(not M.may_set_sell_price("director", "GROUP"), "no GROUP occupancy")

        row, err = M.set_sell_price(
            "INK-PAINT-LEFT", "12", occupancy="CI", seat="director", person_id="ali",
        )
        _assert(err is not None and "Leftover" in err, err)
        row, err = M.set_sell_price(
            "INK-CAGE", "9", occupancy="CI", seat="technician", person_id="nashid",
        )
        _assert(err is not None, "tech refused")
        row, err = M.set_sell_price(
            "INK-CAGE", "9", occupancy="STARQ", seat="director", person_id="ali",
        )
        _assert(err is not None, "CI SKU not on Starq")
        row, err = M.set_sell_price(
            "ST-8211", "9", occupancy="CI", seat="director", person_id="ali",
        )
        _assert(err is not None, "Starq SKU not on CI")
        _prices_empty(json.loads(open(PRODUCTS, encoding="utf-8").read()))

        row, err = M.set_sell_price(
            "INK-CAGE", "15.50", occupancy="CI", seat="managing_director", person_id="nashid",
        )
        _assert(err is None, err)
        _assert(row["entity"] == "CI", row)
        _assert(row["sku"] == "INK-CAGE", row)
        _assert(float(row["sell_price_mvr"]) == 15.5, row)
        _assert(M.sell_price_mvr("INK-CAGE") == Decimal("15.5"), M.sell_price_mvr("INK-CAGE"))
        _assert(M.sell_price_mvr("INK-PAINT") is None, "other SKUs stay empty")

        row, err = M.set_sell_price(
            "INK-CAGE", "", occupancy="CI", seat="director", person_id="ali",
        )
        _assert(err is None, err)
        _assert(M.sell_price_mvr("INK-CAGE") is None, "empty clears")

        nashid = _user(person_id="nashid", acting_as="managing_director",
                       entities=["club-ignition"])
        tech = _user(person_id="nashid", acting_as="technician",
                     entities=["club-ignition"])
        html_ci = S.h_products({}, "CI", "", "", nashid)
        _assert("Sell price" in html_ci, "CI MD gets price form")
        _assert("INK-PAINT-LEFT" not in html_ci.split("Sell price")[-1].split("</form>")[0],
                "leftover not in price select")
        html_st = S.h_products({}, "STARQ", "", "", nashid)
        _assert("Save sell price" not in html_st, "Nashid must not get a Starq price form")
        _assert("not yours" in html_st, html_st)
        _assert("INK-CAGE" not in html_st.split("<table")[1].split("</table>")[0] if "<table" in html_st else True,
                "CI SKU must not leak onto Starq product list")

        ali = _user(person_id="ali", acting_as="director",
                    entities=["starq", "club-ignition", "group"],
                    email="a.musthaq@gmail.com")
        html_group = S.h_products({}, None, "", "", ali)
        _assert("Save sell price" not in html_group, "Group is not a write occupancy")
        html_ali_st = S.h_products({}, "STARQ", "", "", ali)
        _assert("Save sell price" in html_ali_st, "Ali Starq form")
        _assert("ST-8211" in html_ali_st, html_ali_st)
        _assert("no shop POS" in S.h_pos({}, "STARQ", "", "", ali) or "no shop POS" in S.h_pos({}, "STARQ", "", ""),
                "Starq POS still refused")

        row, err = M.create_sku(
            sku="INK-PAINT-LEFT", name="Again", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None and "Leftover" in err, err)
        row, err = M.create_sku(
            sku="CI-THINNER", name="Leftover paint tin", occupancy="CI",
            seat="director", person_id="ali",
        )
        _assert(err is not None and "Leftover" in err, err)
        row, err = M.create_sku(
            sku="CI-THINNER", name="Thinner", occupancy="CI",
            seat="technician", person_id="nashid",
        )
        _assert(err is not None, "tech refused sku")
        row, err = M.create_sku(
            sku="CI-THINNER", name="Thinner", occupancy="STARQ",
            seat="director", person_id="ali",
        )
        _assert(err is None, err)
        _assert(row["entity"] == "STARQ", row)
        _assert(row["sell_price_mvr"] is None, row)
        inv_ln = next(x for x in M.inventory()["lines"] if x["sku"] == "CI-THINNER")
        _assert(inv_ln.get("qty") is None, inv_ln)
        _assert(inv_ln.get("qty_status") == "service", inv_ln)
        html_sku = S.h_products({}, "STARQ", "", "", ali)
        _assert("Add SKU" in html_sku, "Ali Starq SKU form")
        html_ci_sku = S.h_products({}, "CI", "", "", nashid)
        _assert("Add SKU" in html_ci_sku, "CI MD SKU form")
        html_tech_sku = S.h_products({}, "CI", "", "", tech)
        _assert("Add SKU" not in html_tech_sku, "tech no sku form")

        _assert(_journal_stamp() == journals, "price write must not touch journals/")
    finally:
        M._AUDIT_ROWS = prev_audit
        open(PRODUCTS, "w", encoding="utf-8").write(raw)
        open(INVENTORY, "w", encoding="utf-8").write(inv_raw)
    live = json.loads(open(PRODUCTS, encoding="utf-8").read())
    _prices_empty(live)
    live_inv = json.loads(open(INVENTORY, encoding="utf-8").read())
    _assert(not any(ln.get("sku") == "CI-THINNER" for ln in live_inv.get("lines") or []),
            "restore must drop test SKU qty line")
    _assert("8%" not in open(PRODUCTS, encoding="utf-8").read(), "no GST 8% on products")
    print("OK — occupancy sell_price_mvr, leftover blocked, empty restored, journals untouched")


if __name__ == "__main__":
    main()
