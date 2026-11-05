"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addMember, resetMemberPassword, setMemberActive } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function AddMemberForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(addMember, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} className="card grid gap-3 p-4 sm:grid-cols-2">
      <h2 className="font-semibold sm:col-span-2">{t.admin.addMember}</h2>
      <div>
        <label className="label" htmlFor="firstName">{t.admin.firstName}</label>
        <input id="firstName" name="firstName" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="lastName">{t.admin.lastName}</label>
        <input id="lastName" name="lastName" required className="input" />
      </div>
      <p className="text-xs text-slate-500 sm:col-span-2">{t.admin.loginHelp}</p>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input id="password" name="password" type="text" minLength={8} required autoComplete="off" className="input" />
        <p className="mt-1 text-xs text-slate-500">{t.auth.passwordMin}</p>
      </div>
      <div>
        <label className="label" htmlFor="role">{t.admin.role}</label>
        <select id="role" name="role" className="input" defaultValue="cleaner">
          <option value="cleaner">{t.admin.roleCleaner}</option>
          <option value="admin">{t.admin.roleAdmin}</option>
        </select>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>{t.admin.addMember}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

type Member = { id: string; full_name: string; username: string; role: "admin" | "cleaner"; active: boolean };

export function MemberRow({ member, isMe }: { member: Member; isMe: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [showPwd, setShowPwd] = useState(false);
  const [state, action] = useActionState(resetMemberPassword, undefined);

  return (
    <li className={`space-y-2 p-4 ${member.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {member.full_name} {isMe && <span className="text-xs font-normal text-slate-400">({t.admin.you})</span>}
          </p>
          <p className="text-sm text-slate-500">
            {member.username.includes("@") && `${member.username} · `}
            {member.role === "admin" ? t.admin.roleAdmin : t.admin.roleCleaner}
            {!member.active && ` · ${t.admin.inactive}`}
          </p>
        </div>
        {!isMe && (
          <>
            <button className="btn-secondary" onClick={() => setShowPwd((v) => !v)}>{t.admin.resetPassword}</button>
            <button
              className={member.active ? "btn-danger" : "btn-secondary"}
              disabled={pending}
              onClick={() => start(async () => { await setMemberActive(member.id, !member.active); })}
            >
              {member.active ? t.admin.deactivate : t.admin.activate}
            </button>
          </>
        )}
      </div>
      {showPwd && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="memberId" value={member.id} />
          <input name="password" type="text" minLength={8} required placeholder={t.admin.newPassword} className="input max-w-xs" autoComplete="off" />
          <SubmitButton>{t.common.save}</SubmitButton>
          <FormMessage state={state} />
        </form>
      )}
    </li>
  );
}
