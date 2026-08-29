# Vetora Live — production app

Real, deployable rebuild of the Vetora Live prototype: Next.js 14 (App
Router) + Supabase (Postgres, Auth, Storage) + Meta WhatsApp Cloud API.

Not a demo — this is a real, working codebase (`npm run build` passes clean).
What it's missing is *your* infrastructure accounts, because those can't be
created on your behalf. **Start with `SETUP.md`** — it's a step-by-step
checklist for the accounts you need (Supabase, Vercel, WhatsApp Business) and
exactly what to hand back so the app goes live.

## What's implemented

- Separate staff / admin / patient-owner entry points, enforced by real
  Supabase Auth + Row Level Security (`supabase/schema.sql`) — not the
  hardcoded demo passwords from the prototype.
- Patient owners never get a login. They reach their patient only through a
  secret link/token (`/p/<access_token>`), resolved server-side — the
  browser never gets direct database or storage access.
- Vital signs, surgery records, notes, and real photo uploads (Supabase
  Storage, served via short-lived signed URLs).
- Owner's journal view polls for updates every 5s, so a photo or note a
  staff member adds appears within seconds — no page reload.
- Owner messages are inserted immediately, then forwarded as a real,
  automatic WhatsApp message to the clinic's number via the Meta WhatsApp
  Cloud API (`lib/whatsapp.ts`) — not a `wa.me` link someone has to tap.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values, see SETUP.md
npm run dev
```

## Project layout

```
app/
  login/              staff & admin login (Supabase Auth)
  dashboard/          staff home
  admin/              admin overview
  patients/[id]/      patient detail + add-record forms
  p/[token]/          owner view (no auth — token-gated)
  api/whatsapp/       WhatsApp webhook (delivery status / verification)
  api/owner/[token]/  polling endpoint behind the owner live-feed
lib/
  supabase/           browser / server / admin (service-role) clients
  actions/            server actions (records, owner messages, auth)
  whatsapp.ts         Cloud API sender (free-form + template)
  owner.ts            token → patient lookup, the one owner-access chokepoint
supabase/schema.sql   full DB schema + RLS policies + storage bucket
```
