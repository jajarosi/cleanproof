import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { attachPhotos, fetchCleanings } from "@/lib/queries";
import { StatusBadge } from "@/components/StatusBadge";
import { Duration, LocalTime } from "@/components/LocalTime";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PhotoGrid } from "@/components/PhotoLightbox";
import { ADDRESS_COLS, formatAddress } from "@/lib/apartments";
import { MarkDirtyButton } from "../../MarkDirtyButton";

export default async function ApartmentHistory({ params }: PageProps<"/admin/apartments/[id]">) {
  const { id } = await params;
  const me = await requireAdmin();
  const { t } = await getDict();
  const supabase = await createClient();

  const { data: apt } = await supabase.from("apartments").select(`id, name, status, ${ADDRESS_COLS}`).eq("id", id).eq("org_id", me.org_id).single();
  if (!apt) notFound();

  const address = formatAddress(apt, t);
  const cleanings = await attachPhotos(supabase, await fetchCleanings(supabase, { orgId: me.org_id, apartmentId: id, limit: 50 }));

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div>
        <Link href="/admin" className="text-sm text-slate-500 hover:underline">← {t.common.back}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{apt.name}</h1>
          <StatusBadge status={apt.status} />
          {apt.status === "clean" && <div className="w-56"><MarkDirtyButton id={apt.id} /></div>}
        </div>
        {address && <p className="mt-1 text-slate-500">📍 {address}</p>}
      </div>

      <h2 className="text-lg font-semibold">{t.admin.history}</h2>
      {cleanings.length === 0 && <p className="text-slate-500">{t.admin.noHistory}</p>}

      <ol className="space-y-4">
        {cleanings.map((c) => (
          <li key={c.id} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <StatusBadge status={c.status} />
              <span className="font-semibold text-slate-900">{c.cleaner?.full_name}</span>
              <span className="text-slate-600">
                {t.admin.start} : <LocalTime iso={c.started_at} />
              </span>
              {c.finished_at && (
                <span className="text-slate-600">
                  {t.admin.end} : <LocalTime iso={c.finished_at} /> (<Duration from={c.started_at} to={c.finished_at} />)
                </span>
              )}
            </div>
            {c.comment && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">💬 {c.comment}</p>}
            {c.photos.length > 0 && (
              <PhotoGrid photos={c.photos} className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
