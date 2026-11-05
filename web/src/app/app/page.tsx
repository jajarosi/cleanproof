import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n/server";
import { ApartmentPicker, type PickerApartment } from "./ApartmentPicker";

const ORDER = { dirty: 0, clean: 1, in_progress: 2 } as const;

export default async function CleanerHome({ searchParams }: PageProps<"/app">) {
  const profile = await requireProfile();
  const { t } = await getDict();
  const { done } = await searchParams;
  const supabase = await createClient();

  const [{ data: apartments }, { data: mine }] = await Promise.all([
    supabase.from("apartments").select("id, name, status").order("name"),
    supabase.from("cleanings").select("id, apartment_id")
      .eq("cleaner_id", profile.id).eq("status", "in_progress"),
  ]);

  const myByApt = new Map((mine ?? []).map((c) => [c.apartment_id, c.id]));
  const list: PickerApartment[] = (apartments ?? [])
    .map((a) => ({ ...a, myCleaningId: myByApt.get(a.id) ?? null }))
    .sort((a, b) =>
      Number(!b.myCleaningId) - Number(!a.myCleaningId) ||
      ORDER[a.status as keyof typeof ORDER] - ORDER[b.status as keyof typeof ORDER] ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );

  return (
    <div className="space-y-4">
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
