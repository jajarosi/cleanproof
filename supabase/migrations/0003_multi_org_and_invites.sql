-- =====================================================================
-- Une personne peut travailler pour plusieurs entreprises (adhésions)
-- + liens d'invitation avec validation par le patron
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- 1. Adhésions ----------
create type public.membership_status as enum ('pending', 'active', 'disabled');

create table public.memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.user_role not null default 'cleaner',
  status public.membership_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);
create index on public.memberships (org_id, status);

-- Reprise des données existantes
insert into public.memberships (user_id, org_id, role, status)
select id, org_id, role,
       (case when active then 'active' else 'disabled' end)::public.membership_status
  from public.profiles;

-- ---------- 2. Invitations ----------
alter table public.organizations
  add column invite_token text unique,
  add column invite_expires_at timestamptz,
  add column require_approval boolean not null default true;

-- ---------- 3. Suppression de l'ancien modèle "1 personne = 1 entreprise" ----------
drop policy if exists org_select on public.organizations;
drop policy if exists org_update on public.organizations;
drop policy if exists profiles_select on public.profiles;
drop policy if exists apartments_select on public.apartments;
drop policy if exists apartments_admin_insert on public.apartments;
drop policy if exists apartments_admin_update on public.apartments;
drop policy if exists apartments_admin_delete on public.apartments;
drop policy if exists cleanings_select on public.cleanings;
drop policy if exists photos_select on public.cleaning_photos;
drop policy if exists photos_upload on storage.objects;
drop policy if exists photos_read on storage.objects;

drop function if exists public.auth_org_id();
drop function if exists public.auth_is_admin();

drop index if exists public.profiles_org_login_key;
alter table public.profiles
  drop column org_id,
  drop column role,
  drop column active;

-- ---------- 4. Helpers ----------
create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
     where user_id = auth.uid() and org_id = p_org and status = 'active'
  )
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
     where user_id = auth.uid() and org_id = p_org and status = 'active' and role = 'admin'
  )
$$;

-- Vrai si l'utilisateur connecté et p_user ont une entreprise en commun
-- (le patron voit aussi les demandes en attente)
create or replace function public.shares_org(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.memberships me
      join public.memberships other on other.org_id = me.org_id
     where me.user_id = auth.uid() and me.status = 'active'
       and other.user_id = p_user
       and (other.status = 'active' or me.role = 'admin')
  )
$$;

revoke execute on function public.is_member(uuid)    from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
revoke execute on function public.shares_org(uuid)   from public, anon;
grant  execute on function public.is_member(uuid)    to authenticated;
grant  execute on function public.is_org_admin(uuid) to authenticated;
grant  execute on function public.shares_org(uuid)   to authenticated;

-- ---------- 5. RLS ----------
alter table public.memberships enable row level security;

create policy org_select on public.organizations for select using (public.is_member(id));
create policy org_update on public.organizations for update
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_org(id));

create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or public.is_org_admin(org_id));
-- écriture des adhésions : uniquement côté serveur (service role)

create policy apartments_select on public.apartments for select using (public.is_member(org_id));
create policy apartments_admin_insert on public.apartments for insert with check (public.is_org_admin(org_id));
create policy apartments_admin_update on public.apartments for update
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy apartments_admin_delete on public.apartments for delete using (public.is_org_admin(org_id));

create policy cleanings_select on public.cleanings for select
  using (public.is_org_admin(org_id) or (cleaner_id = auth.uid() and public.is_member(org_id)));

create policy photos_select on public.cleaning_photos for select
  using (
    public.is_org_admin(org_id)
    or (public.is_member(org_id)
        and exists (select 1 from public.cleanings c where c.id = cleaning_id and c.cleaner_id = auth.uid()))
  );

-- ---------- 6. Fonctions métier ----------
create or replace function public.start_cleaning(p_apartment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_apt public.apartments;
  v_id uuid;
begin
  select * into v_apt from public.apartments where id = p_apartment_id for update;
  if not found or not public.is_member(v_apt.org_id) then raise exception 'apartment_not_found'; end if;
  if v_apt.status = 'in_progress' then raise exception 'already_in_progress'; end if;

  insert into public.cleanings (org_id, apartment_id, cleaner_id)
  values (v_apt.org_id, p_apartment_id, auth.uid())
  returning id into v_id;

  update public.apartments set status = 'in_progress' where id = p_apartment_id;
  return v_id;
end $$;

create or replace function public.add_cleaning_photo(p_cleaning_id uuid, p_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_c public.cleanings;
  v_id uuid;
begin
  select * into v_c from public.cleanings
   where id = p_cleaning_id and cleaner_id = auth.uid() and status = 'in_progress';
  if not found or not public.is_member(v_c.org_id) then raise exception 'cleaning_not_found'; end if;
  if p_path not like v_c.org_id::text || '/' || v_c.id::text || '/%' then
    raise exception 'invalid_path';
  end if;

  insert into public.cleaning_photos (org_id, cleaning_id, storage_path)
  values (v_c.org_id, v_c.id, p_path)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.finish_cleaning(p_cleaning_id uuid, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c public.cleanings;
  v_min int;
  v_count int;
begin
  select * into v_c from public.cleanings
   where id = p_cleaning_id and cleaner_id = auth.uid() and status = 'in_progress'
   for update;
  if not found or not public.is_member(v_c.org_id) then raise exception 'cleaning_not_found'; end if;

  select min_photos into v_min from public.organizations where id = v_c.org_id;
  select count(*) into v_count from public.cleaning_photos where cleaning_id = v_c.id;
  if v_count < v_min then raise exception 'not_enough_photos'; end if;

  update public.cleanings
     set status = 'done', finished_at = now(), comment = nullif(trim(p_comment), '')
   where id = v_c.id;
  update public.apartments set status = 'clean' where id = v_c.apartment_id;
end $$;

create or replace function public.cancel_cleaning(p_cleaning_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c public.cleanings;
begin
  select * into v_c from public.cleanings
   where id = p_cleaning_id and status = 'in_progress'
   for update;
  if not found
     or not ((v_c.cleaner_id = auth.uid() and public.is_member(v_c.org_id)) or public.is_org_admin(v_c.org_id))
  then
    raise exception 'cleaning_not_found';
  end if;

  update public.cleanings set status = 'cancelled', finished_at = now() where id = v_c.id;
  update public.apartments set status = 'dirty' where id = v_c.apartment_id;
end $$;

-- ---------- 7. Stockage des photos ----------
-- Chemin : <org_id>/<cleaning_id>/<fichier>.jpg
create policy photos_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.cleanings c
       where c.id::text = (storage.foldername(name))[2]
         and c.org_id::text = (storage.foldername(name))[1]
         and c.cleaner_id = auth.uid()
         and c.status = 'in_progress'
         and public.is_member(c.org_id)
    )
  );

create policy photos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.cleanings c
       where c.id::text = (storage.foldername(name))[2]
         and c.org_id::text = (storage.foldername(name))[1]
         and (public.is_org_admin(c.org_id) or (c.cleaner_id = auth.uid() and public.is_member(c.org_id)))
    )
  );
