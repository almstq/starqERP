#!/usr/bin/env python3
"""CI till stub consumes counted stock. Never journals/. No Starq POS."""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import masters as M
import pos as POS

INV = os.path.join(HERE, "ops", "masters", "inventory.json")
PRODUCTS = os.path.join(HERE, "ops", "masters", "products.json")
DRAFTS = os.path.join(HERE, "ops", "pos_drafts.jsonl")


def _assert(cond, msg):
    if not cond:
        raise SystemExit(f"FAIL: {msg}")


def _journal_stamp():
    before = []
    root = os.path.join(HERE, "journals")
    for dirpath, _d, files in os.walk(root):
        for fn in files:
            if fn.endswith(".journal"):
                p = os.path.join(dirpath, fn)
                before.append((p, os.path.getmtime(p), os.path.getsize(p)))
    return before


def main():
    inv_raw = open(INV, encoding="utf-8").read()
    prod_raw = open(PRODUCTS, encoding="utf-8").read()
    drafts_raw = open(DRAFTS, encoding="utf-8").read() if os.path.isfile(DRAFTS) else None
    before = _journal_stamp()
    prev_audit = M._AUDIT_ROWS
    M._AUDIT_ROWS = []
    try:
        err = POS.consume("INK-CAGE", "1", person_id="ali", seat="director", occupancy="STARQ")
        _assert(err is not None, "Starq occupancy must not sell")
        err = POS.consume("INK-PAINT-LEFT", "1", person_id="ali", seat="director", occupancy="CI")
        _assert(err is not None, "leftover blocked")
        err = M.apply_stock_count(
            "INK-CAGE", "4", person_id="ali", seat="director", unit_cost_raw="10"
        )
        _assert(err is None, err)
        err = POS.consume("INK-CAGE", "9", person_id="ali", seat="director", occupancy="CI")
        _assert(err is not None and "Oversell" in err, err)
        err = POS.consume("INK-CAGE", "1", person_id="ali", seat="director", occupancy="CI")
        _assert(err is None, err)
        data = M.inventory()
        line = next(x for x in data["lines"] if x["sku"] == "INK-CAGE")
        _assert(line.get("qty") in (3, 3.0), line)
        rows = open(DRAFTS, encoding="utf-8").read()
        _assert("5100" in rows and "1300" in rows, rows)
        _assert("POS consume" in rows, rows)

        err = POS.sell("INK-CAGE", "1", person_id="ali", seat="director", occupancy="STARQ")
        _assert(err is not None and "Starq" in err, err)
        err = POS.sell("INK-PAINT-LEFT", "1", person_id="ali", seat="director", occupancy="CI")
        _assert(err is not None, "leftover sale blocked")
        err = POS.sell("INK-CAGE", "1", person_id="ali", seat="director", occupancy="CI")
        _assert(err is not None and "No sell price" in err, err)
        line = next(x for x in M.inventory()["lines"] if x["sku"] == "INK-CAGE")
        _assert(line.get("qty") in (3, 3.0), "refuse must not consume")

        row, perr = M.set_sell_price(
            "INK-CAGE", "20", occupancy="CI", seat="director", person_id="ali",
        )
        _assert(perr is None, perr)
        err = POS.sell("INK-CAGE", "1", person_id="ali", seat="director", occupancy="CI",
                       contact_id="CI-CT-999")
        _assert(err is not None and "contact_id" in err, err)
        line = next(x for x in M.inventory()["lines"] if x["sku"] == "INK-CAGE")
        _assert(line.get("qty") in (3, 3.0), "bad contact must not consume")
        err = POS.sell("INK-CAGE", "1", person_id="ali", seat="director", occupancy="CI")
        _assert(err is None, err)
        line = next(x for x in M.inventory()["lines"] if x["sku"] == "INK-CAGE")
        _assert(line.get("qty") in (2, 2.0), line)
        rows = open(DRAFTS, encoding="utf-8").read()
        _assert("POS sale" in rows, rows)
        _assert("1200" in rows and "4200" in rows, rows)
        _assert("5100" in rows and "1300" in rows, rows)
        _assert("4300" not in rows, rows)
        _assert("8%" not in rows, rows)
        _assert("Tax: 0" in rows, rows)
        after = _journal_stamp()
        _assert(before == after, "POS must not touch journals/")
    finally:
        M._AUDIT_ROWS = prev_audit
        open(INV, "w", encoding="utf-8").write(inv_raw)
        open(PRODUCTS, "w", encoding="utf-8").write(prod_raw)
        if drafts_raw is None:
            if os.path.isfile(DRAFTS):
                os.remove(DRAFTS)
        else:
            open(DRAFTS, "w", encoding="utf-8").write(drafts_raw)
    print("OK — CI POS consume + priced sale draft, leftover/Starq/oversell/empty-price refused, journals untouched")


if __name__ == "__main__":
    main()
