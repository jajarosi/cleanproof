"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addApartment, deleteApartment, updateApartment } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { formatAddress, type ApartmentAddress } from "@/lib/apartments";

export type ApartmentData = { id: string; name: string } & ApartmentAddress;

/** Nom + adresse détaillée (rue, n°, étage, appart/chambre). */
function Fields({ a, idPrefix }: { a?: ApartmentData; idPrefix: string }) {
  const { t } = useI18n();
  const field = (name: keyof ApartmentAddress, label: string, cls: string, inputMode?: "numeric") => (
    <div className={cls}>
      <label className="label" htmlFor={`${idPrefix}-${name}`}>{label}</label>
      <input id={`${idPrefix}-${name}`} name={name} defaultValue={a?.[name] ?? ""} inputMode={inputMode} className="input" />
    </div>
  );
  return (
    <>
      <div>
        <label className="label" htmlFor={`${idPrefix}-name`}>{t.admin.apartmentName}</label>
        <input id={`${idPrefix}-name`} name="name" required defaultValue={a?.name ?? ""} className="input" />
      </div>
      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t.admin.address}</p>
      <div className="grid grid-cols-4 gap-2">
        {field("building_number", t.admin.buildingNumber, "col-span-1")}
        {field("street", t.admin.street, "col-span-3")}
        {field("floor", t.admin.floor, "col-span-2")}
        {field("unit", t.admin.unit, "col-span-2")}
      </div>
    </>
  );
}

export function AddApartmentForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(addApartment, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} className="card space-y-2 p-4">
      <h2 className="font-semibold">{t.admin.addApartment}</h2>
      <Fields idPrefix="new" />
      <div className="flex items-center gap-3 pt-2">
        <SubmitButton>+ {t.admin.addApartment}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ApartmentRow({ a }: { a: ApartmentData }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updateApartment, undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const address = formatAddress(a, t);

  return (
    <div className="card p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{a.name}</p>
          {address && <p className="truncate text-sm text-slate-500">📍 {address}</p>}
        </div>
        <button type="button" className="btn-secondary" onClick={() => setOpen(!open)}>
          {open ? t.common.cancel : t.admin.edit}
        </button>
        <button type="button" className="btn-danger" disabled={pending}
          onClick={() => {
            if (!confirm(`${t.common.confirmDelete}\n${a.name}`)) return;
            start(async () => { const r = await deleteApartment(a.id); setError(r?.error ?? null); });
          }}>
          {t.common.delete}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {open && (
        <form action={action} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="id" value={a.id} />
          <Fields a={a} idPrefix={a.id} />
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton>{t.common.save}</SubmitButton>
            <FormMessage state={state} />
          </div>
        </form>
      )}
    </div>
  );
}
