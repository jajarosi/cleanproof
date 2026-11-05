"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLang } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export function LangSwitcher() {
  const { lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = lang === "fr" ? "en" : "fr";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await setLang(next); router.refresh(); })}
      className="rounded-lg px-2 py-1 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100"
      aria-label="Language"
    >
      {next}
    </button>
  );
}
