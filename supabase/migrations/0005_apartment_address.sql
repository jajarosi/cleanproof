-- Adresse détaillée des logements (tous facultatifs).
-- "name" reste le libellé court et unique affiché partout (ex. « Rivoli 12 – App. 7 »).

alter table public.apartments
  add column if not exists street          text,  -- rue
  add column if not exists building_number text,  -- numéro d'immeuble (texte : « 12 bis »)
  add column if not exists floor           text,  -- étage (texte : « RDC », « 3 »)
  add column if not exists unit            text;  -- appartement / chambre
