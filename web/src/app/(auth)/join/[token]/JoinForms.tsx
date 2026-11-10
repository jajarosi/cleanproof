"use client";
import { useActionState } from "react";
import { joinAsCurrentUser, joinWithNewAccount } from "@/app/actions/join";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/dictionaries";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function JoinForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(joinWithNewAccount.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="firstName">{t.admin.firstName}</label>
        <input id="firstName" name="firstName" required autoComplete="given-name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="lastName">{t.admin.lastName}</label>
        <input id="lastName" name="lastName" required autoComplete="family-name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
        <p className="mt-1 text-xs text-slate-500">{t.auth.passwordMin}</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{t.join.submit}</SubmitButton>
    </form>
  );
}

export function JoinAsCurrentUser({ token, name }: { token: string; name: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(joinAsCurrentUser.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{fmt(t.join.joinAs, { name })}</SubmitButton>
    </form>
  );
}
