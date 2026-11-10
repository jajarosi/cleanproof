import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findValidInvite } from "@/lib/invites";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { logout } from "@/app/actions/auth";
import { JoinForm, JoinAsCurrentUser } from "./JoinForms";

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const { t } = await getDict();
  const org = await findValidInvite(token);
  if (!org) return <p className="text-center text-slate-600">{t.join.invalid}</p>;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;

  const header = (
    <div className="mb-4 space-y-1">
      <h1 className="text-xl font-semibold">{fmt(t.join.title, { org: org.name })}</h1>
      {!uid && <p className="text-sm text-slate-600">{fmt(t.join.subtitle, { org: org.name })}</p>}
    </div>
  );

  if (!uid) {
    return (
      <>
        {header}
        <JoinForm token={token} />
        <p className="mt-4 text-center text-sm text-slate-500">
          {t.join.haveAccount}{" "}
          <Link href={`/login?next=/join/${token}`} className="font-medium text-teal-700 hover:underline">
            {t.join.loginToJoin}
          </Link>
        </p>
      </>
    );
  }

  const admin = createAdminClient();
  const [{ data: profile }, { data: membership }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
    admin.from("memberships").select("status").eq("user_id", uid).eq("org_id", org.id).maybeSingle(),
  ]);

  return (
    <>
      {header}
      {membership?.status === "active" ? (
        <div className="space-y-3 text-center">
          <p className="text-slate-600">{fmt(t.join.alreadyMember, { org: org.name })}</p>
          <Link href={`/select-org/set?org=${org.id}`} prefetch={false} className="btn-primary w-full">OK</Link>
        </div>
      ) : (
        <JoinAsCurrentUser token={token} name={profile?.full_name ?? ""} />
      )}
      <form action={logout} className="mt-4 text-center text-sm text-slate-500">
        {t.join.notYou}{" "}
        <button className="font-medium text-teal-700 hover:underline">{t.common.logout}</button>
      </form>
    </>
  );
}
