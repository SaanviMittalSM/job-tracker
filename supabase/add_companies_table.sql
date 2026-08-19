-- Adds a canonical, shared `companies` table so the company list itself can grow
-- over time (via the discovery routine) instead of being hardcoded in the app.
create table if not exists companies (
  company text primary key,
  category text not null default 'Other',
  portal_url text,
  role_hint text not null default 'SDE Intern / New Grad',
  added_source text not null default 'seed', -- 'seed' | 'discovery' | 'manual'
  added_at timestamptz not null default now()
);

alter table companies enable row level security;

create policy "companies are publicly readable"
  on companies for select
  using (true);

-- Anyone holding the anon key (which is meant to be public) can propose a new
-- company — low-sensitivity data, worst case is easily-cleaned-up junk rows.
-- This lets the scheduled discovery routine write using only the safe anon key,
-- no service_role secret ever needs to leave this machine.
create policy "anyone can add a company"
  on companies for insert
  with check (true);
