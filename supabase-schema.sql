-- ============================================================
-- SATO TREASURY — Supabase Schema
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor
-- ============================================================

-- ROLES
create type user_role as enum ('admin', 'operator', 'viewer');

-- USER PROFILES (extends Supabase auth.users)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        user_role not null default 'operator',
  created_at  timestamptz default now()
);

-- ACCOUNTS (cajas, bancos, wallets, brokers)
create table accounts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null check (type in ('Efectivo','Banco','Wallet Crypto','Broker/Plataforma')),
  currency     text not null,
  titular      text,
  opening_bal  numeric default 0,
  created_at   timestamptz default now()
);

-- CLIENTS
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  notes       text,
  created_at  timestamptz default now()
);

-- OPERATIONS (header)
create table operations (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  detail       text,
  mode         text not null check (mode in ('exchange','credit_out','credit_in','transfer')),
  client_id    uuid references clients(id),
  client_name  text,
  rate         numeric,
  profit       numeric,
  is_reversal  boolean default false,
  created_by   uuid references auth.users(id)
);

-- OPERATION LEGS (double-entry entries)
create table operation_legs (
  id           uuid primary key default gen_random_uuid(),
  operation_id uuid not null references operations(id) on delete cascade,
  kind         text not null check (kind in ('account','credit')),
  -- for kind='account'
  account_id   uuid references accounts(id),
  -- for kind='credit'
  client_id    uuid references clients(id),
  client_name  text,
  currency     text not null,
  delta        numeric not null   -- positive = in, negative = out
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles        enable row level security;
alter table accounts        enable row level security;
alter table clients         enable row level security;
alter table operations      enable row level security;
alter table operation_legs  enable row level security;

-- Profiles: each user sees/edits only their own profile
--           admins see all
create policy "users_own_profile" on profiles
  for all using (auth.uid() = id);

create policy "admin_all_profiles" on profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Accounts, clients, ops, legs: all authenticated users can read
-- Only admins and operators can write
create policy "auth_read_accounts" on accounts
  for select using (auth.role() = 'authenticated');

create policy "operator_write_accounts" on accounts
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator'))
  );

create policy "operator_update_accounts" on accounts
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator'))
  );

create policy "auth_read_clients" on clients
  for select using (auth.role() = 'authenticated');

create policy "operator_write_clients" on clients
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator'))
  );

create policy "auth_read_ops" on operations
  for select using (auth.role() = 'authenticated');

create policy "operator_write_ops" on operations
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator'))
  );

-- Viewers can NEVER insert/update/delete anything
-- (covered by the above — no insert policy matches 'viewer')

create policy "auth_read_legs" on operation_legs
  for select using (auth.role() = 'authenticated');

create policy "operator_write_legs" on operation_legs
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator'))
  );

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    'operator'  -- default role; admin lo cambia manualmente
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Account current balance (opening + movements)
create view account_balances as
  select
    a.id,
    a.name,
    a.type,
    a.currency,
    a.titular,
    a.opening_bal,
    coalesce(sum(ol.delta), 0) as movements,
    a.opening_bal + coalesce(sum(ol.delta), 0) as balance
  from accounts a
  left join operation_legs ol
    on ol.account_id = a.id and ol.kind = 'account'
  group by a.id;

-- Client credit balances (positive = they owe us)
create view client_credit_balances as
  select
    c.id as client_id,
    c.name as client_name,
    ol.currency,
    sum(ol.delta) as balance
  from clients c
  join operation_legs ol on ol.client_id = c.id and ol.kind = 'credit'
  group by c.id, c.name, ol.currency
  having sum(ol.delta) != 0;

-- ============================================================
-- PATCH: Políticas para UPDATE y DELETE (ejecutar si no existen)
-- ============================================================

-- Accounts
create policy "operator_update_accounts" on accounts
  for update using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator')));
create policy "operator_delete_accounts" on accounts
  for delete using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator')));

-- Clients
create policy "operator_update_clients" on clients
  for update using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator')));
create policy "operator_delete_clients" on clients
  for delete using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator')));

-- Operations
create policy "operator_delete_ops" on operations
  for delete using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator')));
create policy "operator_delete_legs" on operation_legs
  for delete using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','operator')));
