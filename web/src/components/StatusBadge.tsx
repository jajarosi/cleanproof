"use client";
import { useI18n } from "@/lib/i18n/client";

const STYLES = {
  dirty: "bg-orange-100 text-orange-800 ring-orange-200",
  in_progress: "bg-blue-100 text-blue-800 ring-blue-200",
  clean: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  done: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
} as const;

export function StatusBadge({ status }: { status: keyof typeof STYLES }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STYLES[status]}`}>
      {t.status[status]}
    </span>
  );
}
