"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addMember, disableInvite, refuseMember, regenerateInvite, resetMemberPassword, setMemberStatus,
} from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/dictionaries";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { LocalTime } from "@/components/LocalTime";

export type Member = {
  id: string;
  full_name: string;
  email: string | null;
  role: "admin" | "cleaner";
  status: "pending" | "active" | "disabled";
  shared: boolean;
};

export function InvitePanel({ url, expiresAt, orgName, requireApproval }: {
  url: string | null; expiresAt: string | null; orgName: string; requireApproval: boolean;
}) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const whatsapp = url ? `https://wa.me/?text=${encodeURIComponent(`${fmt(t.admin.whatsappText, { org: orgName })} ${url}`)}` : "";

  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">{t.admin.inviteTitle}</h2>
      <p className="text-sm text-slate-600">
        {t.admin.inviteHelp} {requireApproval ? t.admin.inviteApprovalOn : t.admin.inviteApprovalOff}
      </p>
      {url ? (
        <>
          <div className="flex gap-2">
            <input readOnly value={url} className="input font-mono text-sm" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? t.admin.copied : t.admin.copy}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={whatsapp} target="_blank" rel="noreferrer" className="btn bg-[#25D366] text-white hover:bg-[#1ebe5b]">
              {t.admin.shareWhatsapp}
            </a>
            <button type="button" className="btn-secondary" disabled={pending}
              onClick={() => { if (confirm(t.admin.confirmNewLink)) start(async () => { await regenerateInvite(); }); }}>
              {t.admin.newLink}
            </button>
            <button type="button" className="btn-danger" disabled={pending}
              onClick={() => start(async () => { await disableInvite(); })}>
              {t.admin.disableLink}
            </button>
            {expiresAt && (
              <span className="text-xs text-slate-500">{t.admin.linkExpires} <LocalTime iso={expiresAt} /></span>
            )}
          </div>
        </>
      ) : (
        <button type="button" className="btn-primary" disabled={pending}
          onClick={() => start(async () => { await regenerateInvite(); })}>
          {t.admin.createLink}
        </button>
      )}
    </section>
  );
}

export function PendingRow({ member }: { member: Member }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-2 p-4">
      <p className="flex-1 font-semibold">{member.full_name}</p>
      <button className="btn-primary" disabled={pending}
        onClick={() => start(async () => { await setMemberStatus(member.id, "active"); })}>
        ✓ {t.admin.accept}
      </button>
      <button className="btn-danger" disabled={pending}
        onClick={() => start(async () => { await refuseMember(member.id); })}>
        {t.admin.refuse}
      </button>
    </li>
  );
}

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

export function MemberRow({ member, isMe }: { member: Member; isMe: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [showPwd, setShowPwd] = useState(false);
  const [state, action] = useActionState(resetMemberPassword, undefined);
  const active = member.status === "active";

  return (
    <li className={`space-y-2 p-4 ${active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {member.full_name} {isMe && <span className="text-xs font-normal text-slate-400">({t.admin.you})</span>}
          </p>
          <p className="text-sm text-slate-500">
            {member.email && `${member.email} · `}
            {member.role === "admin" ? t.admin.roleAdmin : t.admin.roleCleaner}
            {!active && ` · ${t.admin.inactive}`}
          </p>
          {member.shared && !isMe && <p className="text-xs text-slate-400">{t.admin.sharedMember}</p>}
        </div>
        {!isMe && (
          <>
            {!member.shared && (
              <button className="btn-secondary" onClick={() => setShowPwd((v) => !v)}>{t.admin.resetPassword}</button>
            )}
            <button
              className={active ? "btn-danger" : "btn-secondary"}
              disabled={pending}
              onClick={() => start(async () => { await setMemberStatus(member.id, active ? "disabled" : "active"); })}
            >
              {active ? t.admin.deactivate : t.admin.activate}
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
