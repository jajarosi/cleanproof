-- Un agent peut supprimer une photo ratée PENDANT son ménage.
-- Une fois le ménage terminé, les photos restent intouchables (preuve).
-- La fonction renvoie le chemin du fichier : le serveur le supprime ensuite du bucket.

create or replace function public.delete_cleaning_photo(p_photo_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_c public.cleanings;
  v_path text;
begin
  -- Verrouille le ménage : évite une course avec finish_cleaning (compte des photos)
  select c.* into v_c from public.cleanings c
    join public.cleaning_photos p on p.cleaning_id = c.id
   where p.id = p_photo_id and c.cleaner_id = auth.uid() and c.status = 'in_progress'
   for update of c;
  if not found or not public.is_member(v_c.org_id) then raise exception 'photo_not_found'; end if;

  delete from public.cleaning_photos where id = p_photo_id and cleaning_id = v_c.id
  returning storage_path into v_path;
  return v_path;
end $$;

revoke execute on function public.delete_cleaning_photo(uuid) from public, anon;
grant  execute on function public.delete_cleaning_photo(uuid) to authenticated;
