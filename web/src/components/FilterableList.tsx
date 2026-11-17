"use client";
import { Fragment, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/client";
import { normalize } from "@/lib/apartments";

type Status = "dirty" | "in_progress" | "clean";

export type FilterableItem = { key: string; text: string; status?: Status; node: ReactNode };

const CHIP = {
  dirty: "bg-orange-100 text-orange-800 ring-orange-300",
  in_progress: "bg-blue-100 text-blue-800 ring-blue-300",
  clean: "bg-emerald-100 text-emerald-800 ring-emerald-300",
} as const;

/** Recherche instantanée (nom, rue, n°, étage, appart) + filtre par statut. */
export function FilterableList({
  items, className, statusFilter = false,
}: {
  items: FilterableItem[];
  className?: string;
  statusFilter?: boolean;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | null>(null);

  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matching = items.filter((i) => words.every((w) => i.text.includes(w)));
  const shown = status ? matching.filter((i) => i.status === status) : matching;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.admin.search}
          className="input min-w-0 flex-1 sm:max-w-sm"
        />
        {statusFilter && (
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" onClick={() => setStatus(null)}
              className={`rounded-full px-3 py-1 font-semibold ring-1 ${status === null ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-700 ring-slate-300"}`}>
              {t.admin.filterAll} {matching.length}
            </button>
            {(Object.keys(CHIP) as Status[]).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(status === s ? null : s)}
                className={`rounded-full px-3 py-1 font-semibold ring-1 ${CHIP[s]} ${status === s ? "ring-2" : "ring-transparent"}`}>
                {matching.filter((i) => i.status === s).length} {t.status[s]}
              </button>
            ))}
          </div>
        )}
      </div>
      {shown.length === 0 && items.length > 0 ? (
        <p className="card p-6 text-center text-slate-500">{t.admin.noResults}</p>
      ) : (
        <div className={className}>{shown.map((i) => <Fragment key={i.key}>{i.node}</Fragment>)}</div>
      )}
    </div>
  );
}
