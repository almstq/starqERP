#!/usr/bin/env python3
"""Stock take writes qty only. Never journals. Leftover paint blocked."""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import masters as M

INV = os.path.join(HERE, "ops", "masters", "inventory.json")


def _assert(cond, msg):
    if not cond:
        raise SystemExit(f"FAIL: {msg}")


def main():
    raw = open(INV, encoding="utf-8").read()
    before = []
    root = os.path.join(HERE, "journals")
    for dirpath, _d, files in os.walk(root):
        for fn in files:
            if fn.endswith(".journal"):
                p = os.path.join(dirpath, fn)
                before.append((p, os.path.getmtime(p), os.path.getsize(p)))
    prev_audit = M._AUDIT_ROWS
    M._AUDIT_ROWS = []
    try:
        err = M.apply_stock_count("INK-PAINT-LEFT", "3", person_id="ali", seat="director")
        _assert(err is not None, "leftover must be refused")
        err = M.apply_stock_count("INK-PAINT", "1", person_id="ali", seat="director")
        _assert(err is not None, "service SKU must not count")
        err = M.apply_stock_count("INK-CAGE", "not-a-number", person_id="ali", seat="director")
        _assert(err is not None, "bad qty")
        err = M.apply_stock_count("INK-CAGE", "4", person_id="nashid", seat="technician")
        _assert(err is not None, "tech cannot count")
        row, err = M.apply_grn_qty(
            sku="INK-CAGE", qty_raw="2", occupancy="CI",
            person_id="ali", seat="director",
        )
        _assert(err is not None, "not_counted must not invent opening")
        _assert("not counted" in (err or "").lower() or "opening" in (err or "").lower(), err)
        err = M.apply_stock_count("INK-CAGE", "4", person_id="ali", seat="director")
        _assert(err is None, "director count should save")
        data = json.loads(open(INV, encoding="utf-8").read())
        line = next(x for x in data["lines"] if x["sku"] == "INK-CAGE")
        _assert(line["qty_status"] == "counted", line)
        _assert(line.get("qty") in (4, 4.0), line)
        holds = M.inventory_gl_holds()
        cage = next(h for h in holds if h.get("sku") == "INK-CAGE")
        _assert(cage["status"] == "blocked", cage)
        _assert(not cage.get("draft"), cage)
        err = M.apply_stock_count(
            "INK-CAGE", "4", person_id="ali", seat="director", unit_cost_raw="10"
        )
        _assert(err is None, "count with cost")
        cage = next(h for h in M.inventory_gl_holds() if h.get("sku") == "INK-CAGE")
        _assert(cage["status"] == "draft", cage)
        _assert("1300    40.00" in cage["draft"], cage["draft"])
        _assert("5100   -40.00" in cage["draft"], cage["draft"])
        after = []
        for dirpath, _d, files in os.walk(root):
            for fn in files:
                if fn.endswith(".journal"):
                    p = os.path.join(dirpath, fn)
                    after.append((p, os.path.getmtime(p), os.path.getsize(p)))
        _assert(before == after, "stock take must not touch journals")
        row, err = M.apply_grn_qty(
            sku="INK-CAGE", qty_raw="2", occupancy="CI",
            person_id="nashid", seat="receiver",
        )
        _assert(err is None, err)
        _assert(row["qty"] in (6, 6.0), row)
        row, err = M.apply_grn_qty(
            sku="INK-CAGE", qty_raw="1", occupancy="STARQ",
            person_id="ali", seat="director",
        )
        _assert(err is not None, "Starq must not bump CI cage")
        row, err = M.apply_grn_qty(
            sku="INK-PAINT-LEFT", qty_raw="1", occupancy="CI",
            person_id="ali", seat="director",
        )
        _assert(err is not None, "leftover GRN qty")
        after2 = []
        for dirpath, _d, files in os.walk(root):
            for fn in files:
                if fn.endswith(".journal"):
                    p = os.path.join(dirpath, fn)
                    after2.append((p, os.path.getmtime(p), os.path.getsize(p)))
        _assert(before == after2, "GRN qty must not touch journals")
    finally:
        M._AUDIT_ROWS = prev_audit
        open(INV, "w", encoding="utf-8").write(raw)
    print("OK — stock take qty only, leftover blocked, journals untouched")


if __name__ == "__main__":
    main()
