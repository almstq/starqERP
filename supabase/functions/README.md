# StarqERP Edge functions

`starq-api` is the browser application's cloud database boundary. The browser
must not receive the Supabase service-role key or query tenant tables directly.

Required function secrets:

- `STARQBOOKS_SESSION_SECRET`
- `STARQBOOKS_GOOGLE_CLIENT_ID`
- optional `STARQBOOKS_GOOGLE_ANDROID_CLIENT_ID` for a separately deployed Android client
- `STARQBOOKS_ALLOWED_ORIGINS` for production browser origins

The retired Flutter client is not present in this repository. Its former
request shape and integration notes remain only where explicitly labelled as
historical; the current browser client still uses the legacy command body while
the envelope migration remains open.

Deploy with JWT verification disabled because the foundation engine verifies
Google ID tokens and issues its own signed `sb_ops` session. This makes the
function a public authentication boundary, so rate limits, strict origins,
payload caps, CSRF, idempotency and database authorization are mandatory.

No automation principal is enabled for the pilot.
