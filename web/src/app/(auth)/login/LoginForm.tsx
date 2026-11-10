"use client";
import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-xl font-semibold">{t.auth.loginTitle}</h1>
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="identifier">{t.auth.identifier}</label>
        <input id="identifier" name="identifier" required autoCapitalize="words" autoCorrect="off" autoComplete="username" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{t.auth.login}</SubmitButton>
      <p className="pt-2 text-center text-sm text-slate-500">
        {t.auth.noAccount}{" "}
        <Link href="/signup" className="font-medium text-teal-700 hover:underline">{t.auth.createCompany}</Link>
      </p>
    </form>
  );
}
