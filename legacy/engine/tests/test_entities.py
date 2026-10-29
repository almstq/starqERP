#!/usr/bin/env python3
"""Occupancy: person → allowed books entities.

Ali (Starq principal) sees Group + Starq + Club Ignition.
CI occupants see club-ignition only. serve.py must not honour ?entity=STARQ
for a CI session. Fake .example emails cannot Google-login.
"""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import auth as A


def _person_ali(**extra):
    row = {
        "person_id": "ali",
        "name": "Ali Mushthaq Ibrahim",
        "email": "founder@example.com",
        "default_seat": "director",
        "seats": ["director", "financial_controller", "payer", "ledger_poster", "counter"],
        "entities": ["starq", "club-ignition", "group"],
    }
    row.update(extra)
    return row


def _person_ci(**extra):
    row = {
        "person_id": "nashid",
        "name": "CI occupant",
        "email": "ci-occupant-test@example.com",
        "default_seat": "managing_director",
        "seats": ["managing_director", "receiver", "qc_signer", "technician", "counter"],
        "entities": ["club-ignition"],
    }
    row.update(extra)
    return row


def _user(row: dict) -> A.User:
    seats = [s for s in row["seats"] if s in A.SEATS]
    return A.User(
        email=row["email"],
        person_id=row.get("person_id") or "",
        name=row.get("name") or row["email"],
        seats=seats,
        acting_as=row.get("default_seat") or seats[0],
        csrf="test",
        session_key="test",
        default_seat=row.get("default_seat") or seats[0],
        entities=A.entities_for_person(row),
    )


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def main() -> int:
    ali_ents = A.entities_for_person(_person_ali())
    check(ali_ents == ["starq", "club-ignition", "group"], f"Ali entities {ali_ents}")

    ci_ents = A.entities_for_person(_person_ci())
    check(ci_ents == ["club-ignition"], f"CI entities {ci_ents}")

    omitted_ali = dict(_person_ali())
    omitted_ali.pop("entities")
    check(
        A.entities_for_person(omitted_ali) == A.ALL_ENTITIES,
        "omitted entities must not lock Ali out",
    )

    omitted_ci = dict(_person_ci())
    omitted_ci.pop("entities")
    omitted_ci["email"] = "workshop-future@gmail.com"
    omitted_ci["person_id"] = "workshop"
    check(
        A.entities_for_person(omitted_ci) == ["club-ignition"],
        "omitted entities on a non-Ali person is CI-only, not Group",
    )

    ali = _user(_person_ali())
    ci = _user(_person_ci())

    check(A.may_view_books(ali, None), "Ali sees Group")
    check(A.may_view_books(ali, "STARQ"), "Ali sees Starq")
    check(A.may_view_books(ali, "CI"), "Ali sees Club Ignition")
    check(not A.may_view_books(ci, None), "CI occupant must not see Group")
    check(not A.may_view_books(ci, "STARQ"), "CI occupant must not see Starq")
    check(A.may_view_books(ci, "CI"), "CI occupant sees Club Ignition")

    ledger, action = A.books_access(ci, "STARQ", True)
    check(action == "forbid" and ledger is None, f"CI ?entity=STARQ must 403, got {action!r} {ledger!r}")
    ledger, action = A.books_access(ci, "starq", True)
    check(action == "forbid", "CI ?entity=starq must 403")
    ledger, action = A.books_access(ci, "", False)
    check(action == "coerce" and ledger == "CI", f"CI hitting Group URL coerces to CI, got {action} {ledger}")
    ledger, action = A.books_access(ci, "CI", True)
    check(action == "allow" and ledger == "CI", "CI ?entity=CI allowed")

    ledger, action = A.books_access(ali, "", False)
    check(action == "allow" and ledger is None, f"Ali Group must remain, got {action} {ledger}")
    ledger, action = A.books_access(ali, "STARQ", True)
    check(action == "allow" and ledger == "STARQ", "Ali Starq must remain")
    ledger, action = A.books_access(ali, "CI", True)
    check(action == "allow" and ledger == "CI", "Ali CI must remain")

    check(A.default_books_path(ali) == "/", "Ali lands on Group")
    check(A.default_books_path(ci) == "/?entity=CI", "CI occupant lands on Club Ignition")
    check(A.is_ci_only(ci) and not A.is_ci_only(ali), "ci_only chrome is for CI occupants only")

    starq_dec = {"id": "DEC-011", "entity": "STARQ", "title": "Hoadha"}
    ci_dec = {"id": "DEC-023", "entity": "CI", "title": "Garage POS"}
    untagged = {"id": "DEC-005", "title": "Starq's own share capital"}
    check(A.decision_visible(starq_dec, ali) and not A.decision_visible(starq_dec, ci), "Starq decisions Ali-only")
    check(A.decision_visible(ci_dec, ali) and A.decision_visible(ci_dec, ci), "CI decisions both")
    check(A.decision_visible(untagged, ali) and not A.decision_visible(untagged, ci), "untagged = founder inbox")

    live = A.lookup_person("founder@example.com")
    check(live is not None, "Ali live allowlist must still authenticate")
    check("*" not in (live.get("seats") or []), "Ali seats must stay real ids")
    check(
        set(live["entities"]) == {"starq", "club-ignition", "group"},
        f"Ali live entities {live.get('entities')}",
    )

    nashid_row = None
    for row in A.load_allowlist().get("people") or []:
        if (row.get("person_id") or "").strip().lower() == "nashid":
            nashid_row = row
            break
    check(nashid_row is not None, "live allowlist must include person_id nashid")
    nashid_email = (nashid_row.get("email") or "").strip().lower()
    check(not A.is_placeholder_email(nashid_email), "Nashid must have a real Gmail in _secrets")
    check((nashid_row.get("status") or "").strip().lower() == "active", "Nashid must be active")
    nashid_live = A.lookup_person(nashid_email)
    check(nashid_live is not None, "Nashid email must authenticate")
    check(
        list(nashid_live.get("entities") or []) == ["club-ignition"],
        f"Nashid entities must be club-ignition only, got {nashid_live.get('entities')}",
    )
    check("starq" not in nashid_live["entities"] and "group" not in nashid_live["entities"],
          "Nashid must never have starq or group")
    nashid_seats = set(nashid_live.get("seats") or [])
    check(
        nashid_seats == {"managing_director", "receiver", "qc_signer", "technician", "counter"},
        f"Nashid seats {nashid_seats}",
    )
    for banned in ("payer", "financial_controller", "ledger_poster", "quartermaster", "*"):
        check(banned not in nashid_seats, f"Nashid must not hold {banned}")
    nashid_user = _user(nashid_live)
    check(not A.may_view_books(nashid_user, None), "Nashid must not see Group")
    check(not A.may_view_books(nashid_user, "STARQ"), "Nashid email → STARQ denied")
    check(A.may_view_books(nashid_user, "CI"), "Nashid sees Club Ignition")
    ledger, action = A.books_access(nashid_user, "STARQ", True)
    check(action == "forbid" and ledger is None, f"Nashid STARQ must 403, got {action!r} {ledger!r}")
    check(A.default_books_path(nashid_user) == "/?entity=CI", "Nashid lands on Club Ignition")
    check(A.is_ci_only(nashid_user), "Nashid chrome is CI-only — no Group switcher")

    check(A.lookup_person("ci-occupant-test@invalid.example") is None, ".example test person cannot Google-login")

    _http_gate()
    print("test_entities: ok — Ali sees all; Nashid email is club-ignition only; STARQ 403.")
    return 0


def _http_gate() -> None:
    """serve.py must not render Group books at /login, and must 403 Starq to CI."""
    import http.client
    import re
    import threading
    import time

    import serve as S

    httpd = S.ExclusiveHTTPServer(("127.0.0.1", 0), S.Handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    time.sleep(0.2)

    def grab(path, cookie=None):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=8)
        hdr = {"Cookie": cookie} if cookie else {}
        c.request("GET", path, headers=hdr)
        r = c.getresponse()
        body = r.read().decode("utf-8", "replace")
        return r.status, r.getheader("Location"), body

    tokens = []
    try:
        st, loc, body = grab("/")
        check(st == 303 and loc and "/login" in loc, f"unauth / -> login, got {st} {loc}")
        st, loc, body = grab("/tb?entity=STARQ")
        check(st == 303 and loc and "/login" in loc, f"unauth STARQ -> login, got {st} {loc}")
        st, loc, body = grab("/login")
        check(st == 200 and "Sign in" in body, "login shell")
        check('class="switch"' not in body, "login must not render the entity switcher")

        ci_row = {
            "email": "ci-http-test@gmail.com",
            "person_id": "ci-http-test",
            "name": "CI HTTP Test",
            "default_seat": "managing_director",
            "seats": ["managing_director", "receiver", "qc_signer", "technician", "counter"],
            "entities": ["club-ignition"],
        }
        token, _ = A.create_session(ci_row)
        tokens.append(token)
        cookie = A.cookie_header(token).split(";")[0]
        st, loc, body = grab("/tb?entity=STARQ", cookie)
        check(st == 403, f"CI session STARQ must 403, got {st}")
        st, loc, body = grab("/", cookie)
        check(st == 303 and loc and "entity=CI" in loc, f"CI / coerces to CI, got {st} {loc}")
        st, loc, body = grab("/?entity=CI", cookie)
        check(st == 200, f"CI books 200, got {st}")
        check("Starq Technologies Pvt Ltd" not in body, "CI chrome must not say Starq Pvt Ltd")
        check("group finance" not in body.lower(), "CI chrome must not say group finance")
        sw = re.search(r'<div class="switch">(.*?)</div>', body, re.S)
        check(sw is not None, "CI still shows the Club Ignition identity pill")
        check("Group" not in sw.group(1), "CI switcher must not list Group")
        check("Starq Technologies" not in sw.group(1), "CI switcher must not list Starq")
        check("Club Ignition" in sw.group(1), "CI switcher lists Club Ignition")
        check("starq-logo.png" not in sw.group(1), "CI switcher must not use the Starq mark")

        nashid_http = None
        for row in A.load_allowlist().get("people") or []:
            if (row.get("person_id") or "").strip().lower() == "nashid":
                nashid_http = A.lookup_person((row.get("email") or "").strip())
                break
        check(nashid_http is not None, "live Nashid must session")
        token_n, _ = A.create_session(nashid_http)
        tokens.append(token_n)
        cookie_n = A.cookie_header(token_n).split(";")[0]
        st, loc, body = grab("/tb?entity=STARQ", cookie_n)
        check(st == 403, f"live Nashid STARQ must 403, got {st}")
        st, loc, body = grab("/", cookie_n)
        check(st == 303 and loc and "entity=CI" in loc, f"live Nashid / lands CI, got {st} {loc}")
        st, loc, body = grab("/?entity=CI", cookie_n)
        check(st == 200, f"live Nashid CI books 200, got {st}")
        sw_n = re.search(r'<div class="switch">(.*?)</div>', body, re.S)
        check(sw_n is not None, "live Nashid still shows Club Ignition identity")
        check("Group" not in sw_n.group(1), "live Nashid must not list Group")
        check("Starq Technologies" not in sw_n.group(1), "live Nashid must not list Starq")

        ali_row = _person_ali()
        token_a, _ = A.create_session(ali_row)
        tokens.append(token_a)
        cookie_a = A.cookie_header(token_a).split(";")[0]
        st, loc, body = grab("/", cookie_a)
        check(st == 200, f"Ali Group 200, got {st} {loc}")
        sw = re.search(r'<div class="switch">(.*?)</div>', body, re.S)
        check(sw is not None, "Ali switcher present")
        check("Group" in sw.group(1), "Ali still has Group")
        check("Starq Technologies" in sw.group(1), "Ali still has Starq Technologies")
        check("Club Ignition" in sw.group(1), "Ali still has Club Ignition")
        st, loc, body = grab("/tb?entity=STARQ", cookie_a)
        check(st == 200, f"Ali STARQ TB 200, got {st}")
        check("Starq Technologies" in body, "Ali STARQ page is Starq-branded")
    finally:
        for tok in tokens:
            A.destroy_session(tok)
        httpd.shutdown()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print("test_entities: FAIL —", exc, file=sys.stderr)
        raise SystemExit(1)
