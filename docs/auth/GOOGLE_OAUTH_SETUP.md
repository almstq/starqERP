# Google OAuth Infrastructure & Integration Setup

**Target System**: starqERP Cloud & Web Client  
**Backend Reference**: Supabase Project `wthabguvueewgtabjsdo` (`starqERP`, Seoul `ap-northeast-2`)  
**Google Cloud Project**: `starq-books` (Project Number: `901212915429`)  
**Document Owner**: Antigravity (Auth Infrastructure)  
**Consumer**: Qoder (Round 1 Foundation Remediation & Web Client Wiring)  
**Classification**: Public Architecture & Operational Specification (Zero Secrets Contained)  

---

## 1. Overview & Architecture

starqERP utilizes a defense-in-depth authentication model. The application supports Google Sign-In via Google Identity Services (GIS) and verifies identity tokens through the authoritative server-side Edge Function boundary (`starq-api`), while also accommodating Supabase Auth (GoTrue) OAuth callbacks.

### Dual-Layer Flow Diagram

```
[ User Browser ]
       │
       ├─ (1) Google Identity Services (GIS Popup / One Tap)
       │      Client-side prompt via Google SDK (accounts.google.com/gsi/client)
       │      Validates against Authorized JavaScript Origins
       │
       ▼ (2) Returns OpenID Connect ID Token (credential)
[ starqERP Web Client ]
       │
       ├─ (3) POST /api/auth/google
       │      Headers: 'x-starq-client-kind': 'web', 'Content-Type': 'application/json'
       │      Body: { credential: "<google_id_token>" }
       │
       ▼
[ starq-api Edge Function ] (Supabase Edge Gateway, verify_jwt = false)
       │
       ├─ (4) GET https://oauth2.googleapis.com/tokeninfo?id_token=<credential>
       │      Verifies signature, email_verified == true, audience matches STARQBOOKS_GOOGLE_CLIENT_ID
       │
       ├─ (5) Validates email against STARQBOOKS_ALLOWLIST_JSON
       │      Rejects unauthorized users with 400 'not_allowlisted'
       │
       ├─ (6) Resolves Person, Org & Seats in PostgreSQL
       │      Calls database upserts for persons, memberships, membership_seats
       │
       ├─ (7) Signs session with HMAC-SHA256 using STARQBOOKS_SESSION_SECRET
       │      Sets HttpOnly, Secure, SameSite=None session cookie: 'sb_ops'
       │      Generates cryptographically random CSRF token
       │
       ▼ (8) Returns HTTP 200 OK + UserSession DTO { user: { person_id, name, seats, acting_as, csrf, ... } }
[ starqERP Web Client ]
       │
       └─ Stores UserSession & CSRF in React state (AuthContext)
          Navigates to application dashboard ('/')
```

---

## 2. Google Cloud Platform Configuration

All Google OAuth credentials must reside within the canonical Google Cloud project to satisfy cross-client audience checks.

### Project Details
- **Project Name**: `Starq Books` (or `starqERP`)
- **Project ID**: `starq-books`
- **Project Number**: `901212915429`

> **Note on Project Alignment**: The Edge boundary (`check-reality.mjs`) asserts that Web and Android client IDs share the same GCP project number (`901212915429`). Do not create or link client IDs from foreign projects.

### OAuth Consent Screen
1. Navigate to: **Google Cloud Console** → **APIs & Services** → **OAuth consent screen**.
2. **User Type**:
   - **External**: Enables access for both Google Workspace and personal `@gmail.com` accounts specified in the tenant allowlist.
   - **Internal**: Optional if deployment is strictly restricted to an internal Google Workspace domain.
3. **App Information**:
   - **App name**: `starqERP`
   - **User support email**: Administrator / Founder email (e.g. `a.musthaq@gmail.com`)
   - **App logo**: Optional for development; standard 120x120px square icon for production.
4. **Authorized Domains**:
   - `starq.mv`
   - `supabase.co`
   - `vercel.app` (if preview/staging hosting uses Vercel)
5. **Developer Contact Information**:
   - Primary technical contact email (e.g. `a.musthaq@gmail.com`).
6. **Scopes**:
   Configure the minimal non-sensitive identity scopes:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   *(Do not request sensitive or restricted API scopes).*
7. **Publishing Status**:
   - **Testing**: Requires every developer, tester, and pilot user to be explicitly listed under **Test users**.
   - **In Production**: Removes the 100-test-user limit; users are still strictly constrained server-side by the backend allowlist.

### OAuth 2.0 Client ID (Web Application)
1. Navigate to: **Google Cloud Console** → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
2. **Application Type**: `Web application`
3. **Name**: `starqERP Web Client`
4. **Authorized JavaScript Origins**:
   Add every origin where the web client runs or will be hosted:
   - `http://localhost:3001` *(Default Vite development port in package.json)*
   - `http://localhost:5173` *(Standard Vite dev port fallback)*
   - `http://localhost:8080` *(Historical local preview / staging port)*
   - `https://erp.starq.mv` *(Canonical production origin per Founder Ruling #1475)*
   - `https://<project-deployment>.vercel.app` *(Preview/staging environments)*
5. **Authorized Redirect URIs**:
   Add the canonical callback endpoints:
   - `https://wthabguvueewgtabjsdo.supabase.co/auth/v1/callback` *(Supabase GoTrue OAuth callback)*
   - `http://localhost:3001/auth/callback` *(Local dev callback for authorization code flow)*
   - `http://localhost:5173/auth/callback` *(Local dev callback fallback)*
   - `https://erp.starq.mv/auth/callback` *(Production authorization code flow callback)*

---

## 3. Supabase Google Provider Configuration

The backend persistence and Edge functions are hosted on Supabase project `wthabguvueewgtabjsdo`.

### Project Reference
- **Project Ref**: `wthabguvueewgtabjsdo`
- **Region**: Northeast Asia (Seoul) (`ap-northeast-2`)
- **API URL**: `https://wthabguvueewgtabjsdo.supabase.co`
- **Edge API Base**: `https://wthabguvueewgtabjsdo.supabase.co/functions/v1/starq-api`

### Supabase Authentication Settings
1. Navigate to: **Supabase Dashboard** → **Authentication** → **Providers** → **Google**.
2. **Enable Google Provider**: Toggle **ON**.
3. **Client ID**: Paste the Web Client ID generated from GCP (`901212915429-*.apps.googleusercontent.com`).
4. **Client Secret**: Paste the Client Secret from GCP (stored securely in Supabase vault, never exposed to git or clients).
5. **Authorized Client IDs** (Optional): Add the Android release client ID (`901212915429-*.apps.googleusercontent.com`) to allow native mobile auth token verification.

### URL Configuration (Supabase Dashboard → Authentication → URL Configuration)
- **Site URL**: `https://erp.starq.mv` (Production) or `http://localhost:3001` (Development)
- **Redirect URLs (Allowlist)**:
  - `http://localhost:3001/**`
  - `http://localhost:5173/**`
  - `http://localhost:8080/**`
  - `https://erp.starq.mv/**`
  - `https://wthabguvueewgtabjsdo.supabase.co/auth/v1/callback`

---

## 4. Edge Function Environment & Secrets

The authoritative boundary `starq-api` is deployed with `verify_jwt = false` (as declared in `supabase/config.toml`) because it implements independent Google token validation, HMAC session signing, database authority verification, and CSRF protection.

### Edge Function Secrets Inventory
Manage secrets via `supabase secrets set <KEY>=<VALUE>`:

| Variable Name | Purpose | Example / Pattern | Sensitivity & Ownership |
|---|---|---|---|
| `STARQBOOKS_GOOGLE_CLIENT_ID` | Primary Web Google Client ID validated against token `aud` | `901212915429-xxxx.apps.googleusercontent.com` | Public Identifier |
| `STARQBOOKS_GOOGLE_ANDROID_CLIENT_ID` | Mobile Android Client ID for Flutter client | `901212915429-yyyy.apps.googleusercontent.com` | Public Identifier |
| `STARQBOOKS_ALLOWED_ORIGINS` | Comma-delimited list of CORS allowed web origins | `http://localhost:3001,http://localhost:5173,https://erp.starq.mv,https://starq.mv` | Configuration |
| `STARQBOOKS_ALLOW_PREVIEW_ORIGINS` | Explicit opt-in boolean (`true`/`false`) to allow `*.vercel.app` wildcard origins | `false` (default) | Configuration |
| `STARQ_ENV` / `ENVIRONMENT` | Runtime environment tier. Defaults fail-closed to production if unset. Explicitly set to `development`, `test`, or `local` to enable dev preview matching | `production` | Configuration |
| `STARQBOOKS_SESSION_SECRET` | 256-bit secret key for HMAC-SHA256 session cookie signing | High-entropy string (>= 32 chars) | **Backend-Only Secret** (Never exposed to Vite/browser/repo/logs per Founder Ruling #1475) |
| `STARQBOOKS_ALLOWLIST_JSON` | Authorized users, emails, seats, and tenant bindings | `{"people":[{"name":"...","email":"user@domain.com","seats":["counter"],"entities":["CI"]}]}` | Sensitive Access List |
| `SUPABASE_URL` | Supabase Postgres/REST gateway URL | `https://wthabguvueewgtabjsdo.supabase.co` | Platform Pre-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS within Edge functions for session checks (Legacy; migrating to Secret Keys) | Supabase Service Role JWT | **Confidential Secret** (Target of Secret-Key Modernization) |

### Secret Management & Rotation Cadence (Founder Ruling #1475)
1. **Scheduled Rotation**: Planned privileged-secret review and rotation every 90 days.
2. **Emergency Rotation**: Triggered immediately upon suspected exposure, access revocation, compromised developer account/device, or material security incident.
3. **Evidence Requirement**: Rotation evidence must document purpose, owner, date, trigger, affected service, and post-rotation smoke test verification. Secret values are never recorded in repository evidence.
4. **Modernization Path**: Transition from legacy `SUPABASE_SERVICE_ROLE_KEY` to Supabase Secret Keys as provider migration lands, preserving backend-only privileged-secret invariants.

---

## 5. Web Client Environment Variables

Client variables are injected at build time via Vite (`web/.env.local`). Never put secrets, service-role keys, or database connection strings in client environment files.

```env
# Google OAuth 2.0 Web Client ID
# Must match STARQBOOKS_GOOGLE_CLIENT_ID in Edge secrets and GCP Console
VITE_GOOGLE_CLIENT_ID="901212915429-<client_hash>.apps.googleusercontent.com"

# API Base URL (leave empty string if using Vite dev proxy /api)
# In standalone production without proxy: "https://wthabguvueewgtabjsdo.supabase.co/functions/v1/starq-api"
VITE_API_BASE_URL=""
```

---

## 6. Callback, Cookie, & Session Flow Mechanics

### 1. In-Page GIS Flow (Current Web Client)
- **Initiation**: The user clicks the button created by `google.accounts.id.renderButton()`.
- **Consent**: Google opens an in-page popup or iframe. The user selects their Google account.
- **Callback**: Google passes `{ credential: "<JWT_ID_TOKEN>" }` to the JavaScript callback function.
- **Backend Exchange**: Client sends `POST /api/auth/google` with payload `{"credential": "<JWT_ID_TOKEN>"}` and header `'x-starq-client-kind': 'web'`.
- **Response**: Server responds with 200 OK and `Set-Cookie: sb_ops=<payload>.<hmac>; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=None`.

### 2. Cookie Transport & Cross-Site Considerations
- The API is served from `https://wthabguvueewgtabjsdo.supabase.co` while the web client runs on `http://localhost:3001` or `https://erp.starq.mv`.
- Because this is a cross-site context:
  - `SameSite=None` and `Secure` are mandatory on the `sb_ops` cookie.
  - Every client `fetch()` call must specify `credentials: 'include'`.
  - The Edge function must respond with `Access-Control-Allow-Origin: <origin>` (matching `STARQBOOKS_ALLOWED_ORIGINS`) and `Access-Control-Allow-Credentials: true`.
  - In modern browsers, `localhost` is treated as a secure context even over HTTP, allowing `SameSite=None; Secure` cookies to be received and sent during local development.

### 3. CSRF Protection
- The session cookie `sb_ops` is `HttpOnly`; browser JavaScript cannot inspect or read it.
- To prevent cross-site request forgery, the Edge Function generates a random UUID CSRF token on login and seat changes.
- The server delivers the CSRF token in the JSON response payload (`user.csrf`).
- The web client must include this token in subsequent state-modifying requests (`POST /api/auth/logout`, `POST /api/auth/seat`, `POST /api/ops/event`) either via the `x-csrf-token` header or the `csrf` body property.

### 4. Logout Flow
- Web client calls `POST /api/auth/logout` with `{ csrf: session.csrf }` and `credentials: 'include'`.
- Edge Function validates CSRF against the session.
- Edge Function returns 200 OK and clears the cookie: `Set-Cookie: sb_ops=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`.
- Web client clears local authentication state and redirects to `/login`.

### 5. Failure & Cancellation Behaviors
- **User closes Google popup**: GIS callback does not fire or triggers a cancellation event. The client should gracefully reset loading spinners and remain on `/login`.
- **Non-allowlisted Google Account**: The Edge Function rejects the token with HTTP 400 and `{ ok: false, error: "not_allowlisted" }`. The UI should inform the user: *"Your Google account is not authorized to access starqERP. Please contact your organization administrator."*
- **Audience Mismatch**: If `x-starq-client-kind` is missing or the token was minted for a different OAuth client ID, the server rejects with 400 `'identity_audience_rejected'`.
- **Expired or Revoked Session**: Calling `/api/me` or `/api/ops/*` with an expired cookie or a seat revoked in PostgreSQL returns 401 `'unauthenticated'` along with an eviction cookie (`Max-Age=0`). The client redirects the user to `/login`.

---

## 7. Verification Procedure

Run the following verification steps to validate the end-to-end OAuth setup:

### Step 1: Backend & Edge Function Health
```bash
curl -i https://wthabguvueewgtabjsdo.supabase.co/functions/v1/starq-api/health
```
**Expected Response**:
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"ok":true,"service":"starqERP","api_version":"0.2.0","database":"ready"}
```

### Step 2: Secret & Audience Parity Check
Run the automated reality test suite:
```bash
node scripts/check-reality.mjs
```
Verify that:
- Seat occupancy passes.
- Required headers pass (`x-starq-client-kind`, `x-csrf-token`, `x-idempotency-key`).
- Gateway settings pass (`verify_jwt = false`).
- Cookie scope passes (`SameSite=None, HttpOnly, Secure`).

### Step 3: Interactive Login Verification
1. Start the web development server:
   ```bash
   cd web && npm run dev
   ```
2. Navigate to `http://localhost:3001/login`.
3. Verify that the Google Sign-In button renders without console errors.
4. Click "Sign in with Google" and authenticate with an allowlisted email.
5. In Browser DevTools (Network tab):
   - Check `POST /api/auth/google` request:
     - Request Header contains `'x-starq-client-kind': 'web'`.
     - Request Body contains `{"credential": "<jwt>"}`.
     - Response Status is `200 OK`.
     - Response Header contains `Set-Cookie: sb_ops=...; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=None`.
     - Response Body contains `{"ok": true, "user": { "person_id": "...", "csrf": "...", "seats": [...] }}`.
6. Verify browser navigates to `/` and AppShell displays the logged-in user's name and seat.

### Step 4: Session Persistence Across Refresh
1. Refresh the page (`F5`).
2. Verify network request `GET /api/me`:
   - Returns `200 OK` with the active user session.
   - Page remains on dashboard without redirecting back to `/login`.

### Step 5: Logout Verification
1. Click the user profile / logout button in AppShell.
2. Verify network request `POST /api/auth/logout`:
   - Header `x-csrf-token` or body `csrf` matches `session.csrf`.
   - Response sets `sb_ops=; Max-Age=0`.
3. Verify client navigates back to `/login`.

---

## 8. Actionable Integration Contract for Qoder

During review of the ongoing Round 1 remediation changes, the following 5 interface contracts must be strictly adhered to in `web/`:

### 1. Payload Property Name in `auth.ts`
- **Issue**: `web/src/services/auth.ts` currently sends `JSON.stringify({ token })`.
- **Requirement**: The Edge Function (`starq-api/index.ts` line 549) reads `body.credential`.
- **Contract**:
  ```ts
  // web/src/services/auth.ts
  export async function loginWithGoogle(credential: string): Promise<UserSession> {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-starq-client-kind': 'web',
      },
      body: JSON.stringify({ credential }),
    });
    ...
  }
  ```

### 2. Platform Client-Kind Header
- **Issue**: Missing `'x-starq-client-kind'` causes the server to reject tokens with `identity_audience_rejected`.
- **Contract**: Always send `'x-starq-client-kind': 'web'` on `POST /api/auth/google`.

### 3. Google Identity Services Script in `index.html`
- **Issue**: `web/src/app/LoginPage.tsx` expects `window.google.accounts.id`, but the GIS client library is not loaded.
- **Contract**: Add the Google Identity script to `web/index.html` inside `<head>`:
  ```html
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  ```

### 4. CSRF Token Source
- **Issue**: `auth.ts` attempts to parse `document.cookie.match(/sb_ops_csrf=([^;]+)/)`. Because `sb_ops` is `HttpOnly`, `document.cookie` cannot read session tokens.
- **Contract**: Retrieve `csrf` from `userSession.csrf` provided by the server in `loginWithGoogle` and `fetchCurrentUser`, and send it via `x-csrf-token` header or `{ csrf }` body.

### 5. Vite Development Proxy
- **Issue**: Direct calls to `/api/...` in local development fail with 404 unless proxied to the Edge Function.
- **Contract**: Configure `web/vite.config.ts` with a development proxy:
  ```ts
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'https://wthabguvueewgtabjsdo.supabase.co/functions/v1/starq-api',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  ```
