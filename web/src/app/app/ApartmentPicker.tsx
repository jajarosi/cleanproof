"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { startCleaning } from "@/app/actions/cleaning";
import { useI18n } from "@/lib/i18n/client";
import { StatusBadge } from "@/components/StatusBadge";

export type PickerApartment = {
  id: string; name: string; status: "dirty" | "in_progress" | "clean"; myCleaningId: string | null;
};

export function ApartmentPicker({ apartments }: { apartments: PickerApartment[] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <ul className="space-y-2">
        {apartments.map((a) => (
          <li key={a.id} className="card flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{a.name}</p>
              <StatusBadge status={a.status} />
            </div>
            {a.myCleaningId ? (
              <Link href={`/app/cleaning/${a.myCleaningId}`} className="btn-primary">{t.cleaner.resume}</Link>
            ) : a.status === "in_progress" ? (
              <span className="text-sm text-slate-400">{t.status.in_progress}</span>
            ) : (
              <button
                className={a.status === "dirty" ? "btn-primary" : "btn-secondary"}
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
    </>
  );
}
