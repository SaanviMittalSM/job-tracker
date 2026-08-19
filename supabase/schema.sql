-- Job Application Tracker — Supabase schema
-- Run this once in Supabase Dashboard → SQL Editor → New query → paste → Run.

-- ============================================================
-- postings: PUBLIC job-listing data (titles/URLs/deadlines only,
-- nothing personal). Anyone can read; writes are restricted to the
-- service role (used by the daily discovery pipelines).
-- ============================================================
create table if not exists postings (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  category text not null default 'Other',
  title text not null,
  url text not null,
  deadline date,
  source text not null default 'unknown', -- 'greenhouse' | 'lever' | 'websearch' | 'manual'
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  unique (company, url)
);

alter table postings enable row level security;

create policy "postings are publicly readable"
  on postings for select
  using (true);

-- No update/delete policy for anon/authenticated — only the service role (used
-- server-side by the discovery pipelines) can modify existing rows. Signed-in
-- users CAN insert new postings (e.g. the "+ posting" manual-add button) — this
-- is non-sensitive public job-listing data, so crowd-sourced additions are fine.
create policy "authenticated users can add postings"
  on postings for insert
  to authenticated
  with check (true);

-- ============================================================
-- company_checks: records that a company WAS checked by a discovery pipeline,
-- even when zero postings were found — postings has no row to hang a
-- "checked, nothing open" timestamp on otherwise. Public read, service-role write.
-- ============================================================
create table if not exists company_checks (
  company text primary key,
  category text not null default 'Other',
  last_checked_at timestamptz not null default now(),
  source text not null default 'unknown'
);

alter table company_checks enable row level security;

create policy "company_checks are publicly readable"
  on company_checks for select
  using (true);

-- ============================================================
-- applications: PRIVATE per-user data (status, dates, alumni contact, notes).
-- Each row is only visible to the user who owns it.
-- ============================================================
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  category text not null default 'Other',
  role text not null default 'SDE Intern / New Grad',
  portal_url text,
  status text not null default 'Not Started',
  date_applied date,
  alumni_name text,
  outreach_status text not null default 'Not Started',
  outreach_date date,
  last_checked date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company)
);

alter table applications enable row level security;

create policy "users manage their own applications"
  on applications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger applications_set_updated_at
  before update on applications
  for each row execute function set_updated_at();

-- ============================================================
-- gmail_signals: PRIVATE per-user suggestions detected from Gmail
-- (e.g. "applied to Stripe on Aug 15"). Dashboard shows these as
-- one-click-confirm suggestions rather than silently overwriting status.
-- ============================================================
create table if not exists gmail_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  signal text not null, -- 'applied' | 'oa_assessment' | 'interview' | 'offer' | 'rejected' | 'other'
  signal_date date not null,
  subject text,
  sender text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table gmail_signals enable row level security;

create policy "users manage their own gmail signals"
  on gmail_signals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
