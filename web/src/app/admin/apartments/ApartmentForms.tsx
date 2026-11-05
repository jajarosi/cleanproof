"use client";
import { useActionState, useRef, useState, useTransition, useEffect } from "react";
import { addApartment, deleteApartment, renameApartment } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function AddApartmentForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(addApartment, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} className="card space-y-2 p-4">
      <label className="label" htmlFor="name">{t.admin.addApartment}</label>
      <div className="flex gap-2">
        <input id="name" name="name" required placeholder={t.admin.apartmentName} className="input" />
        <SubmitButton>+</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function ApartmentRow({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-2 p-3">
      <input className="input" value={value} onChange={(e) => setValue(e.target.value)} />
      {value !== name && (
        <button className="btn-primary" disabled={pending}
          onClick={() => start(async () => { const r = await renameApartment(id, value); setError(r?.error ?? null); })}>
          {t.common.save}
        </button>
      )}
      <button className="btn-danger" disabled={pending}
        onClick={() => {
          if (!confirm(`${t.common.confirmDelete}\n${name}`)) return;
          start(async () => { const r = await deleteApartment(id); setError(r?.error ?? null); });
        }}>
        {t.common.delete}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}
