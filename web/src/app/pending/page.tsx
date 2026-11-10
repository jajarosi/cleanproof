import Link from "next/link";
import { redirect } from "next/navigation";
import { myMemberships } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { LogoutButton } from "@/components/LogoutButton";

export default async function PendingPage() {
  const { t } = await getDict();
  const memberships = await myMemberships();
  const pending = memberships.filter((m) => m.status === "pending");
  if (pending.length === 0) redirect("/select-org");

  // Le nom de l'entreprise n'est pas encore lisible par la personne (pas encore membre active)
  const { data: orgs } = await createAdminClient()
    .from("organizations").select("name").in("id", pending.map((m) => m.org_id));
  const names = (orgs ?? []).map((o) => o.name).join(", ");
  const hasActive = memberships.some((m) => m.status === "active");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <div className="card space-y-3 p-6">
        <div className="text-4xl">⏳</div>
        <h1 className="text-xl font-semibold">{t.auth.pendingTitle}</h1>
        <p className="text-slate-600">{fmt(t.auth.pendingText, { org: names })}</p>
        <Link href="/select-org" prefetch={false} className="btn-primary w-full">{t.auth.refresh}</Link>
        {hasActive && <Link href="/select-org" className="block text-sm text-teal-700 underline">{t.auth.switchOrg}</Link>}
      </div>
      <div className="flex justify-center"><LogoutButton label={t.common.logout} /></div>
    </main>
  );
}
