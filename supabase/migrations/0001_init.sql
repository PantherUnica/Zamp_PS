-- Zamp PS-2 Vendor Onboarding: schema
-- Apply with `npm run db:migrate` (uses SUPABASE_DB_URL) or paste into the Supabase SQL editor.
-- Idempotent: safe to run more than once.

create extension if not exists pgcrypto;

create sequence if not exists submission_ref_seq start 1;

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('VND-' || lpad(nextval('submission_ref_seq')::text, 4, '0')),
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'draft'
    check (status in ('draft','processing','awaiting_vendor','awaiting_review','approved','rejected','error')),
  recommendation text check (recommendation in ('approve','pending','reject')),
  legal_name text not null,
  country text not null,
  tax_id text not null,          -- normalised (uppercase, no separators) for duplicate detection
  bank_account text,             -- normalised IBAN or "IFSC/routing:account" for duplicate detection
  contact_email text not null,
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  version int not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (submission_id, version)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  version int not null,
  slot text not null check (slot in ('tax_certificate','bank_proof','incorporation_certificate')),
  file_name text not null,
  mime_type text not null,
  size_bytes int not null,
  storage_path text not null unique,
  uploaded boolean not null default false,
  superseded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists documents_submission_idx on documents(submission_id);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  version int not null,
  trigger text not null check (trigger in ('submission','resubmission','reprocess')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  recommendation text check (recommendation in ('approve','pending','reject')),
  result jsonb,
  error text,
  model text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists runs_submission_idx on runs(submission_id, created_at desc);
create index if not exists runs_created_idx on runs(created_at desc);

create table if not exists run_stages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  key text not null,
  label text not null,
  position int not null,
  status text not null default 'pending'
    check (status in ('pending','running','passed','warning','failed','skipped','error')),
  summary text,
  output jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  unique (run_id, key)
);

create table if not exists info_requests (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  items jsonb not null,
  message text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_by text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists info_requests_submission_idx on info_requests(submission_id);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  actor_type text not null check (actor_type in ('vendor','system','reviewer')),
  actor_email text,
  action text not null,
  note text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_submission_idx on events(submission_id, created_at);

-- Row level security: on everywhere. The browser never talks to these tables directly;
-- all reads/writes go through server routes using the service role after an auth/token check.
alter table submissions enable row level security;
alter table submission_versions enable row level security;
alter table documents enable row level security;
alter table runs enable row level security;
alter table run_stages enable row level security;
alter table info_requests enable row level security;
alter table events enable row level security;

-- Private storage bucket for vendor documents (10 MB per file, PDF/PNG/JPEG only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-documents', 'vendor-documents', false, 10485760,
        array['application/pdf','image/png','image/jpeg'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
