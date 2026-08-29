-- =========================================================
-- VETORA LIVE — production database schema (Supabase / Postgres)
-- =========================================================
-- Run this once in the Supabase SQL Editor (or via `supabase db push`)
-- on a brand-new Supabase project. Safe to re-run: uses IF NOT EXISTS
-- / CREATE OR REPLACE wherever possible.
--
-- Design notes:
--  - Staff/Admin authenticate with Supabase Auth (email+password) and
--    get a row in `profiles`. Row Level Security restricts all
--    clinical tables to authenticated staff/admin only.
--  - Patient owners NEVER get a Supabase Auth session. They reach a
--    patient only through a secret `access_token` embedded in the
--    link/QR code the clinic hands out. All owner reads/writes go
--    through the Next.js server (API routes) using the service-role
--    key, which looks up the token server-side and returns only that
--    one patient's data. This keeps owners structurally unable to
--    reach any other patient or the staff/admin views, even if RLS
--    had a bug — the anon key alone cannot read these tables at all.
-- =========================================================

-- pgcrypto gives us gen_random_bytes(), used below to mint the owner access_token.
create extension if not exists pgcrypto with schema extensions;

-- ---------- enums ----------
do $$ begin
  create type staff_role as enum ('ADMIN','VETERINER','TEKNISYEN','RESEPSIYON');
exception when duplicate_object then null; end $$;

do $$ begin
  create type patient_status as enum ('stable','improving','watch','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type record_type as enum (
    'vital','medication','blood','lab','feeding','excretion',
    'vomiting','vetcheck','surgery','photo','note','event'
  );
exception when duplicate_object then null; end $$;

-- 'event' covers quick timeline entries the owner cares about seeing live:
-- taken into / out of surgery, anesthesia given / recovered, status changes.
-- On an already-existing database this must be added separately (Postgres
-- won't let a brand-new enum value be used in the same transaction it was
-- added in), so it's also listed on its own in the "migrations for an
-- already-running project" block near the end of this file.

-- ---------- profiles (1 row per staff/admin auth user) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role staff_role not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- patients ----------
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null,
  breed text,
  sex text,
  age_years numeric,
  kennel_no text,
  status patient_status not null default 'stable',
  owner_name text not null,
  owner_phone text,
  owner_email text,
  admitted_at timestamptz not null default now(),
  discharged_at timestamptz,
  -- secret token used to build the owner link / QR code, e.g.
  -- https://<domain>/p/<access_token>. Rotate by generating a new one
  -- and re-issuing the link/QR when a patient is discharged & re-admitted.
  -- 'base64url' isn't a supported encode() target on Supabase's Postgres version,
  -- so build a URL-safe token by hand: base64-encode, then swap the two
  -- non-URL-safe characters and drop the '=' padding.
  access_token text not null unique default rtrim(translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_'), '='),
  access_token_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists patients_status_idx on patients(status);
create index if not exists patients_access_token_idx on patients(access_token);

-- ---------- records (unified clinical timeline, mirrors the prototype's RECORD_TYPES) ----------
create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  type record_type not null,
  -- flexible per-type fields, e.g.
  --   vital:    {"temp_c":38.5,"pulse_bpm":96,"resp_rpm":22,"note":"..."}
  --   surgery:  {"procedure":"...","surgeon":"...","anesthesia":"...","duration_min":45,"outcome":"...","postop_note":"..."}
  --   photo:    {"storage_path":"patient-photos/<patient_id>/<file>.jpg","caption":"..."}
  --   lab:      {"test_name":"...","result":"...","unit":"...","reference_range":"...","approved":false}
  payload jsonb not null default '{}'::jsonb,
  visible_to_owner boolean not null default true,
  status_after patient_status,               -- optional: patient status set at the time of this entry
  created_by uuid references profiles(id),
  created_by_name text not null,             -- denormalized snapshot for display even if the staff account is later removed
  created_at timestamptz not null default now()
);
create index if not exists records_patient_idx on records(patient_id, created_at desc);
create index if not exists records_type_idx on records(type);

-- ---------- messages (owner <-> staff, mirrors WhatsApp-forwarded chat) ----------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  sender_type text not null check (sender_type in ('owner','staff')),
  sender_profile_id uuid references profiles(id),
  sender_name text not null,
  body text not null,
  whatsapp_forwarded boolean not null default false,
  whatsapp_message_id text,
  whatsapp_error text,
  created_at timestamptz not null default now()
);
create index if not exists messages_patient_idx on messages(patient_id, created_at);

-- ---------- daily tasks (Bugün Yapılması Gerekenler) ----------
create table if not exists daily_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  due_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists daily_tasks_patient_idx on daily_tasks(patient_id, due_date);

-- ---------- audit log ----------
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id),
  actor_name text not null,
  action text not null,
  -- on delete set null (not the default RESTRICT): deleting a patient must
  -- never be blocked by its own audit trail — the log entry survives with
  -- patient_id cleared, since `detail` already carries the patient's name.
  patient_id uuid references patients(id) on delete set null,
  detail text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table profiles enable row level security;
alter table patients enable row level security;
alter table records enable row level security;
alter table messages enable row level security;
alter table daily_tasks enable row level security;
alter table audit_log enable row level security;

-- helper: is the current authenticated user a known staff/admin profile?
create or replace function is_staff()
returns boolean
language sql stable security definer
as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

-- profiles: any authenticated staff member can see all staff (for the "Personel" admin
-- screen and record "created by" pickers); a user can always see their own row.
create policy profiles_select_staff on profiles for select
  using (is_staff());
-- inserts/updates to profiles are done by the server using the service-role key
-- (e.g. when an admin invites a new staff member) — no client-side insert/update policy.

-- patients: staff/admin only. Owners never get a Supabase session, so they simply
-- have no policy that grants them access — the anon key cannot read this table.
create policy patients_all_staff on patients for select using (is_staff());
create policy patients_insert_staff on patients for insert with check (is_staff());
create policy patients_update_staff on patients for update using (is_staff());

create policy records_all_staff on records for select using (is_staff());
create policy records_insert_staff on records for insert with check (is_staff());
create policy records_update_staff on records for update using (is_staff());

create policy messages_all_staff on messages for select using (is_staff());
create policy messages_insert_staff on messages for insert with check (is_staff());

create policy daily_tasks_all_staff on daily_tasks for select using (is_staff());
create policy daily_tasks_update_staff on daily_tasks for update using (is_staff());
create policy daily_tasks_insert_staff on daily_tasks for insert with check (is_staff());

create policy audit_log_select_staff on audit_log for select using (is_staff());
create policy audit_log_insert_staff on audit_log for insert with check (is_staff());

-- =========================================================
-- Storage bucket for patient photos (private; served via signed URLs)
-- =========================================================
insert into storage.buckets (id, name, public)
  values ('patient-photos','patient-photos', false)
  on conflict (id) do nothing;

create policy patient_photos_staff_read on storage.objects for select
  using (bucket_id = 'patient-photos' and is_staff());
create policy patient_photos_staff_write on storage.objects for insert
  with check (bucket_id = 'patient-photos' and is_staff());

-- Owners never get direct Storage access either — the server mints a short-lived
-- signed URL for each photo when it serves the owner view (see lib/owner.ts).

-- =========================================================
-- Seed one admin profile placeholder (optional)
-- =========================================================
-- After creating your first user in Supabase Auth (Dashboard → Authentication →
-- Add user), run:
--   insert into profiles (id, full_name, role, email)
--   values ('<the-user-uuid-from-auth>', 'Can Öztürk', 'ADMIN', 'can.ozturk@vetora.com');

-- =========================================================
-- Migrations for a project that already ran an earlier version of this
-- file (run each block as its own separate query in the SQL Editor —
-- ALTER TYPE ... ADD VALUE must not share a query with statements that
-- use the new value):
-- =========================================================
--
--   alter type record_type add value if not exists 'event';
--
--   alter table audit_log drop constraint if exists audit_log_patient_id_fkey;
--   alter table audit_log add constraint audit_log_patient_id_fkey
--     foreign key (patient_id) references patients(id) on delete set null;
--
--   alter type patient_status add value if not exists 'improving';
