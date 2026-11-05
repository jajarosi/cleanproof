-- =====================================================================
-- Cleaner — schéma initial (multi-entreprises)
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Types ----------
create type public.user_role as enum ('admin', 'cleaner');
create type public.apartment_status as enum ('dirty', 'in_progress', 'clean');
create type public.cleaning_status as enum ('in_progress', 'done', 'cancelled');

-- ---------- Tables ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_retention_days int not null default 365 check (photo_retention_days > 0),
  min_photos int not null default 3 check (min_photos >= 1),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.user_role not null default 'cleaner',
  full_name text not null,
  username text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.profiles (org_id);

create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  status public.apartment_status not null default 'dirty',
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table public.cleanings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  apartment_id uuid not null references public.apartments (id) on delete cascade,
  cleaner_id uuid not null references public.profiles (id),
  status public.cleaning_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  comment text
);
create index on public.cleanings (org_id, started_at desc);
create index on public.cleanings (apartment_id, started_at desc);
-- Un seul nettoyage en cours par appart
create unique index one_active_cleaning_per_apartment
  on public.cleanings (apartment_id) where status = 'in_progress';

create table public.cleaning_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  cleaning_id uuid not null references public.cleanings (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()  -- heure serveur = preuve
);
create index on public.cleaning_photos (cleaning_id);

-- ---------- Helpers ----------
create or replace function public.auth_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.auth_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active)
$$;

-- ---------- RLS ----------
alter table public.organizations   enable row level security;
alter table public.profiles        enable row level security;
alter table public.apartments      enable row level security;
alter table public.cleanings       enable row level security;
alter table public.cleaning_photos enable row level security;

create policy org_select on public.organizations for select using (id = public.auth_org_id());
create policy org_update on public.organizations for update
  using (id = public.auth_org_id() and public.auth_is_admin())
  with check (id = public.auth_org_id());

create policy profiles_select on public.profiles for select using (org_id = public.auth_org_id());
-- création / modification des comptes : uniquement côté serveur (service role)

create policy apartments_select on public.apartments for select using (org_id = public.auth_org_id());
create policy apartments_admin_insert on public.apartments for insert
  with check (org_id = public.auth_org_id() and public.auth_is_admin());
create policy apartments_admin_update on public.apartments for update
  using (org_id = public.auth_org_id() and public.auth_is_admin())
  with check (org_id = public.auth_org_id());
create policy apartments_admin_delete on public.apartments for delete
  using (org_id = public.auth_org_id() and public.auth_is_admin());

-- Nettoyages / photos : lecture seule ; l'écriture passe par les fonctions ci-dessous
-- (impossible de trafiquer les heures depuis le téléphone)
create policy cleanings_select on public.cleanings for select
  using (org_id = public.auth_org_id() and (public.auth_is_admin() or cleaner_id = auth.uid()));

create policy photos_select on public.cleaning_photos for select
  using (
    org_id = public.auth_org_id()
    and (public.auth_is_admin()
         or exists (select 1 from public.cleanings c where c.id = cleaning_id and c.cleaner_id = auth.uid()))
  );

-- ---------- Fonctions métier ----------
create or replace function public.start_cleaning(p_apartment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.auth_org_id();
  v_apt public.apartments;
  v_id uuid;
begin
  if v_org is null then raise exception 'not_authenticated'; end if;

  select * into v_apt from public.apartments
   where id = p_apartment_id and org_id = v_org for update;
  if not found then raise exception 'apartment_not_found'; end if;
  if v_apt.status = 'in_progress' then raise exception 'already_in_progress'; end if;

  insert into public.cleanings (org_id, apartment_id, cleaner_id)
  values (v_org, p_apartment_id, auth.uid())
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
  if not found then raise exception 'cleaning_not_found'; end if;
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
  if not found then raise exception 'cleaning_not_found'; end if;

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
     and (cleaner_id = auth.uid() or (public.auth_is_admin() and org_id = public.auth_org_id()))
   for update;
  if not found then raise exception 'cleaning_not_found'; end if;

  update public.cleanings set status = 'cancelled', finished_at = now() where id = v_c.id;
  update public.apartments set status = 'dirty' where id = v_c.apartment_id;
end $$;

revoke execute on function public.start_cleaning(uuid)            from public, anon;
revoke execute on function public.add_cleaning_photo(uuid, text)  from public, anon;
revoke execute on function public.finish_cleaning(uuid, text)     from public, anon;
revoke execute on function public.cancel_cleaning(uuid)           from public, anon;
grant  execute on function public.start_cleaning(uuid)            to authenticated;
grant  execute on function public.add_cleaning_photo(uuid, text)  to authenticated;
grant  execute on function public.finish_cleaning(uuid, text)     to authenticated;
grant  execute on function public.cancel_cleaning(uuid)           to authenticated;

-- ---------- Stockage des photos ----------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Chemin : <org_id>/<cleaning_id>/<fichier>.jpg
create policy photos_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and exists (
      select 1 from public.cleanings c
       where c.id::text = (storage.foldername(name))[2]
         and c.cleaner_id = auth.uid()
         and c.status = 'in_progress'
    )
  );

create policy photos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (
      public.auth_is_admin()
      or exists (
        select 1 from public.cleanings c
         where c.id::text = (storage.foldername(name))[2]
           and c.cleaner_id = auth.uid()
      )
    )
  );
-- Pas de policy update/delete : une photo envoyée ne peut plus être modifiée (preuve).
