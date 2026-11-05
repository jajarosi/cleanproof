-- =====================================================================
-- Connexion des agents par "Prénom Nom" (unique par entreprise, pas globalement)
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- Clé de connexion normalisée (minuscules, sans accents, mots triés) — calculée par l'appli
alter table public.profiles add column if not exists login_key text;

update public.profiles set login_key = lower(trim(full_name)) where login_key is null;

alter table public.profiles alter column login_key set not null;

-- Deux personnes ne peuvent pas avoir le même nom dans une même entreprise
create unique index if not exists profiles_org_login_key on public.profiles (org_id, login_key);
create index if not exists profiles_login_key on public.profiles (login_key);
