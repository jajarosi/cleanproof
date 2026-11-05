"use client";
import { useTransition } from "react";
import { markDirty } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";

export function MarkDirtyButton({ id }: { id: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button className="btn-secondary flex-1 text-orange-700" disabled={pending} onClick={() => start(async () => { await markDirty(id); })}>
      {pending ? "…" : t.admin.markDirty}
    </button>
  );
}
