"""Concurrency and idempotency guards for the Python ops path.

Closes two findings from the independent audit of 21 August 2026:

  #4  The Python API lacks durable idempotency (ops.py:230). A retry, a double-tap, a
      resubmitted browser form or a process restart mid-request can create duplicate
      operational effects — two job cards, two recorded payments.

  #9  Python event recording is not concurrency-safe (ops.py:230). State is loaded, a counter
      is incremented, and the whole JSON file is rewritten with no lock. Two concurrent
      requests both read `event_seq: 5`, both write `6`, and two different events are issued
      the same id. The second one silently overwrites nothing and everything looks fine.

WHY THIS MATTERS MORE THAN IT LOOKS
────────────────────────────────────────────────────────────────────────────────
The Edge/Postgres path already has `idempotency_keys` with a request hash. The PYTHON path has
nothing — and the Python path is `serve.py` on :51810, which is the system running the garage
this week. Duplicate or mis-sequenced events land in the data that later becomes the ERP's test
fixtures, so a race here is not a local glitch; it is corrupted evidence.

ORDER MATTERS: the lock comes first. An idempotency store that races is not idempotent — two
concurrent requests carrying the same key would both find no record and both proceed.

THE BROWSER-FORM GAP, AND HOW IT IS CLOSED
────────────────────────────────────────────────────────────────────────────────
The above protects any caller that supplies a key. Browser forms had none: a refresh or a
double-tap on Submit re-POSTs the identical body, and nothing downstream could tell that apart
from a second genuine submission. `mint_form_token` / `consume_form_token` close that — a
single-use token is minted when the form is rendered and spent when it is submitted.

WHY A MINTED TOKEN RATHER THAN HASHING THE FORM BODY
────────────────────────────────────────────────────────────────────────────────
Deduplicating on a hash of the submitted fields looks simpler and is wrong at a counter. Two
genuine MVR 50 cash sales a minute apart are byte-identical, and content-hashing would silently
swallow the second one — turning a double-submit bug into a missing-revenue bug, which is worse
because nobody sees it. A token minted per RENDER distinguishes "one form submitted twice" from
"the form filled in twice", which is the distinction that actually matters.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from contextlib import contextmanager

HERE = os.path.dirname(os.path.abspath(__file__))
OPS_DIR = os.path.join(HERE, "ops")
LOCK_FILE = os.path.join(OPS_DIR, ".state.lock")
IDEMPOTENCY_FILE = os.path.join(OPS_DIR, "idempotency.json")

# Matches the Edge/Postgres retention so the two paths expire keys alike.
RETENTION_SECONDS = 7 * 24 * 60 * 60

# How long a rendered form stays submittable. Long enough that a page left open over a lunch
# break still works; short enough that spent tokens do not accumulate indefinitely.
FORM_TOKEN_TTL_SECONDS = 12 * 60 * 60

# Spent form tokens share the idempotency store but must not collide with client-supplied
# idempotency keys — a caller passing the raw nonce as its own key would otherwise read as a
# replay of the form submission.
FORM_TOKEN_PREFIX = "form:"

# Tolerance for a token minted a moment "in the future" by a clock that is slightly ahead.
# Without it, serve.py on Windows and an agent under WSL disagreeing by a second would reject
# perfectly good tokens.
FORM_TOKEN_SKEW_SECONDS = 60.0

# A caller blocked this long is a symptom, not something to wait out: fail loudly rather than
# pile up requests behind a lock nobody is going to release.
LOCK_TIMEOUT_SECONDS = 10.0

# How old a lock must be before it is presumed abandoned.
#
# ⚠ THIS MUST BE MUCH LARGER THAN LOCK_TIMEOUT_SECONDS, AND THEY MUST NOT BE THE SAME VALUE.
#
# The first version of this module used the acquisition timeout as the staleness threshold. That
# means any lock held a little longer than the timeout is judged abandoned and STOLEN FROM A LIVE
# PROCESS — which reintroduces the exact read-modify-write race the lock exists to prevent, only
# now intermittently and only under load. Caught by test_a_live_lock_is_not_stolen.
#
# Five minutes is far longer than any legitimate state write (they are milliseconds) and far
# shorter than a human noticing the counter is wedged.
STALE_LOCK_SECONDS = 300.0


class LockTimeout(RuntimeError):
    """The state lock could not be acquired. Deliberately not caught internally."""


class IdempotencyConflict(RuntimeError):
    """Same key, different request. The caller reused a key for new content."""


def _ensure_dir() -> None:
    os.makedirs(OPS_DIR, exist_ok=True)


@contextmanager
def state_lock(timeout: float = LOCK_TIMEOUT_SECONDS, stale_after: float = STALE_LOCK_SECONDS):
    """Serialise the load -> mutate -> save cycle across processes.

    Uses an exclusive-create lock file rather than `fcntl`/`msvcrt`, because this runs on
    Windows and under WSL against the same directory, and those two APIs do not see each
    other's locks. `O_EXCL` is honoured by both.

    A stale lock — left by a process that was killed mid-write — is reclaimed after the timeout
    rather than deadlocking the garage counter forever. That is a deliberate trade: a stale lock
    is a crash, and refusing to serve until someone deletes a file by hand is the worse failure
    for a system taking money at a counter.
    """
    _ensure_dir()
    deadline = time.monotonic() + timeout
    handle = None
    last_error: OSError | None = None
    while True:
        try:
            handle = os.open(LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except (FileExistsError, PermissionError) as exc:
            # WINDOWS DOES NOT ALWAYS REPORT CONTENTION AS EEXIST.
            #
            # When a holder is releasing the lock, the file enters a delete-pending state: it
            # still exists, but every open fails with ERROR_ACCESS_DENIED, which Python raises as
            # PermissionError (EACCES) rather than FileExistsError (EEXIST). Catching only
            # FileExistsError therefore let normal contention escape as an unhandled exception —
            # intermittently, and only when two requests genuinely overlapped, which is precisely
            # when the lock is doing its job.
            #
            # Found on 22 Aug by running the audit-#9 concurrency test five times instead of
            # once: it failed roughly one run in five with PermissionError out of os.open. A
            # single green run had made the lock look sound. In serve.py this surfaced as a 500
            # at the garage counter on a double-tap — the exact scenario the lock exists for.
            #
            # A genuine permissions fault (no write access to the directory) also lands here and
            # will now spin until the deadline instead of failing immediately. That is the right
            # trade: it still fails loudly as LockTimeout, and the original error is chained onto
            # it so the cause is not lost.
            last_error = exc
            if time.monotonic() >= deadline:
                # Reclaim only if the lock is genuinely old; a lock younger than the timeout
                # belongs to a live request that is simply slow.
                try:
                    age = time.time() - os.path.getmtime(LOCK_FILE)
                except OSError:
                    age = 0.0
                if age > stale_after:
                    try:
                        os.unlink(LOCK_FILE)
                        continue
                    except OSError:
                        pass
                raise LockTimeout(
                    f"ops state lock held for more than {timeout}s — is another process wedged?"
                ) from last_error
            time.sleep(0.02)

    try:
        os.write(handle, str(os.getpid()).encode("ascii"))
        os.close(handle)
        handle = None
        yield
    finally:
        if handle is not None:
            try:
                os.close(handle)
            except OSError:
                pass
        try:
            os.unlink(LOCK_FILE)
        except OSError:
            pass


def request_hash(payload: dict) -> str:
    """Stable fingerprint of a request.

    `sort_keys` matters: without it, two identical submissions whose JSON happened to serialise
    in a different key order would hash differently and be treated as a conflict.
    """
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load_records() -> dict:
    if not os.path.isfile(IDEMPOTENCY_FILE):
        return {}
    try:
        with open(IDEMPOTENCY_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        # A corrupt store must not take the counter offline. Losing replay protection is
        # recoverable; refusing every command is not.
        return {}


def _save_records(records: dict) -> None:
    _ensure_dir()
    tmp = IDEMPOTENCY_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        f.write("\n")
    for _ in range(10):
        try:
            os.replace(tmp, IDEMPOTENCY_FILE)
            return
        except PermissionError:
            time.sleep(0.05)
    os.replace(tmp, IDEMPOTENCY_FILE)


def _retention_for(key: str) -> float:
    """Spent form tokens expire on the token's own clock, not the idempotency retention.

    A form token is already refused once it is older than FORM_TOKEN_TTL_SECONDS, so keeping the
    spent record beyond that proves nothing and only grows the file. Idempotency keys supplied by
    a client have no such expiry and keep the full retention.
    """
    return FORM_TOKEN_TTL_SECONDS if key.startswith(FORM_TOKEN_PREFIX) else RETENTION_SECONDS


def _prune(records: dict, now: float) -> dict:
    return {
        key: rec for key, rec in records.items()
        if isinstance(rec, dict) and (now - float(rec.get("at") or 0)) < _retention_for(key)
    }


def lookup(key: str, digest: str) -> dict | None:
    """Return the stored result for this key, or None if it is genuinely new.

    Raises IdempotencyConflict when the key exists with a DIFFERENT request hash — the caller
    reused a key for new content, which is a client bug and must not be silently replayed as
    though it were the original.

    Call inside `state_lock`.
    """
    records = _load_records()
    rec = records.get(key)
    if not isinstance(rec, dict):
        return None
    if rec.get("hash") != digest:
        raise IdempotencyConflict(
            "This idempotency key was already used for a different request."
        )
    return rec.get("result")


def remember(key: str, digest: str, result: dict) -> None:
    """Record the outcome so a replay of this key returns it instead of re-executing.

    Call inside the SAME `state_lock` as the lookup and the effect. Storing after releasing the
    lock reopens the race the lock exists to close.
    """
    now = time.time()
    records = _prune(_load_records(), now)
    records[key] = {"hash": digest, "at": now, "result": result}
    _save_records(records)


# ─────────────────────────────────────────────────────────────────────────────────────────────
# SINGLE-USE FORM TOKENS  —  audit finding #4, browser half
# ─────────────────────────────────────────────────────────────────────────────────────────────
#
# The token is SIGNED RATHER THAN REGISTERED AT MINT TIME. A page renders many forms; recording
# every one as "issued" would mean a lock acquisition and a file write per form per page render,
# and would fill the store with tokens for forms nobody ever submits. Signing means only SPENT
# tokens are ever written — the store grows with submissions, not with page views.
#
# The signing secret is the session's CSRF secret, which binds the token to the session for
# free: a token minted in one session does not verify in another, and every token dies when the
# session does.


class FormTokenState:
    """Outcome of consuming a form token. Strings, so they survive a log line intact."""

    OK = "ok"            # fresh, never spent — the caller may execute the effect
    SPENT = "spent"      # this exact submission already happened — do NOT execute again
    INVALID = "invalid"  # malformed, wrong signature, expired, or from another session


def _form_secret(secret: str | bytes) -> bytes:
    if isinstance(secret, bytes):
        return secret
    return (secret or "").encode("utf-8")


def _form_sig(secret: str | bytes, nonce: str, issued: str) -> str:
    mac = hmac.new(_form_secret(secret), f"{nonce}.{issued}".encode("utf-8"), hashlib.sha256)
    return mac.hexdigest()[:32]


def mint_form_token(secret: str | bytes, now: float | None = None) -> str:
    """Mint a token for one form render. No I/O, no lock — safe to call per form.

    Returns "" when there is no secret to sign with (no session). An empty token is refused by
    `consume_form_token`, so a caller that cannot mint cannot accidentally bypass the check.
    """
    if not _form_secret(secret):
        return ""
    nonce = secrets.token_urlsafe(18)
    issued = str(int(now if now is not None else time.time()))
    return f"{nonce}.{issued}.{_form_sig(secret, nonce, issued)}"


def consume_form_token(
    secret: str | bytes,
    token: str,
    now: float | None = None,
    ttl: float = FORM_TOKEN_TTL_SECONDS,
) -> str:
    """Spend a form token exactly once. Returns a FormTokenState.

    ORDER IS DELIBERATE: signature and expiry are checked BEFORE the store is opened. Verifying
    first means a forged or replayed-from-elsewhere token costs a hash and nothing else — it can
    neither grow the store nor take the lock. Checking the store first would let anyone with the
    URL fill the disk with unsigned garbage.

    The lookup and the write happen inside ONE lock, for the same reason `record_event` does it:
    two concurrent submissions of the same token must not both find it unspent.
    """
    now = time.time() if now is None else now
    raw = (token or "").strip()
    if not raw or not _form_secret(secret):
        return FormTokenState.INVALID

    parts = raw.split(".")
    if len(parts) != 3:
        return FormTokenState.INVALID
    nonce, issued, sig = parts
    if not nonce or not sig:
        return FormTokenState.INVALID

    if not hmac.compare_digest(sig, _form_sig(secret, nonce, issued)):
        return FormTokenState.INVALID

    try:
        issued_at = float(issued)
    except ValueError:
        return FormTokenState.INVALID
    # Expired, or minted further in the future than clock skew can explain.
    if now - issued_at > ttl or issued_at - now > FORM_TOKEN_SKEW_SECONDS:
        return FormTokenState.INVALID

    key = FORM_TOKEN_PREFIX + nonce
    with state_lock():
        records = _load_records()
        if isinstance(records.get(key), dict):
            return FormTokenState.SPENT
        records = _prune(records, now)
        records[key] = {"hash": "", "at": now, "result": {}}
        _save_records(records)
    return FormTokenState.OK
