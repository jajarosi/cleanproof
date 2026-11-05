import type { SupabaseClient } from "@supabase/supabase-js";

export type SignedPhoto = { id: string; url: string; created_at: string };

/** Génère des URLs temporaires (1 h) pour afficher des photos du bucket privé. */
export async function signPhotos(
  supabase: SupabaseClient,
  photos: { id: string; storage_path: string; created_at: string }[],
): Promise<SignedPhoto[]> {
  if (photos.length === 0) return [];
  const { data } = await supabase.storage.from("photos").createSignedUrls(photos.map((p) => p.storage_path), 3600);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return photos
    .map((p) => ({ id: p.id, created_at: p.created_at, url: byPath.get(p.storage_path) ?? "" }))
    .filter((p) => p.url);
}
