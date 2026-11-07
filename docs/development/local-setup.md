# Local Development Setup Guide

Follow this guide to configure and run starqERP on your local development machine.

---

## 1. Prerequisites

- **Node.js**: v20.x or v22.x LTS ([Download](https://nodejs.org/))
- **npm**: v10.x+
- **Supabase CLI**: v2.100+ ([Installation Guide](https://supabase.com/docs/guides/cli))
- **Docker Desktop**: Required for local PostgreSQL database and Edge runtime emulation.

---

## 2. Installation & Workspace Setup

Clone the repository and install all web frontend dependencies:

```bash
# Clone the repository
git clone https://github.com/Starq-Technologies-Pvt-Ltd/starqERP.git
cd starqERP

# Install web dependencies
npm --prefix web install
```

---

## 3. Local Supabase Database & Edge Functions

Initialize and start the local Supabase stack:

```bash
# Start local Supabase containers (PostgreSQL, Storage, Auth, Edge Functions)
supabase start

# Reset database and apply all 25 versioned migrations
supabase db reset
```

The local Supabase dashboard will be available at `http://localhost:54323`.

---

## 4. Environment Configuration

Create a local environment configuration file:

```bash
cp web/.env.example web/.env.local
```

Set the local keys (available in output of `supabase status`):

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

---

## 5. Running the Web Application

Start the Vite development server:

```bash
npm --prefix web run dev
```

The starqERP web interface will launch at [http://localhost:3001](http://localhost:3001).
