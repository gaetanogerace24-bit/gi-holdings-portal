-- G&I Holdings Portal — Supabase Database Schema
-- Run this entire file in Supabase SQL Editor

-- ─── TENANTS ────────────────────────────────────────────────
create table if not exists tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text,
  phone text,
  unit text,
  address text,
  rent numeric default 0,
  deposit numeric default 0,
  paid boolean default false,
  paid_date text,
  amount_owed numeric default 0,
  override_late numeric,
  section8 boolean default false,
  section8_amount numeric default 0,
  tenant_portion numeric default 0,
  housing_owed_back numeric default 0,
  lease_start text,
  lease_end text,
  notes text,
  landlord text default 'G&I Holdings LLC',
  emergency text default '(330) 969-6464',
  contact_email text default 'tenants@giholdings.com',
  documents jsonb default '[]',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- ─── TICKETS ────────────────────────────────────────────────
create table if not exists tickets (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  tenant_name text,
  unit text,
  title text not null,
  description text,
  category text default 'General',
  urgency text default 'medium' check (urgency in ('low', 'medium', 'high')),
  status text default 'open' check (status in ('open', 'in-progress', 'resolved')),
  date text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- ─── SETTINGS ───────────────────────────────────────────────
create table if not exists settings (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value jsonb,
  updated_at timestamp default now()
);

-- ─── MESSAGES ───────────────────────────────────────────────
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  to_name text,
  tenant_id uuid,
  message text,
  date text,
  created_at timestamp default now()
);

-- ─── PAYMENTS ───────────────────────────────────────────────
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references tenants(id),
  tenant_name text,
  amount numeric,
  method text,
  stripe_payment_intent text,
  status text default 'completed',
  paid_date text,
  created_at timestamp default now()
);

-- ─── ROW LEVEL SECURITY (allow all for now, lock down later) ─
alter table tenants enable row level security;
alter table tickets enable row level security;
alter table settings enable row level security;
alter table messages enable row level security;
alter table payments enable row level security;

-- Allow all operations (we'll add auth later)
create policy "Allow all tenants" on tenants for all using (true) with check (true);
create policy "Allow all tickets" on tickets for all using (true) with check (true);
create policy "Allow all settings" on settings for all using (true) with check (true);
create policy "Allow all messages" on messages for all using (true) with check (true);
create policy "Allow all payments" on payments for all using (true) with check (true);

-- ─── SEED INITIAL TENANTS ───────────────────────────────────
insert into tenants (name, address, rent, deposit, paid, override_late, notes, emergency, contact_email, section8, section8_amount, tenant_portion, housing_owed_back)
values
  ('Gary Thornton', '510 W Evergreen Ave, Youngstown OH 44511', 900, 850, false, 285, 'April rent unpaid — $900 rent + $285 late fees = $1,185 total owed.', '(330) 969-6464', 'tenants@giholdings.com', false, 0, 0, 0),
  ('Angelisa Pate', '3646 Beechwood Pl, Youngstown OH 44502', 1275, 1275, false, null, '⚠️ Housing authority owes $1,014 for APRIL (unpaid). May check expected May 1st. Angelisa portion: $261/mo.', '(330) 969-6464', 'tenants@giholdings.com', true, 1014, 261, 1014),
  ('Danielle Russell', '3138 Idlewood Ave, Youngstown OH 44511', 1100, 1100, true, null, '', '(330) 969-6464', 'tenants@giholdings.com', false, 0, 0, 0)
on conflict do nothing;
