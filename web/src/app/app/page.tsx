import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n/server";
import { AutoRefresh } from "@/components/AutoRefresh";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ApartmentPicker, type PickerApartment } from "./ApartmentPicker";

export default async function CleanerHome({ searchParams }: PageProps<"/app">) {
  const profile = await requireProfile();
  const { t } = await getDict();
  const { done } = await searchParams;
  const supabase = await createClient();

  const [{ data: apartments }, { data: mine }] = await Promise.all([
    supabase.from("apartments").select("id, name, status").eq("org_id", profile.org_id).order("name"),
    supabase.from("cleanings").select("id, apartment_id")
      .eq("cleaner_id", profile.id).eq("org_id", profile.org_id).eq("status", "in_progress"),
  ]);

  const myByApt = new Map((mine ?? []).map((c) => [c.apartment_id, c.id]));
  const list: PickerApartment[] = (apartments ?? [])
    .map((a) => ({ ...a, myCleaningId: myByApt.get(a.id) ?? null }));

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <InstallPrompt />
      {done === "1" && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          ✓ {t.cleaner.finished}
        </div>
      )}
      <h1 className="text-xl font-semibold">{t.cleaner.title}</h1>
      {list.length === 0 ? (
        <p className="text-slate-500">{t.cleaner.noApartments}</p>
      ) : (
        <ApartmentPicker apartments={list} />
      )}
    </div>
  );
}
