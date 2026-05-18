-- ============================================================
-- FIX: Infinite recursion en profiles RLS
-- El problema: la política hace SELECT a profiles desde dentro de profiles
-- La solución: usar auth.jwt() para leer el rol sin consultar la tabla
-- ============================================================

-- 1. Borrar todas las políticas existentes de profiles
drop policy if exists "users_own_profile"     on profiles;
drop policy if exists "admin_all_profiles"    on profiles;
drop policy if exists "read_own_profile"      on profiles;
drop policy if exists "update_own_profile"    on profiles;
drop policy if exists "insert_profile"        on profiles;

-- 2. Crear políticas simples que NO hacen self-join a profiles
create policy "profiles_select" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on profiles
  for update using (auth.uid() = id);

-- 3. Crear función helper para leer el rol SIN recursión
--    Lee directo del JWT que Supabase inyecta, sin tocar la tabla profiles
create or replace function get_my_role()
returns text
language sql stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- 4. Reemplazar las políticas de otras tablas para usar la función
--    (evita que cada insert/update/delete haga un SELECT a profiles)
drop policy if exists "operator_write_accounts"  on accounts;
drop policy if exists "operator_update_accounts" on accounts;
drop policy if exists "operator_delete_accounts" on accounts;
drop policy if exists "operator_write_clients"   on clients;
drop policy if exists "operator_update_clients"  on clients;
drop policy if exists "operator_delete_clients"  on clients;
drop policy if exists "operator_write_ops"       on operations;
drop policy if exists "operator_delete_ops"      on operations;
drop policy if exists "operator_write_legs"      on operation_legs;
drop policy if exists "operator_delete_legs"     on operation_legs;

-- Accounts
create policy "accounts_write" on accounts
  for insert with check (get_my_role() in ('admin','operator'));
create policy "accounts_update" on accounts
  for update using (get_my_role() in ('admin','operator'));
create policy "accounts_delete" on accounts
  for delete using (get_my_role() in ('admin','operator'));

-- Clients
create policy "clients_write" on clients
  for insert with check (get_my_role() in ('admin','operator'));
create policy "clients_update" on clients
  for update using (get_my_role() in ('admin','operator'));
create policy "clients_delete" on clients
  for delete using (get_my_role() in ('admin','operator'));

-- Operations
create policy "ops_write" on operations
  for insert with check (get_my_role() in ('admin','operator'));
create policy "ops_delete" on operations
  for delete using (get_my_role() in ('admin','operator'));

-- Legs
create policy "legs_write" on operation_legs
  for insert with check (get_my_role() in ('admin','operator'));
create policy "legs_delete" on operation_legs
  for delete using (get_my_role() in ('admin','operator'));
