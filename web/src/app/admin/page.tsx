import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { attachPhotos, fetchCleanings, type CleaningRow } from "@/lib/queries";
import { StatusBadge } from "@/components/StatusBadge";
import { Duration, LocalTime } from "@/components/LocalTime";
import { MarkDirtyButton } from "./MarkDirtyButton";

export default async function AdminDashboard() {
  const { t } = await getDict();
  const supabase = await createClient();

  const [{ data: apartments }, cleanings] = await Promise.all([
    supabase.from("apartments").select("id, name, status").order("name"),
    fetchCleanings(supabase, { statuses: ["done", "in_progress"], limit: 1000 }),
  ]);

  // Dernier ménage terminé + ménage en cours, par logement
  const lastDone = new Map<string, CleaningRow>();
  const current = new Map<string, CleaningRow>();
  for (const c of cleanings) {
    if (c.status === "done" && !lastDone.has(c.apartment_id)) lastDone.set(c.apartment_id, c);
    if (c.status === "in_progress" && !current.has(c.apartment_id)) current.set(c.apartment_id, c);
  }
  const withPhotos = await attachPhotos(supabase, [...lastDone.values()]);
  const doneByApt = new Map(withPhotos.map((c) => [c.apartment_id, c]));

  const list = (apartments ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const counts = { dirty: 0, in_progress: 0, clean: 0 };
  list.forEach((a) => counts[a.status as keyof typeof counts]++);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.admin.dashboard}</h1>
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-800">{counts.dirty} {t.status.dirty}</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-800">{counts.in_progress} {t.status.in_progress}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">{counts.clean} {t.status.clean}</span>
        </div>
      </div>

      {list.length === 0 && (
        <div className="card p-6 text-center text-slate-500">
          <Link href="/admin/apartments" className="btn-primary">{t.admin.addApartment}</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => {
          const done = doneByApt.get(a.id);
          const now = current.get(a.id);
          const cover = done?.photos[0];
          return (
            <div key={a.id} className="card flex flex-col overflow-hidden">
              <Link href={`/admin/apartments/${a.id}`} className="block aspect-[4/3] bg-slate-100">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover.url} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">{t.admin.noCleaning}</div>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/admin/apartments/${a.id}`} className="truncate text-lg font-semibold hover:underline">{a.name}</Link>
                  <StatusBadge status={a.status} />
                </div>

                {now && (
                  <p className="text-sm text-blue-700">
                    {fmt(t.admin.inProgressBy, { name: now.cleaner?.full_name ?? "?" })}{" "}
                    <LocalTime iso={now.started_at} mode="time" />
                  </p>
                )}

                {done ? (
                  <div className="text-sm text-slate-600">
                    <p>
                      <span className="text-slate-400">{t.admin.lastCleaning} : </span>
                      <span className="font-medium text-slate-800">{done.cleaner?.full_name}</span>
                    </p>
                    <p>
                      <LocalTime iso={done.finished_at!} /> ·{" "}
                      <Duration from={done.started_at} to={done.finished_at!} /> · 📷 {done.photos.length}
                    </p>
                    {done.comment && <p className="mt-1 rounded-lg bg-amber-50 p-2 text-amber-900">💬 {done.comment}</p>}
                  </div>
                ) : (
                  !now && <p className="text-sm text-slate-400">{t.admin.noCleaning}</p>
                )}

                <div className="mt-auto flex gap-2 pt-2">
                  <Link href={`/admin/apartments/${a.id}`} className="btn-secondary flex-1">{t.admin.history}</Link>
                  {a.status === "clean" && <MarkDirtyButton id={a.id} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
