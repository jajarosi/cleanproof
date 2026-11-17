"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { startCleaning } from "@/app/actions/cleaning";
import { useI18n } from "@/lib/i18n/client";
import { StatusBadge } from "@/components/StatusBadge";

export type PickerApartment = {
  id: string; name: string; status: "dirty" | "in_progress" | "clean"; myCleaningId: string | null;
};

const byName = (a: PickerApartment, b: PickerApartment) =>
  a.name.localeCompare(b.name, undefined, { numeric: true });

export function ApartmentPicker({ apartments }: { apartments: PickerApartment[] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sections = [
    { key: "mine", title: t.cleaner.yourCleaning, items: apartments.filter((a) => a.myCleaningId) },
    { key: "dirty", title: t.status.dirty, items: apartments.filter((a) => !a.myCleaningId && a.status === "dirty") },
    { key: "in_progress", title: t.status.in_progress, items: apartments.filter((a) => !a.myCleaningId && a.status === "in_progress") },
    { key: "clean", title: t.status.clean, items: apartments.filter((a) => !a.myCleaningId && a.status === "clean") },
  ].filter((s) => s.items.length > 0);

  return (
    <>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {sections.map((s) => (
        <section key={s.key} className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {s.title}
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{s.items.length}</span>
          </h2>
          <ul className="space-y-2">
            {s.items.sort(byName).map((a) => (
              <li key={a.id}
                className={`card flex items-center gap-3 p-4 ${a.myCleaningId ? "ring-2 ring-teal-600" : ""} ${a.status === "clean" ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{a.name}</p>
                  <StatusBadge status={a.status} />
                </div>
                {a.myCleaningId ? (
                  <Link href={`/app/cleaning/${a.myCleaningId}`} className="btn-primary">{t.cleaner.resume}</Link>
                ) : a.status === "in_progress" ? null : a.status === "clean" ? (
                  <span className="text-2xl text-emerald-600" aria-hidden>✓</span>
                ) : (
                  <button
                    className="btn-primary"
                    disabled={pending}
                    onClick={() => {
                      setBusyId(a.id);
                      setError(null);
                      start(async () => {
                        const res = await startCleaning(a.id);
                        if (res?.error) setError(res.error);
                        setBusyId(null);
                      });
                    }}
                  >
                    {busyId === a.id ? "…" : t.cleaner.start}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
