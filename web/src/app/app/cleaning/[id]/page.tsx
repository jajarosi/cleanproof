import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { CleaningSession } from "./CleaningSession";

export default async function CleaningPage({ params }: PageProps<"/app/cleaning/[id]">) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: cleaning } = await supabase
    .from("cleanings")
    .select("id, org_id, status, started_at, cleaner_id, apartments(name), organizations(min_photos)")
    .eq("id", id)
    .single();

  if (!cleaning || cleaning.cleaner_id !== profile.id) notFound();
  if (cleaning.status !== "in_progress") redirect("/app");

  const { data: photos } = await supabase
    .from("cleaning_photos").select("id, storage_path, created_at")
    .eq("cleaning_id", id).order("created_at");

  const signed = await signPhotos(supabase, photos ?? []);
  const apt = cleaning.apartments as unknown as { name: string };
  const org = cleaning.organizations as unknown as { min_photos: number };

  return (
    <CleaningSession
      cleaningId={cleaning.id}
      orgId={cleaning.org_id}
      apartmentName={apt.name}
      cleanerName={profile.full_name}
      startedAt={cleaning.started_at}
      minPhotos={org.min_photos}
      photos={signed}
    />
  );
}
