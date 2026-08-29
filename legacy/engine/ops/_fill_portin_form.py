"""Fill Dhiraagu/CAMNP port-in form. One-shot; not a product. RULE 0: D: only."""
from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, NameObject, NumberObject

TEMPLATE = Path(r"D:\StarqTech\Mobile-Number-Port-In-Request-Form-Fillable-09072024.pdf")
OUTPUT = Path(r"D:\StarqTech\Mobile-Number-Port-In-Request-Form-Filled-2026-08-20.pdf")
DUMP = Path(r"D:\StarqTech\the foundation engine\ops\_portin-form-fields-dump.txt")


def dump_fields(reader: PdfReader) -> list[dict]:
    form = reader.get_fields() or {}
    rows = []
    lines = [
        f"template={TEMPLATE}",
        f"pages={len(reader.pages)}",
        f"encrypted={reader.is_encrypted}",
        f"field_count={len(form)}",
        "",
    ]
    for name, f in form.items():
        row = {
            "name": name,
            "ft": str(f.get("/FT")),
            "v": f.get("/V"),
            "dv": f.get("/DV"),
            "ff": f.get("/Ff"),
            "opt": f.get("/Opt"),
        }
        rows.append(row)
        lines.append(
            f"NAME={name!r} FT={row['ft']} V={row['v']!r} DV={row['dv']!r} Ff={row['ff']!r} Opt={row['opt']!r}"
        )
    DUMP.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return rows


def main() -> None:
    reader = PdfReader(str(TEMPLATE))
    rows = dump_fields(reader)
    print(DUMP.read_text(encoding="utf-8"))
    print("--- names only ---")
    for r in rows:
        print(r["name"])


if __name__ == "__main__":
    main()
