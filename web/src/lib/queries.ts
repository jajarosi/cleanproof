import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signPhotos, type SignedPhoto } from "./photos";

export type CleaningRow = {
  id: string;
  apartment_id: string;
  status: "in_progress" | "done" | "cancelled";
  started_at: string;
  finished_at: string | null;
  comment: string | null;
  cleaner: { full_name: string } | null;
};

export type CleaningWithPhotos = CleaningRow & { photos: SignedPhoto[] };

const CLEANING_COLS =
  "id, apartment_id, status, started_at, finished_at, comment, cleaner:profiles!cleanings_cleaner_id_fkey(full_name)";

export async function fetchCleanings(
  supabase: SupabaseClient,
  opts: { apartmentId?: string; statuses?: CleaningRow["status"][]; limit?: number },
) {
  let q = supabase.from("cleanings").select(CLEANING_COLS).order("started_at", { ascending: false });
  if (opts.apartmentId) q = q.eq("apartment_id", opts.apartmentId);
  if (opts.statuses) q = q.in("status", opts.statuses);
  const { data } = await q.limit(opts.limit ?? 100);
  return (data ?? []) as unknown as CleaningRow[];
}

/** Ajoute les photos (URLs signées) aux nettoyages donnés. */
export async function attachPhotos(
  supabase: SupabaseClient,
  cleanings: CleaningRow[],
): Promise<CleaningWithPhotos[]> {
  if (cleanings.length === 0) return [];
  const { data } = await supabase
    .from("cleaning_photos")
    .select("id, cleaning_id, storage_path, created_at")
    .in("cleaning_id", cleanings.map((c) => c.id))
    .order("created_at");
  const rows = data ?? [];
  const signed = await signPhotos(supabase, rows);
  const signedById = new Map(signed.map((s) => [s.id, s]));
  return cleanings.map((c) => ({
    ...c,
    photos: rows.filter((r) => r.cleaning_id === c.id).map((r) => signedById.get(r.id)!).filter(Boolean),
  }));
}
