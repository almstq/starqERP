import { createClient } from "npm:@supabase/supabase-js@2";
/**
 * The command contract is the single source of truth for authorization.
 * This boundary IMPORTS its decisions rather than restating them — a second
 * copy of the rules is exactly how the seat vocabulary drifted three ways.
 *
 * `_shared/commands.ts` is generated from `contracts/commands.ts` by
 * `scripts/sync-contract.mjs`, because Supabase bundles only what lives under
 * `supabase/functions/`. Never edit the generated copy.
 */
import {
  audienceIsValid,
  authorizeCommand,
  fromLegacyBody,
  seatWriteIsSafe,
  SEATS,
  type AudiencePolicy,
  type Principal,
  type SeatCode,
} from "../_shared/commands.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SESSION_SECRET = Deno.env.get("STARQBOOKS_SESSION_SECRET") ?? "";
// GOOGLE_CLIENT_IDS (a combined allowlist across both platforms) was audit
// critical #5 and has been replaced by AUDIENCE_POLICIES, which maps exactly one
// audience to each client kind. Do not reintroduce a flat list of client ids.
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("STARQBOOKS_ALLOWED_ORIGINS") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean),
);
const COOKIE_NAME = "sb_ops";
const MAX_BODY_BYTES = 16_384;
const SESSION_SECONDS = 8 * 60 * 60;
/**
 * Seats this boundary may write.
 *
 * WIDENED TO THE FULL TWELVE, 22 Aug 2026 — step 2 of 3, now that step 1 is done.
 * Migration 202608210009 seeded quartermaster, receiver, stores and ledger_poster into
 * `public.seats` and was applied and verified against the live database on 22 August, so
 * the foreign key from `membership_seats.seat_code` can now accept all twelve.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS SET IS AN INTERSECTION FILTER, NOT A GRANT. It is easy to read it the other way.
 * ─────────────────────────────────────────────────────────────────────────────
 * establishPerson computes:
 *
 *     entry.seats.filter((seat) => ALLOWED_SEATS.has(seat))
 *
 * so a seat has to be in the person's allowlist entry AND in this set. Widening the set
 * gives nobody a seat they were not already granted in the allowlist — it stops seats they
 * WERE granted from being silently discarded at sign-in.
 *
 * What the eight-seat version was actually doing, which is worse than "vocabulary drift":
 *
 * Named by SEAT, not by person — the people are real and this file is publishable (DEC-012).
 *
 *   storekeeper  allowlist [quartermaster, stores]        → both filtered out → seats.length 0
 *                                                         → throw no_active_seat.
 *                                                         THAT PERSON CANNOT SIGN IN AT ALL.
 *   MD           allowlist [managing_director, receiver,  → loses `receiver`, so they cannot take
 *                qc_signer, technician, counter]            a GRN once the matrix requires it
 *   director     allowlist [director, financial_          → loses `ledger_poster`
 *                controller, payer, ledger_poster,
 *                counter]
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ORDER OF REPAIR — unchanged, and the reason it is not negotiable is now concrete
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. seed the four missing seats into public.seats   — DONE 22 Aug (202608210009)
 *   2. widen this constant to the contract's SEATS     — THIS CHANGE
 *   3. wire the matrix into api_garage_command         — 202608220011, written, NOT applied
 *
 * Step 3 before step 2 is the hard outage the original note warned about, and here is the
 * exact mechanism: 202608220011 makes PURCHASE/receive require the `receiver` seat. In tenant one
 * exactly ONE person holds `receiver`. With this constant still at eight, `receiver` is filtered
 * out of their session, so they hold no seat that can receive and the garage cannot book a delivery.
 *
 * So this constant must be DEPLOYED before 202608220011 is APPLIED. They are two different
 * systems with two different release paths, and nothing enforces the order but this note and
 * the test in tests/contract/.
 */
const DB_SEEDED_SEATS: readonly SeatCode[] = [...SEATS];
const ALLOWED_SEATS = new Set<string>(DB_SEEDED_SEATS);

/**
 * Every database call this boundary makes is bounded in time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS — found 22 Aug 2026 while gating the Edge deploy
 * ─────────────────────────────────────────────────────────────────────────────
 * The deploy makes `refreshSessionAuthority` run on EVERY authenticated request,
 * so a database round-trip moved onto the hot path of a system whose users are
 * two people on shop wifi.
 *
 * AG traced the failure behaviour and got it right as far as it went: when the
 * RPC returns an error, `refreshSessionAuthority` returns null, the request 401s,
 * and the Flutter client drops cleanly to the login screen. Fails closed, does
 * not fail open, does not 500.
 *
 * But that trace answered "what happens on ERROR" and the question was "what
 * happens on TIMEOUT". Those were not the same thing here, because there was no
 * timeout to speak of:
 *
 *   - supabase-js issues its requests through `fetch`, which in Deno has no
 *     default timeout.
 *   - No AbortSignal was passed to the client. The only AbortController in this
 *     file guards the Google tokeninfo call at 5s.
 *
 * So a hung connection did not produce an error. It produced a WAIT — the
 * invocation sat there until the platform's wall clock killed it. From the shop
 * floor that is not "blips to the login screen", it is "the app is frozen".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE VALUE IS GENEROUS
 * ─────────────────────────────────────────────────────────────────────────────
 * A rejected session does not merely fail — it EVICTS the cookie (`Max-Age=0`),
 * so a spurious timeout does not degrade the session, it destroys it and forces
 * a full Google re-login. That asymmetry is the reason this is 10 seconds and
 * not 2: the cost of firing early is much higher than the cost of firing late.
 * A healthy RPC here returns in tens of milliseconds, so 10s only ever catches
 * a genuine hang.
 *
 * OPEN QUESTION, deliberately not answered in this change: whether a transient
 * database blip should destroy a session at all. The cookie is HMAC-signed and
 * independently authentic; being unable to CONFIRM authority right now is not
 * the same as the session being forged, and the current code treats them
 * identically. Changing that is a security-posture decision for the founder,
 * not a bug fix to slip into a timeout patch.
 */
const DB_TIMEOUT_MS = 10_000;

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      // Respect a caller-supplied signal if one ever appears, rather than
      // silently overriding it.
      if (init?.signal) return fetch(input, init);
      return fetch(input, { ...init, signal: AbortSignal.timeout(DB_TIMEOUT_MS) });
    },
  },
});
const encoder = new TextEncoder();
const anonymousWindows = new Map<string, { count: number; resetAt: number }>();

type Json = Record<string, unknown>;
type Session = {
  person_uuid: string;
  person_key: string;
  display_label: string;
  organisation_id: string;
  seats: string[];
  acting_as: string;
  csrf: string;
  exp: number;
};
type AllowPerson = {
  person_id?: string;
  name?: string;
  email?: string;
  default_seat?: string;
  seats?: string[];
  entities?: string[];
  status?: string;
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function verifyHmac(value: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
    );
    return await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(value));
  } catch {
    return false;
  }
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signSession(session: Session): Promise<string> {
  const payload = base64Url(encoder.encode(JSON.stringify(session)));
  return `${payload}.${await hmac(payload)}`;
}

async function readSession(req: Request): Promise<Session | null> {
  const raw = (req.headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  const [payload, signature, extra] = raw.split(".");
  if (!payload || !signature || extra || !await verifyHmac(payload, signature)) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Session;
    if (!session.exp || session.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!session.organisation_id || !uuid(session.organisation_id) || !session.person_uuid || !session.acting_as) return null;
    return session;
  } catch {
    return null;
  }
}

async function refreshSessionAuthority(session: Session): Promise<Session | null> {
  const { data, error } = await db.rpc("api_session_authority", {
    target_org: session.organisation_id,
    target_person: session.person_uuid,
    target_seat: session.acting_as,
  });
  if (error || !data || typeof data !== "object") return null;
  const authority = data as { active?: unknown; seats?: unknown };
  const seats = Array.isArray(authority.seats)
    ? authority.seats.filter((seat): seat is string => typeof seat === "string")
    : [];
  if (authority.active !== true || !seats.includes(session.acting_as)) return null;
  return { ...session, seats };
}

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, x-csrf-token, x-idempotency-key, x-starq-client-kind",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["access-control-allow-origin"] = origin;
  return headers;
}

function json(status: number, body: Json, origin: string | null, extra: HeadersInit = {}): Response {
  const headers = new Headers(corsHeaders(origin));
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function cookie(value: string, maxAge = SESSION_SECONDS): string {
  /**
   * SameSite=None, and it is not a downgrade made casually.
   *
   * The web client is served from a DIFFERENT SITE to this API — localhost:8080 or a
   * Vercel domain, against <ref>.supabase.co. Every authenticated call is therefore a
   * cross-site request, and a `SameSite=Strict` cookie is never sent on one. The result
   * was a session that authenticated perfectly and then evaporated: login succeeded and
   * set the cookie, the very next request arrived without it, refreshSessionAuthority saw
   * no session, returned 401, and the client bounced to the login screen about a second
   * after reaching the app. The database was correct the whole time — 22 Aug 2026.
   *
   * WHAT STILL PROTECTS THIS, because SameSite is not the only lock on the door:
   *   · a CSRF token is required on every state-changing route (seat switch, ops event,
   *     logout) and is compared against the value held in the signed session
   *   · CORS is an explicit origin allowlist, so a hostile page cannot read a response
   *     even if it manages to provoke one
   *   · the cookie stays HttpOnly and Secure, so script cannot read it and it never
   *     travels in clear
   *   · every request re-checks authority against the database, so a stolen session
   *     stops working the moment the seat is revoked
   *
   * Android is unaffected: it stores the cookie itself and sends it as an explicit header,
   * where SameSite has no meaning.
   *
   * KNOWN LIMIT, worth planning for rather than discovering: this is a third-party cookie
   * from the browser's point of view, and Chrome is phasing those out. The durable fix is
   * to stop using a cookie on web and carry the session in an Authorization header. That
   * is a real change to both sides and should be done deliberately, not folded into a
   * one-line unblock at midnight.
   */
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`;
}

function routePath(url: string): string {
  const path = new URL(url).pathname;
  const marker = "/starq-api";
  const at = path.indexOf(marker);
  return at >= 0 ? path.slice(at + marker.length) || "/" : path;
}

function sourceKey(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown").split(",")[0].trim();
}

function anonymousRateAllowed(key: string): boolean {
  const now = Date.now();
  const current = anonymousWindows.get(key);
  if (!current || current.resetAt <= now) {
    anonymousWindows.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 20;
}

async function securityEvent(
  req: Request,
  eventType: string,
  outcome: "accepted" | "rejected" | "blocked" | "error",
  session: Session | null,
  metadata: Json = {},
): Promise<void> {
  try {
    const sourceHash = await hash(sourceKey(req));
    await db.from("security_events").insert({
      organisation_id: session?.organisation_id ?? null,
      principal_kind: session ? "human" : "anonymous",
      principal_ref: session?.person_key ?? null,
      event_type: eventType,
      outcome,
      source_hash: sourceHash,
      metadata,
    });
  } catch {
    // Security logging failure must not disclose credentials or database detail.
  }
}

async function readJson(req: Request): Promise<Json> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new Error("payload_too_large");
  const text = await req.text();
  if (encoder.encode(text).length > MAX_BODY_BYTES) throw new Error("payload_too_large");
  const value = text ? JSON.parse(text) : {};
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("invalid_json_object");
  return value as Json;
}

function allowlist(): AllowPerson[] {
  const raw = Deno.env.get("STARQBOOKS_ALLOWLIST_JSON") ?? "";
  const parsed = JSON.parse(raw) as { people?: AllowPerson[] };
  return Array.isArray(parsed.people) ? parsed.people : [];
}

/**
 * AUDIT CRITICAL #5 — platform audience isolation.
 *
 * One audience per client kind, never a list. The previous code accepted any
 * `aud` present in a combined allowlist, so a web request could present an
 * Android-audience token and be accepted; `x-starq-client-kind` was read but
 * did not select anything.
 *
 * An absent or unknown client kind is refused rather than defaulted —
 * defaulting is how the hole existed in the first place.
 */
const AUDIENCE_POLICIES: readonly AudiencePolicy[] = [
  { clientKind: "web", audience: Deno.env.get("STARQBOOKS_GOOGLE_CLIENT_ID") ?? "" },
  { clientKind: "android", audience: Deno.env.get("STARQBOOKS_GOOGLE_ANDROID_CLIENT_ID") ?? "" },
].filter((p) => p.audience) as readonly AudiencePolicy[];

async function verifyGoogleToken(
  credential: string,
  clientKind: string | null,
): Promise<{ sub: string; email: string; name: string }> {
  if (!credential || credential.length > 4096 || AUDIENCE_POLICIES.length === 0) throw new Error("identity_configuration_error");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const endpoint = new URL("https://oauth2.googleapis.com/tokeninfo");
    endpoint.searchParams.set("id_token", credential);
    const response = await fetch(endpoint, { signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error("invalid_google_token");
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > 16_384) throw new Error("identity_response_too_large");
    const claims = await response.json() as Record<string, string>;
    // The declared platform selects exactly ONE acceptable audience. A token
    // valid for the other platform is refused even though it is otherwise good.
    if (!audienceIsValid(clientKind, claims.aud, AUDIENCE_POLICIES).ok) {
      throw new Error("identity_audience_rejected");
    }
    if (claims.email_verified !== "true" || !claims.sub || !claims.email) {
      throw new Error("identity_claims_rejected");
    }
    return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name ?? claims.email };
  } finally {
    clearTimeout(timer);
  }
}

async function establishPerson(claims: { sub: string; email: string; name: string }): Promise<Session> {
  const entry = allowlist().find((person) =>
    person.status !== "disabled" && person.email?.trim().toLowerCase() === claims.email
  );
  if (!entry?.person_id) throw new Error("not_allowlisted");
  const seats = [...new Set((entry.seats ?? []).filter((seat) => ALLOWED_SEATS.has(seat)))];
  if (seats.length === 0) throw new Error("no_active_seat");

  const existing = await db.from("persons").select("id,external_subject,status")
    .eq("person_key", entry.person_id).maybeSingle();
  if (existing.error) throw new Error("identity_lookup_failed");
  if (existing.data?.external_subject && existing.data.external_subject !== claims.sub) {
    throw new Error("identity_binding_conflict");
  }
  const personWrite = await db.from("persons").upsert({
    person_key: entry.person_id,
    external_subject: claims.sub,
    display_label: entry.name ?? claims.name,
    status: "active",
  }, { onConflict: "person_key" }).select("id").single();
  if (personWrite.error) throw new Error("identity_write_failed");
  const personUuid = personWrite.data.id as string;

  const declaredEntities = entry.entities ?? [];
  let orgId: string | null = null;
  if (declaredEntities.length > 0) {
    const targetEntity = declaredEntities[0];
    const orgLookup = await db.from("organisations").select("id")
      .or(`slug.eq.${targetEntity},legal_name.ilike.%${targetEntity}%`)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (orgLookup.data?.id) {
      orgId = orgLookup.data.id as string;
    }
  }
  if (!orgId) {
    const defaultOrg = await db.from("organisations").select("id")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (defaultOrg.data?.id) {
      orgId = defaultOrg.data.id as string;
    }
  }
  if (!orgId) throw new Error("organisation_not_found");

  const membershipWrite = await db.from("memberships").upsert({
    organisation_id: orgId,
    person_id: personUuid,
    status: "active",
  }, { onConflict: "organisation_id,person_id" }).select("id").single();
  if (membershipWrite.error) throw new Error("membership_write_failed");
  const membershipId = membershipWrite.data.id as string;
  /**
   * AUDIT CRITICAL #1 — fixed here.
   *
   * This upsert previously carried `revoked_at: null`, so every sign-in
   * silently reinstated every seat an administrator had revoked. Access could
   * not be withdrawn from anyone: revocation lasted until the person's next
   * login.
   *
   * The fix is OMISSION, not a different value. Passing `revoked_at: null`
   * reinstates; passing the previous value is a read-then-write race. The
   * payload must not mention the column at all, so an existing row keeps
   * whatever revocation state it already has.
   *
   * `ignoreDuplicates` makes this insert-if-absent rather than update: a seat
   * that does not exist is created, a seat that does is left entirely alone.
   * Only an explicit, audited grant may un-revoke.
   */
  const seatRows = seats.map((seat) => ({ membership_id: membershipId, seat_code: seat }));
  for (const row of seatRows) {
    const safe = seatWriteIsSafe(row);
    if (!safe.ok) throw new Error("seat_write_would_alter_revocation");
  }
  const seatWrite = await db.from("membership_seats").upsert(seatRows, {
    onConflict: "membership_id,seat_code",
    ignoreDuplicates: true,
  });
  if (seatWrite.error) throw new Error("seat_write_failed");

  const preferred = entry.default_seat && seats.includes(entry.default_seat) ? entry.default_seat : seats[0];
  return {
    person_uuid: personUuid,
    person_key: entry.person_id,
    display_label: entry.name ?? claims.name,
    organisation_id: orgId,
    seats,
    acting_as: preferred,
    csrf: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
}

function userDto(session: Session): Json {
  return {
    person_id: session.person_key,
    name: session.display_label,
    seats: session.seats,
    acting_as: session.acting_as,
    seat_label: session.acting_as.replaceAll("_", " "),
    csrf: session.csrf,
    allowed_entities: ["CI"],
  };
}

function csrfValid(req: Request, body: Json, session: Session): boolean {
  const header = req.headers.get("x-csrf-token") ?? "";
  const payload = typeof body.csrf === "string" ? body.csrf : "";
  return (header || payload) === session.csrf;
}

function uuid(value: string | null): boolean {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const path = routePath(req.url);
  const requestId = crypto.randomUUID();
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, { ok: false, error: "origin_denied", request_id: requestId }, origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (!anonymousRateAllowed(sourceKey(req))) {
    await securityEvent(req, "api.rate_limit", "blocked", null);
    return json(429, { ok: false, error: "rate_limited", request_id: requestId }, origin, { "retry-after": "60" });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_KEY || SESSION_SECRET.length < 32) throw new Error("server_configuration_error");
    if (req.method === "GET" && (path === "/" || path === "/health" || path === "/api/meta")) {
      const readiness = await db.from("organisations").select("id", { count: "exact", head: true })
        .eq("status", "active");
      if (readiness.error || (readiness.count ?? 0) < 1) throw new Error("database_not_ready");
      return json(200, { ok: true, service: "starqERP", api_version: "0.2.0", database: "ready" }, origin);
    }

    if (req.method === "POST" && path === "/api/auth/google") {
      const body = await readJson(req);
      // The client declares its platform in a header; the header selects which
      // single Google audience is acceptable. It is not advisory.
      const claims = await verifyGoogleToken(
        String(body.credential ?? ""),
        req.headers.get("x-starq-client-kind"),
      );
      const session = await establishPerson(claims);
      const signed = await signSession(session);
      await securityEvent(req, "auth.google", "accepted", session);
      return json(200, { ok: true, user: userDto(session) }, origin, { "set-cookie": cookie(signed) });
    }

    const signedSession = await readSession(req);
    const session = signedSession ? await refreshSessionAuthority(signedSession) : null;
    if (!session) {
      await securityEvent(req, "auth.session", "rejected", null, { path });
      return json(401, { ok: false, error: "unauthenticated", request_id: requestId }, origin, {
        "set-cookie": cookie("", 0),
      });
    }

    if (req.method === "GET" && path === "/api/me") {
      return json(200, { ok: true, user: userDto(session) }, origin);
    }

    if (req.method === "POST" && path === "/api/auth/logout") {
      const body = await readJson(req);
      if (!csrfValid(req, body, session)) return json(400, { ok: false, error: "csrf_mismatch" }, origin);
      await securityEvent(req, "auth.logout", "accepted", session);
      return json(200, { ok: true }, origin, { "set-cookie": cookie("", 0) });
    }

    if (req.method === "POST" && path === "/api/auth/seat") {
      const body = await readJson(req);
      if (!csrfValid(req, body, session)) return json(400, { ok: false, error: "csrf_mismatch" }, origin);
      const seat = String(body.seat ?? "");
      if (!session.seats.includes(seat)) return json(403, { ok: false, error: "seat_not_granted" }, origin);
      const updated: Session = { ...session, acting_as: seat, csrf: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
      await securityEvent(req, "auth.seat", "accepted", updated, { seat });
      return json(200, { ok: true, user: userDto(updated) }, origin, { "set-cookie": cookie(await signSession(updated)) });
    }

    if (req.method === "GET" && path === "/api/ops/pulse") {
      const { data, error } = await db.rpc("api_garage_pulse", {
        target_org: session.organisation_id, target_person: session.person_uuid, target_seat: session.acting_as,
      });
      if (error) throw new Error("pulse_query_failed");
      return json(200, data as Json, origin);
    }

    if (req.method === "GET" && path === "/api/ops/purchases") {
      const { data, error } = await db.rpc("api_garage_purchases", {
        target_org: session.organisation_id, target_person: session.person_uuid, target_seat: session.acting_as,
      });
      if (error) throw new Error("purchase_query_failed");
      return json(200, data as Json, origin);
    }

    if (req.method === "GET" && path === "/api/ops/job") {
      const jobId = new URL(req.url).searchParams.get("id");
      const byId = uuid(jobId);
      let query = db.from("garage_jobs").select("*").eq("organisation_id", session.organisation_id);
      query = byId ? query.eq("id", jobId!) : query.eq("job_no", jobId ?? "");
      const job = await query.maybeSingle();
      if (job.error || !job.data) return json(404, { ok: false, error: "job_not_found" }, origin);
      const events = await db.from("job_events").select("*")
        .eq("organisation_id", session.organisation_id).eq("job_id", job.data.id).order("occurred_at");
      if (events.error) throw new Error("job_event_query_failed");
      return json(200, { ok: true, job: job.data, events: events.data ?? [] }, origin);
    }

    if (req.method === "POST" && path === "/api/ops/event") {
      const body = await readJson(req);
      if (!csrfValid(req, body, session)) return json(400, { ok: false, error: "csrf_mismatch" }, origin);
      const commandKey = req.headers.get("x-idempotency-key");
      if (!uuid(commandKey)) return json(428, { ok: false, error: "valid_idempotency_key_required" }, origin);

      /**
       * AUTHORIZE AT THE BOUNDARY, BEFORE THE RPC.
       *
       * Independent review, 21 Aug 2026 (DP): "The contract is correct. The runtime does not
       * use it." Importing `audienceIsValid` and `seatWriteIsSafe` while delegating the actual
       * authorization to `api_garage_command` left the decision in the RPC's old matrix — the
       * `target_seat` fallback, no segregation of duties, an eight-seat vocabulary. A second
       * copy of the rules is the whole failure mode, and that was a second copy.
       *
       * The RPC keeps its own check. Two independent refusals is defence in depth; what is not
       * acceptable is two independent DECISIONS, so the contract is now the one that decides and
       * the RPC's copy becomes redundant rather than authoritative. It is removed in a later
       * slice, once nothing depends on it.
       */
      const intent = fromLegacyBody(body);
      if (!intent) {
        await securityEvent(req, "garage.command", "rejected", session, { code: "unknown_command" });
        return json(400, { ok: false, error: "unknown_command", request_id: requestId }, origin);
      }
      const principal: Principal = {
        personId: session.person_uuid,
        organisationId: session.organisation_id,
        actingSeat: session.acting_as as SeatCode,
        heldSeats: session.seats as SeatCode[],
        seatVerifiedAt: new Date().toISOString(),
      };
      const verdict = authorizeCommand(principal, intent);
      if (!verdict.ok) {
        await securityEvent(req, "garage.command", "rejected", session, { code: verdict.error });
        return json(403, { ok: false, error: verdict.error, request_id: requestId }, origin);
      }

      const { data, error } = await db.rpc("api_garage_command", {
        target_org: session.organisation_id,
        target_person: session.person_uuid,
        target_seat: session.acting_as,
        command_key: commandKey,
        command: body,
        request_identifier: requestId,
      });
      if (error) {
        await securityEvent(req, "garage.command", "rejected", session, { code: error.code ?? "database_rejection" });
        return json(400, { ok: false, error: "command_rejected", request_id: requestId }, origin);
      }
      await securityEvent(req, "garage.command", "accepted", session, { idempotency_key: commandKey });
      return json(200, data as Json, origin);
    }

    return json(404, { ok: false, error: "route_not_found", request_id: requestId }, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    const publicCode = new Set([
      "payload_too_large", "invalid_json_object", "invalid_google_token",
      "identity_claims_rejected", "not_allowlisted", "organisation_not_found",
      "no_active_seat", "identity_binding_conflict",
    ]).has(code) ? code : "request_failed";
    /**
     * The SANITIZED code goes to the caller. The TRUE code goes to the log.
     *
     * Until 22 Aug 2026 this line recorded `publicCode` — the already-collapsed
     * value — so every failure outside the small public allowlist was stored as
     * `request_failed` and the real reason was destroyed at the only point that
     * could have kept it. Debugging a live sign-in failure that night meant
     * reading source and guessing, because the audit table faithfully recorded
     * five identical rows saying nothing.
     *
     * A server-side security log exists precisely to hold what the response must
     * not. Withholding detail from an unauthenticated caller is correct;
     * withholding it from ourselves was not a security measure, it was a blind
     * spot wearing one as a costume.
     *
     * `internal_code` is bounded because an arbitrary driver message can be long
     * and can carry schema detail. This table is internal and append-only, so
     * that detail is acceptable here and nowhere else — it must never reach the
     * response body.
     */
    await securityEvent(req, "api.error", publicCode === "request_failed" ? "error" : "rejected", null, {
      code: publicCode,
      internal_code: code.slice(0, 300),
      path,
    });
    return json(publicCode === "payload_too_large" ? 413 : 400, { ok: false, error: publicCode, request_id: requestId }, origin);
  }
});
