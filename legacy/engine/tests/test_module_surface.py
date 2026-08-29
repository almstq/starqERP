#!/usr/bin/env python3
"""Every module attribute serve.py calls must actually exist.

WHY THIS FILE EXISTS
────────────────────────────────────────────────────────────────────────────────
On 22 August, `serve.py` was found calling `A.csrf_token(user)` at two places while `auth.py`
had no such function. Both raised AttributeError at runtime:

  serve.py:1313  _scm_approve_form  — the garage purchase-approval button
  serve.py:3716  h_notes            — the notes append form

Neither is reached on every request. The first needs a pending SCM step that survives
`prepare_scm_approve`; the second needs a user who may reply to decisions. So the portal ran for
weeks with two 500s waiting in it and nothing noticed, because nothing here was ever type-checked
and no test rendered those particular branches.

WHAT THIS CATCHES, AND WHAT IT DOES NOT
────────────────────────────────────────────────────────────────────────────────
This is a cheap static cross-check, not a substitute for exercising the code. It catches the
whole class of "the caller and the module disagree about what exists" — a renamed helper, a
function moved between modules, a call written against an intention rather than an implementation.

It does NOT check arity, argument names, or types, and it cannot see attributes reached
dynamically via getattr. A function that exists but takes the wrong arguments still passes here
and still fails at runtime.

Run:  python test_module_surface.py
"""

from __future__ import annotations

import io
import os
import re
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# Modules whose surface is checked. Every one of these is imported by serve.py as `import X as Y`.
SOURCES = ["serve.py"]


def _alias_map(src: str) -> dict[str, str]:
    """{alias: module_name} for every `import x as y` at module level."""
    return {m.group(2): m.group(1) for m in re.finditer(r"^import\s+(\w+)\s+as\s+(\w+)\s*$", src, re.M)}


class TestModuleSurface(unittest.TestCase):
    def test_every_aliased_module_call_resolves(self):
        problems = []
        for filename in SOURCES:
            path = os.path.join(HERE, filename)
            src = io.open(path, encoding="utf-8").read()
            aliases = _alias_map(src)
            self.assertTrue(aliases, f"{filename}: no `import x as y` found — has the file changed shape?")

            for alias, modname in sorted(aliases.items()):
                try:
                    mod = __import__(modname)
                except Exception as exc:  # a module that will not import is its own failure
                    problems.append(f"{filename}: cannot import {modname!r} ({exc})")
                    continue
                called = set(re.findall(r"\b" + re.escape(alias) + r"\.([A-Za-z_][A-Za-z0-9_]*)\s*\(", src))
                for name in sorted(called):
                    if not hasattr(mod, name):
                        problems.append(
                            f"{filename}: calls {alias}.{name}() but {modname}.{name} does not exist"
                        )

        self.assertEqual(problems, [], "\n  " + "\n  ".join(problems) if problems else "")

    def test_csrf_token_specifically_exists_and_tolerates_no_session(self):
        """The regression that prompted this file.

        The "" for a missing session is load-bearing: `csrf_ok` refuses an empty token, so a form
        rendered without a session produces one that cannot be submitted. The failure lands at
        submit time as a refusal rather than at render time as a 500.
        """
        import auth

        self.assertTrue(hasattr(auth, "csrf_token"), "auth.csrf_token is missing — serve.py calls it")
        self.assertEqual(auth.csrf_token(None), "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
