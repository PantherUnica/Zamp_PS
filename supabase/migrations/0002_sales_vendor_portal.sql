-- Zamp PS-2 v2: staff roles, vendor records, magic-link portal with drafts, call transcripts,
-- tasks and an email outbox. Run AFTER 0001_init.sql. Idempotent: safe to run more than once.
-- Paste into Supabase → SQL Editor → Run, or `npm run db:migrate`.

-- ---------------------------------------------------------------- staff profiles and roles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'sales' check (role in ('sales','reviewer','admin')),
  created_at timestamptz not null default now()
);

-- Everyone who already has a login keeps full access (they set this project up).
insert into profiles (id, email, full_name, role)
select id, email, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 'admin'
from auth.users
on conflict (id) do nothing;

-- New users get a profile automatically. Role comes from app_metadata (only settable by the
-- service role / admins), never from user-editable metadata. Default: salesperson.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when new.raw_app_meta_data->>'role' in ('sales','reviewer','admin') then new.raw_app_meta_data->>'role' else 'sales' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- vendors (leads)
create sequence if not exists vendor_ref_seq start 1;

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('VEN-' || lpad(nextval('vendor_ref_seq')::text, 4, '0')),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  city text,
  supplies text,
  source text,
  notes text,
  prefill jsonb not null default '{}'::jsonb,   -- details captured by sales (e.g. from calls) to pre-fill the vendor form
  owner_id uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendors_owner_idx on vendors(owner_id);

-- ---------------------------------------------------------------- submissions: magic link + drafts
alter table submissions add column if not exists vendor_id uuid references vendors(id) on delete cascade;
create unique index if not exists submissions_vendor_uidx on submissions(vendor_id) where vendor_id is not null;
alter table submissions add column if not exists draft_data jsonb;
alter table submissions add column if not exists draft_saved_at timestamptz;
alter table submissions add column if not exists link_expires_at timestamptz;
alter table submissions add column if not exists link_sent_at timestamptz;
alter table submissions add column if not exists submitted_at timestamptz;
alter table submissions add column if not exists pan text;
alter table submissions alter column tax_id drop not null;
alter table submissions alter column country set default 'IN';

-- ---------------------------------------------------------------- documents: Indian document slots
alter table documents drop constraint if exists documents_slot_check;
alter table documents add constraint documents_slot_check check (slot in (
  'gst_certificate','pan_card','bank_proof','incorporation_certificate','msme_certificate',
  'tax_certificate'  -- legacy
));

-- ---------------------------------------------------------------- info requests can be drafts
alter table info_requests drop constraint if exists info_requests_status_check;
alter table info_requests add constraint info_requests_status_check check (status in ('draft','open','resolved'));

-- ---------------------------------------------------------------- audit events: vendor-level, staff/agent actors
alter table events alter column submission_id drop not null;
alter table events add column if not exists vendor_id uuid references vendors(id) on delete cascade;
alter table events drop constraint if exists events_actor_type_check;
alter table events add constraint events_actor_type_check check (actor_type in ('vendor','system','agent','staff','reviewer'));
create index if not exists events_vendor_idx on events(vendor_id, created_at);

-- ---------------------------------------------------------------- email outbox (every email, with delivery status)
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  submission_id uuid references submissions(id) on delete set null,
  info_request_id uuid references info_requests(id) on delete set null,
  kind text not null check (kind in (
    'invite','submission_received','correction_request','decision_approved','decision_rejected',
    'staff_vendor_submitted','staff_action_needed','teammate_invite','custom'
  )),
  audience text not null check (audience in ('vendor','staff')),
  to_email text not null,
  cc text,
  subject text not null,
  body_text text not null,
  cta_label text,
  cta_url text,
  status text not null default 'draft' check (status in ('draft','sending','sent','failed','discarded')),
  generated_by text not null default 'system' check (generated_by in ('system','agent','staff')),
  error text,
  provider_message_id text,
  attempts int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  sent_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists emails_vendor_idx on emails(vendor_id, created_at desc);
create index if not exists emails_status_idx on emails(status, created_at desc);

-- ---------------------------------------------------------------- call logs and transcript analysis
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete set null,
  logged_by uuid references profiles(id) on delete set null,
  title text not null,
  channel text not null default 'call' check (channel in ('call','video','meeting','other')),
  occurred_at timestamptz not null default now(),
  duration_minutes int,
  notes text,
  source_file text,
  transcript text not null,
  status text not null default 'analysing' check (status in ('analysing','done','failed')),
  analysis jsonb,
  error text,
  model text,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists calls_vendor_idx on calls(vendor_id, occurred_at desc);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  call_id uuid references calls(id) on delete set null,
  title text not null,
  owner text not null default 'us' check (owner in ('us','vendor')),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tasks_open_idx on tasks(done, due_date);

-- RLS on, no public policies: the browser never reads these tables directly.
alter table profiles enable row level security;
alter table vendors enable row level security;
alter table emails enable row level security;
alter table calls enable row level security;
alter table tasks enable row level security;

-- Vendor documents bucket also accepts images taken on a phone (PAN card / cheque photos).
update storage.buckets
set allowed_mime_types = array['application/pdf','image/png','image/jpeg']
where id = 'vendor-documents';
