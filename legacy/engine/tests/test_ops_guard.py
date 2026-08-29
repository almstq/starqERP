#!/usr/bin/env python3
"""Negative tests for ops_guard — audit findings #4 (idempotency) and #9 (concurrency).

Every test here asserts a REFUSAL or proves a race does NOT happen. The defects being closed
both passed their positive tests: events were recorded, state was saved. What was never tested
was what happens when two of them arrive at once, or when the same one arrives twice.

The concurrency test spawns real subprocesses rather than threads. Threads under the GIL can
hide a read-modify-write race by accident of scheduling; separate processes cannot, and separate
processes are the actual deployment shape (serve.py on Windows, agents under WSL, same files).

Run:  python test_ops_guard.py
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
import unittest
import unittest.mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


class GuardTestCase(unittest.TestCase):
    def setUp(self):
        # Redirect the module at a scratch directory so a test run never touches real garage
        # state. Reload rather than monkeypatch one constant: the paths are derived at import.
        self.tmp = tempfile.mkdtemp(prefix="ops_guard_test_")
        import ops_guard
        self.guard = ops_guard
        self._orig = (ops_guard.OPS_DIR, ops_guard.LOCK_FILE, ops_guard.IDEMPOTENCY_FILE)
        ops_guard.OPS_DIR = self.tmp
        ops_guard.LOCK_FILE = os.path.join(self.tmp, ".state.lock")
        ops_guard.IDEMPOTENCY_FILE = os.path.join(self.tmp, "idempotency.json")

    def tearDown(self):
        (self.guard.OPS_DIR, self.guard.LOCK_FILE, self.guard.IDEMPOTENCY_FILE) = self._orig
        shutil.rmtree(self.tmp, ignore_errors=True)


class TestIdempotency(GuardTestCase):
    def test_a_new_key_is_not_a_replay(self):
        self.assertIsNone(self.guard.lookup("k1", "hash-a"))

    def test_same_key_same_request_replays_the_stored_result(self):
        digest = self.guard.request_hash({"type": "INTAKE", "plate": "A1234"})
        self.guard.remember("k1", digest, {"id": "E-0001"})
        self.assertEqual(self.guard.lookup("k1", digest), {"id": "E-0001"})

    def test_same_key_different_request_is_a_conflict_not_a_replay(self):
        """The case that matters: a client reusing a key for new content.

        Replaying here would return the WRONG event to the caller and silently discard the new
        one. It has to be an error.
        """
        first = self.guard.request_hash({"type": "INTAKE", "plate": "A1234"})
        second = self.guard.request_hash({"type": "INTAKE", "plate": "B9999"})
        self.guard.remember("k1", first, {"id": "E-0001"})
        with self.assertRaises(self.guard.IdempotencyConflict):
            self.guard.lookup("k1", second)

    def test_key_order_does_not_change_the_hash(self):
        """Without sort_keys, the same submission serialised differently would look like a
        conflict — turning idempotency into a source of spurious errors."""
        a = self.guard.request_hash({"type": "INTAKE", "plate": "A1234", "note": "x"})
        b = self.guard.request_hash({"note": "x", "plate": "A1234", "type": "INTAKE"})
        self.assertEqual(a, b)

    def test_different_content_hashes_differently(self):
        a = self.guard.request_hash({"type": "INTAKE", "plate": "A1234"})
        b = self.guard.request_hash({"type": "INTAKE", "plate": "A1235"})
        self.assertNotEqual(a, b)

    def test_a_corrupt_store_does_not_take_the_counter_offline(self):
        """Losing replay protection is recoverable. Refusing every command is not."""
        with open(self.guard.IDEMPOTENCY_FILE, "w", encoding="utf-8") as f:
            f.write("{ this is not json")
        self.assertIsNone(self.guard.lookup("k1", "hash-a"))

    def test_records_survive_a_process_restart(self):
        """The whole point of 'durable'. In-memory keys were the defect."""
        digest = self.guard.request_hash({"type": "CLOSE"})
        self.guard.remember("k9", digest, {"id": "E-0042"})
        script = textwrap.dedent(f"""
            import sys, ops_guard
            sys.path.insert(0, {HERE!r})
            ops_guard.OPS_DIR = {self.tmp!r}
            ops_guard.IDEMPOTENCY_FILE = {os.path.join(self.tmp, 'idempotency.json')!r}
            print(ops_guard.lookup("k9", {digest!r})["id"])
        """)
        out = subprocess.run(
            [sys.executable, "-c", script], cwd=HERE, capture_output=True, text=True, timeout=30
        )
        self.assertEqual(out.stdout.strip(), "E-0042", out.stderr)


class TestLock(GuardTestCase):
    def test_the_lock_is_released_even_when_the_body_raises(self):
        with self.assertRaises(ValueError):
            with self.guard.state_lock():
                raise ValueError("boom")
        self.assertFalse(os.path.exists(self.guard.LOCK_FILE))
        with self.guard.state_lock():
            pass  # must not deadlock

    def test_a_stale_lock_is_reclaimed_rather_than_deadlocking_the_counter(self):
        """A lock left by a killed process must not require someone to delete a file by hand
        before the garage can take money again."""
        with open(self.guard.LOCK_FILE, "w", encoding="utf-8") as f:
            f.write("99999")
        old = time.time() - 3600
        os.utime(self.guard.LOCK_FILE, (old, old))
        with self.guard.state_lock(timeout=0.2, stale_after=1.0):
            pass
        self.assertFalse(os.path.exists(self.guard.LOCK_FILE))

    def test_a_live_lock_is_not_stolen(self):
        """The counterpart: a lock younger than the timeout belongs to a request that is merely
        slow, and stealing it would reintroduce the race."""
        with open(self.guard.LOCK_FILE, "w", encoding="utf-8") as f:
            f.write("1")
        with self.assertRaises(self.guard.LockTimeout):
            with self.guard.state_lock(timeout=0.15):
                pass
        os.unlink(self.guard.LOCK_FILE)


class TestConcurrency(GuardTestCase):
    def test_concurrent_processes_never_issue_the_same_sequence_number(self):
        """Audit #9, proven with real processes.

        Eight processes each do the load -> increment -> save cycle ten times. Without the lock
        this loses updates and issues duplicate ids; with it, the counter must land on exactly
        80 and every allocated number must be unique.
        """
        counter = os.path.join(self.tmp, "counter.json")
        with open(counter, "w", encoding="utf-8") as f:
            json.dump({"seq": 0}, f)

        # A START BARRIER, and it is the whole reason this test is worth anything.
        #
        # The first version simply spawned eight processes and let them run. Python subprocess
        # startup is ~0.5s, so worker 1 finished all ten iterations before worker 2 had
        # imported anything. Nothing ever overlapped, so nothing ever raced — and the test
        # passed identically with the lock DISABLED. It was proving that the code runs, not
        # that it serialises.
        #
        # Now every worker signals ready and blocks until the parent releases them together,
        # and the critical section holds a short sleep so the read-modify-write window is wide
        # enough for a lost update to actually occur if the lock is not doing its job.
        go = os.path.join(self.tmp, "GO")

        worker = textwrap.dedent(f"""
            import json, sys, os, time
            sys.path.insert(0, {HERE!r})
            import ops_guard
            ops_guard.OPS_DIR = {self.tmp!r}
            ops_guard.LOCK_FILE = {os.path.join(self.tmp, '.state.lock')!r}

            open(os.path.join({self.tmp!r}, "ready-" + str(os.getpid())), "w").close()
            while not os.path.exists({go!r}):
                time.sleep(0.005)

            got = []
            for _ in range(10):
                with ops_guard.state_lock(timeout=60):
                    with open({counter!r}, encoding="utf-8") as f:
                        st = json.load(f)
                    time.sleep(0.004)          # widen the read-modify-write window
                    st["seq"] += 1
                    got.append(st["seq"])
                    with open({counter!r}, "w", encoding="utf-8") as f:
                        json.dump(st, f)
            print(json.dumps(got))
        """)

        procs = [
            subprocess.Popen([sys.executable, "-c", worker], cwd=HERE,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for _ in range(8)
        ]

        deadline = time.monotonic() + 60
        while len([n for n in os.listdir(self.tmp) if n.startswith("ready-")]) < 8:
            self.assertLess(time.monotonic(), deadline, "workers never became ready")
            time.sleep(0.02)
        open(go, "w").close()          # release them all at once

        allocated = []
        for p in procs:
            out, err = p.communicate(timeout=180)
            self.assertEqual(p.returncode, 0, err)
            allocated.extend(json.loads(out.strip()))

        with open(counter, encoding="utf-8") as f:
            final = json.load(f)["seq"]

        self.assertEqual(final, 80, "lost updates — the lock is not serialising writes")
        self.assertEqual(len(allocated), 80)
        self.assertEqual(len(set(allocated)), 80, "duplicate sequence numbers were issued")
        self.assertEqual(sorted(allocated), list(range(1, 81)))


class TestRecordEventWrapper(GuardTestCase):
    """The wrapper in ops.py — separate from the guard mechanism it uses.

    These stub the unlocked body so the wrapper's own decisions are what is under test:
    does it replay, does it conflict, and does it correctly refuse to remember a failure.
    """

    def setUp(self):
        super().setUp()
        import ops
        self.ops = ops
        ops._guard.OPS_DIR = self.tmp
        ops._guard.LOCK_FILE = os.path.join(self.tmp, ".state.lock")
        ops._guard.IDEMPOTENCY_FILE = os.path.join(self.tmp, "idempotency.json")
        self._real = ops._record_event_unlocked
        self.calls = []

    def tearDown(self):
        self.ops._record_event_unlocked = self._real
        super().tearDown()

    def _stub(self, result):
        def inner(form):
            self.calls.append(form)
            return result
        self.ops._record_event_unlocked = inner

    def test_a_replay_does_not_re_execute_the_command(self):
        """The whole point: the second call must not create a second event."""
        self._stub(({"id": "E-0007"}, None))
        form = {"type": "INTAKE", "plate": "A1234"}
        first, err = self.ops.record_event(form, idempotency_key="key-1")
        second, err2 = self.ops.record_event(form, idempotency_key="key-1")
        self.assertIsNone(err)
        self.assertIsNone(err2)
        self.assertEqual(first, second)
        self.assertEqual(len(self.calls), 1, "the command was executed twice")

    def test_a_failure_is_not_remembered(self):
        """A retry of a transient error must be allowed to succeed. Remembering the failure
        would make the error permanent for that key — the opposite of what a retry is for.

        This asserts on the STORE, not just on the retry's outcome. An earlier version checked
        only that the retry succeeded, and passed even when the wrapper was mutated to remember
        failures — because a stored `None` result and no record at all are indistinguishable to
        `lookup`. It was testing the fallback, not the rule it claimed to test.
        """
        self._stub((None, "temporarily unavailable"))
        form = {"type": "INTAKE", "plate": "A1234"}
        self.ops.record_event(form, idempotency_key="key-2")

        # No record at all is the expected state — the store file may not even exist yet,
        # which is itself the strongest form of "not remembered".
        stored = {}
        if os.path.isfile(self.guard.IDEMPOTENCY_FILE):
            with open(self.guard.IDEMPOTENCY_FILE, encoding="utf-8") as f:
                stored = json.load(f)
        self.assertNotIn("key-2", stored, "a failed command was written to the store")

        self._stub(({"id": "E-0008"}, None))
        event, err = self.ops.record_event(form, idempotency_key="key-2")
        self.assertIsNone(err)
        self.assertEqual(event, {"id": "E-0008"})

    def test_reusing_a_key_for_a_different_request_raises(self):
        self._stub(({"id": "E-0009"}, None))
        self.ops.record_event({"type": "INTAKE", "plate": "A1234"}, idempotency_key="key-3")
        with self.assertRaises(self.guard.IdempotencyConflict):
            self.ops.record_event({"type": "INTAKE", "plate": "ZZZZ"}, idempotency_key="key-3")

    def test_without_a_key_every_call_executes(self):
        """Idempotency is opt-in. A caller that supplies no key gets the old behaviour, so
        nothing that exists today silently changes."""
        self._stub(({"id": "E-0010"}, None))
        form = {"type": "INTAKE", "plate": "A1234"}
        self.ops.record_event(form)
        self.ops.record_event(form)
        self.assertEqual(len(self.calls), 2)


class TestFormToken(GuardTestCase):
    """Audit #4, browser half — the double-submit a refresh causes.

    Every test asserts a REFUSAL. The positive case (a token works once) is one line; the value
    is entirely in the ten ways a token must NOT work.
    """

    SECRET = "session-csrf-secret"

    def test_a_fresh_token_is_accepted_once(self):
        tok = self.guard.mint_form_token(self.SECRET)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.OK)

    def test_the_same_token_twice_is_spent(self):
        """THE defect. A refresh re-POSTs the identical body; the second must not execute."""
        tok = self.guard.mint_form_token(self.SECRET)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.OK)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.SPENT)

    def test_two_separate_renders_are_both_accepted(self):
        """The false-positive guard: filling the same form in twice is legitimate and must work.

        This is the test a content-hash implementation would fail, and the reason the token is
        minted per render rather than derived from the submitted fields. Two genuine MVR 50 cash
        sales a minute apart are byte-identical.
        """
        a = self.guard.mint_form_token(self.SECRET)
        b = self.guard.mint_form_token(self.SECRET)
        self.assertNotEqual(a, b)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, a),
                         self.guard.FormTokenState.OK)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, b),
                         self.guard.FormTokenState.OK)

    def test_a_tampered_nonce_is_invalid(self):
        tok = self.guard.mint_form_token(self.SECRET)
        nonce, issued, sig = tok.split(".")
        flipped = ("b" if nonce[0] != "b" else "c") + nonce[1:]
        self.assertEqual(self.guard.consume_form_token(self.SECRET, flipped + "." + issued + "." + sig),
                         self.guard.FormTokenState.INVALID)

    def test_an_expired_token_cannot_be_revived_by_restamping_it(self):
        """Re-stamping the issue time must not extend a token's life. The timestamp is inside
        the signature, so rewriting it breaks the MAC.

        The first version of this test re-stamped a token minted in the SAME second, so the
        "new" timestamp was identical, the signature still matched, and 'ok' was the correct
        answer to a question the test was not actually asking. It has to start from a token
        that is genuinely expired for the revival attempt to mean anything.
        """
        old = time.time() - (self.guard.FORM_TOKEN_TTL_SECONDS + 3600)
        tok = self.guard.mint_form_token(self.SECRET, now=old)
        nonce, issued, sig = tok.split(".")
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.INVALID, "precondition: token is expired")
        fresh = str(int(time.time()))
        self.assertNotEqual(fresh, issued, "precondition: the restamp must change the value")
        self.assertEqual(self.guard.consume_form_token(self.SECRET, nonce + "." + fresh + "." + sig),
                         self.guard.FormTokenState.INVALID)

    def test_a_token_from_another_session_is_invalid(self):
        """Binding to the session secret is what makes a leaked token useless elsewhere."""
        tok = self.guard.mint_form_token("some-other-session")
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.INVALID)

    def test_an_expired_token_is_invalid(self):
        old = time.time() - (self.guard.FORM_TOKEN_TTL_SECONDS + 60)
        tok = self.guard.mint_form_token(self.SECRET, now=old)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.INVALID)

    def test_a_token_minted_far_in_the_future_is_invalid(self):
        ahead = time.time() + self.guard.FORM_TOKEN_SKEW_SECONDS + 120
        tok = self.guard.mint_form_token(self.SECRET, now=ahead)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.INVALID)

    def test_small_clock_skew_is_tolerated(self):
        """serve.py on Windows and an agent under WSL will not agree to the second."""
        ahead = time.time() + (self.guard.FORM_TOKEN_SKEW_SECONDS / 2)
        tok = self.guard.mint_form_token(self.SECRET, now=ahead)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.OK)

    def test_empty_and_malformed_tokens_are_invalid(self):
        for bad in ("", "   ", "nodots", "two.parts", "a.b.c.d", ".", "..", "a..c"):
            self.assertEqual(
                self.guard.consume_form_token(self.SECRET, bad),
                self.guard.FormTokenState.INVALID,
                repr(bad) + " was not refused",
            )

    def test_a_form_rendered_without_a_session_cannot_be_submitted(self):
        """Minting with no secret must not produce something that passes. Failing open here
        would mean any page that lost its session silently dropped the protection."""
        tok = self.guard.mint_form_token("")
        self.assertEqual(tok, "")
        self.assertEqual(self.guard.consume_form_token("", tok),
                         self.guard.FormTokenState.INVALID)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.INVALID)

    def test_a_forged_token_never_reaches_the_store(self):
        """Signature is checked before the store is opened, so garbage can neither grow the file
        nor contend for the lock. Verifying in the other order is a free disk-fill."""
        for bad in ("forged.9999999999.deadbeef", "x.1.y", "z." + str(int(time.time())) + ".00"):
            self.guard.consume_form_token(self.SECRET, bad)
        self.assertFalse(
            os.path.isfile(self.guard.IDEMPOTENCY_FILE),
            "a forged token caused a write to the idempotency store",
        )

    def test_a_spent_token_does_not_collide_with_an_idempotency_key(self):
        """The store is shared. A client passing the bare nonce as its own idempotency key must
        not read as a replay of the form submission, or vice versa."""
        tok = self.guard.mint_form_token(self.SECRET)
        nonce = tok.split(".")[0]
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.OK)
        self.assertIsNone(self.guard.lookup(nonce, "some-hash"))

    def test_spent_tokens_are_pruned_on_the_token_ttl_not_the_key_retention(self):
        stale = time.time() - (self.guard.FORM_TOKEN_TTL_SECONDS + 3600)
        records = {
            self.guard.FORM_TOKEN_PREFIX + "old": {"hash": "", "at": stale, "result": {}},
            "client-key": {"hash": "h", "at": stale, "result": {"id": "E-1"}},
        }
        kept = self.guard._prune(records, time.time())
        self.assertNotIn(self.guard.FORM_TOKEN_PREFIX + "old", kept,
                         "a spent form token outlived its own expiry")
        self.assertIn("client-key", kept,
                      "a client idempotency key was pruned on the form token's clock")


class TestFormTokenConcurrency(GuardTestCase):
    def test_a_double_tap_spends_the_token_exactly_once(self):
        """Six processes submit the SAME token simultaneously — the impatient double-click.

        Same start-barrier discipline as the sequence-number test, and for the same reason:
        without it the first process finishes before the second starts, nothing overlaps, and
        the test passes whether or not the lock is doing anything.
        """
        secret = "session-csrf-secret"
        tok = self.guard.mint_form_token(secret)
        go = os.path.join(self.tmp, "GO")

        worker = textwrap.dedent(
            """
            import sys, os, time
            sys.path.insert(0, {here!r})
            import ops_guard
            ops_guard.OPS_DIR = {tmp!r}
            ops_guard.LOCK_FILE = {lock!r}
            ops_guard.IDEMPOTENCY_FILE = {store!r}

            open(os.path.join({tmp!r}, "ready-" + str(os.getpid())), "w").close()
            while not os.path.exists({go!r}):
                time.sleep(0.005)

            print(ops_guard.consume_form_token({secret!r}, {tok!r}))
            """
        ).format(
            here=HERE,
            tmp=self.tmp,
            lock=os.path.join(self.tmp, ".state.lock"),
            store=os.path.join(self.tmp, "idempotency.json"),
            go=go,
            secret=secret,
            tok=tok,
        )

        procs = [
            subprocess.Popen([sys.executable, "-c", worker], cwd=HERE,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for _ in range(6)
        ]

        deadline = time.monotonic() + 60
        while len([n for n in os.listdir(self.tmp) if n.startswith("ready-")]) < 6:
            self.assertLess(time.monotonic(), deadline, "workers never became ready")
            time.sleep(0.02)
        open(go, "w").close()

        results = []
        for p in procs:
            out, err = p.communicate(timeout=180)
            self.assertEqual(p.returncode, 0, err)
            results.append(out.strip())

        self.assertEqual(results.count("ok"), 1,
                         "the token was spent " + str(results.count("ok")) + " times: " + str(results))
        self.assertEqual(results.count("spent"), 5, str(results))


class TestLockContentionErrno(GuardTestCase):
    """Windows signals lock contention two different ways, and only one was handled.

    The audit-#9 stress test caught this roughly one run in five — which means a single green
    run made the lock look sound. These tests force each errno deterministically, so the
    behaviour is pinned rather than sampled.
    """

    def _failing_open(self, exc, times):
        """Wrap os.open so the first `times` calls against the LOCK file raise `exc`."""
        real = os.open
        state = {"n": 0}

        def fake(path, flags, *a, **kw):
            if str(path) == str(self.guard.LOCK_FILE) and state["n"] < times:
                state["n"] += 1
                raise exc
            return real(path, flags, *a, **kw)

        return fake, state

    def test_a_delete_pending_lock_is_contention_not_a_crash(self):
        """PermissionError (EACCES) out of os.open means 'exists, being released' on Windows.

        Treating it as fatal turned ordinary contention into an unhandled exception — a 500 at
        the counter on a double-tap, exactly when the lock is doing its job.
        """
        fake, state = self._failing_open(PermissionError(13, "Permission denied"), 3)
        with unittest.mock.patch("os.open", fake):
            with self.guard.state_lock(timeout=5):
                pass
        self.assertEqual(state["n"], 3, "the failing opens were not exercised")

    def test_file_exists_is_still_contention(self):
        """The original path must keep working — this is the regression guard on the fix."""
        fake, state = self._failing_open(FileExistsError(17, "File exists"), 3)
        with unittest.mock.patch("os.open", fake):
            with self.guard.state_lock(timeout=5):
                pass
        self.assertEqual(state["n"], 3)

    def test_a_permanent_permission_fault_still_fails_loudly(self):
        """Retrying must not become hanging. A fault that never clears has to surface as
        LockTimeout, with the underlying error chained so the cause is not lost."""
        fake, _ = self._failing_open(PermissionError(13, "Permission denied"), 10**6)
        with unittest.mock.patch("os.open", fake):
            with self.assertRaises(self.guard.LockTimeout) as caught:
                with self.guard.state_lock(timeout=0.2):
                    pass
        self.assertIsInstance(caught.exception.__cause__, PermissionError,
                              "the original error was not chained onto the timeout")

    def test_the_lock_is_still_exclusive_under_the_new_handling(self):
        """Widening the except clause must not make acquisition succeed while held."""
        with self.guard.state_lock(timeout=5):
            with self.assertRaises(self.guard.LockTimeout):
                with self.guard.state_lock(timeout=0.2, stale_after=10_000):
                    pass


class TestPruningActuallyHappens(GuardTestCase):
    """That the callers INVOKE _prune, not merely that _prune works.

    Found by AG's independent review of SERP-114 on 22 August, and it is the exact failure this
    file warns about elsewhere. `test_spent_tokens_are_pruned_on_the_token_ttl...` calls _prune
    directly, so it proves the pruning RULE is right and nothing else. Delete the _prune call
    from both remember() and consume_form_token() and all 34 tests still passed — the store would
    have grown without bound and the suite would have kept saying it was covered.

    A unit test of a helper is not a test that the helper is wired in. These assert against the
    ON-DISK file after a real call, which is the only thing that can tell the difference.
    """

    SECRET = "session-csrf-secret"

    def _write_stale(self, key, age_seconds):
        """Put a record on disk that is old enough to be pruned."""
        stale = time.time() - age_seconds
        self.guard._save_records({key: {"hash": "h", "at": stale, "result": {"id": "OLD"}}})

    def _stored(self):
        if not os.path.isfile(self.guard.IDEMPOTENCY_FILE):
            return {}
        with open(self.guard.IDEMPOTENCY_FILE, encoding="utf-8") as f:
            return json.load(f)

    def test_remember_prunes_expired_records_from_disk(self):
        old_key = self.guard.FORM_TOKEN_PREFIX + "ancient"
        self._write_stale(old_key, self.guard.FORM_TOKEN_TTL_SECONDS + 3600)
        self.assertIn(old_key, self._stored(), "precondition: the stale record is on disk")

        with self.guard.state_lock():
            self.guard.remember("fresh-key", "digest", {"id": "E-1"})

        stored = self._stored()
        self.assertNotIn(old_key, stored, "remember() did not prune — the store grows forever")
        self.assertIn("fresh-key", stored, "remember() lost the record it was asked to store")

    def test_consuming_a_form_token_prunes_expired_records_from_disk(self):
        old_key = self.guard.FORM_TOKEN_PREFIX + "ancient"
        self._write_stale(old_key, self.guard.FORM_TOKEN_TTL_SECONDS + 3600)
        self.assertIn(old_key, self._stored(), "precondition: the stale record is on disk")

        tok = self.guard.mint_form_token(self.SECRET)
        self.assertEqual(self.guard.consume_form_token(self.SECRET, tok),
                         self.guard.FormTokenState.OK)

        stored = self._stored()
        self.assertNotIn(old_key, stored,
                         "consume_form_token() did not prune — spent tokens accumulate forever")
        self.assertEqual(len([k for k in stored if k.startswith(self.guard.FORM_TOKEN_PREFIX)]), 1,
                         "expected exactly the newly spent token to remain")

    def test_pruning_does_not_evict_records_that_are_still_live(self):
        """The other direction, and the one that would hurt more: over-eager pruning silently
        drops replay protection, so a genuine retry would re-execute."""
        live_form = self.guard.FORM_TOKEN_PREFIX + "recent"
        self.guard._save_records({
            live_form: {"hash": "", "at": time.time() - 60, "result": {}},
            "live-client-key": {"hash": "h", "at": time.time() - 60, "result": {"id": "E-2"}},
        })
        with self.guard.state_lock():
            self.guard.remember("another-key", "digest", {"id": "E-3"})

        stored = self._stored()
        self.assertIn(live_form, stored, "a live form token was pruned")
        self.assertIn("live-client-key", stored, "a live client key was pruned")

    def test_a_client_key_survives_the_form_token_ttl_on_disk(self):
        """The two retentions are different, and it has to hold through a real call rather than
        only inside _prune."""
        age = self.guard.FORM_TOKEN_TTL_SECONDS + 3600
        self.assertLess(age, self.guard.RETENTION_SECONDS, "precondition: still inside key retention")
        self._write_stale("client-key", age)

        with self.guard.state_lock():
            self.guard.remember("trigger", "digest", {"id": "E-4"})

        self.assertIn("client-key", self._stored(),
                      "a client idempotency key was pruned on the form token's shorter clock")


if __name__ == "__main__":
    unittest.main(verbosity=2)
