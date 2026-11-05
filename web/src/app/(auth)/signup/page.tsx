"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export default function SignupPage() {
  const { t } = useI18n();
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-xl font-semibold">{t.auth.signupTitle}</h1>
      <div>
        <label className="label" htmlFor="company">{t.auth.companyName}</label>
        <input id="company" name="company" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="fullName">{t.auth.yourName}</label>
        <input id="fullName" name="fullName" required autoComplete="name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">{t.auth.email}</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
        <p className="mt-1 text-xs text-slate-500">{t.auth.passwordMin}</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{t.auth.signup}</SubmitButton>
      <p className="pt-2 text-center text-sm text-slate-500">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline">{t.auth.login}</Link>
      </p>
    </form>
  );
}
