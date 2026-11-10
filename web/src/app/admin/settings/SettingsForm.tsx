"use client";
import { useActionState } from "react";
import { saveSettings } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function SettingsForm({ org }: { org: { name: string; min_photos: number; photo_retention_days: number; require_approval: boolean } }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label className="label" htmlFor="name">{t.auth.companyName}</label>
        <input id="name" name="name" defaultValue={org.name} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="minPhotos">{t.admin.minPhotos}</label>
        <input id="minPhotos" name="minPhotos" type="number" min={1} max={20} defaultValue={org.min_photos} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="retentionDays">{t.admin.retentionDays}</label>
        <input id="retentionDays" name="retentionDays" type="number" min={1} defaultValue={org.photo_retention_days} required className="input" />
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="requireApproval" defaultChecked={org.require_approval} className="mt-1 h-5 w-5 accent-teal-700" />
        <span className="text-sm text-slate-700">{t.admin.requireApproval}</span>
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton>{t.common.save}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
