import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDict } from "@/lib/i18n/server";
import { AddMemberForm, InvitePanel, MemberRow, PendingRow, type Member } from "./TeamForms";

export default async function TeamPage() {
  const me = await requireAdmin();
  const { t } = await getDict();
  const supabase = await createClient();

  const [{ data: org }, { data: rows }] = await Promise.all([
    supabase.from("organizations").select("name, invite_token, invite_expires_at, require_approval").eq("id", me.org_id).single(),
    supabase.from("memberships")
      .select("user_id, role, status, created_at, profiles(full_name, username)")
      .eq("org_id", me.org_id),
  ]);

  // Personnes qui travaillent aussi pour d'autres entreprises
  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: all } = ids.length
    ? await createAdminClient().from("memberships").select("user_id").in("user_id", ids)
    : { data: [] };
  const orgCount = new Map<string, number>();
  (all ?? []).forEach((m) => orgCount.set(m.user_id, (orgCount.get(m.user_id) ?? 0) + 1));

  const members: Member[] = (rows ?? []).map((r) => {
    const p = r.profiles as unknown as { full_name: string; username: string } | null;
    return {
      id: r.user_id,
      full_name: p?.full_name ?? "?",
      email: p?.username.includes("@") ? p.username : null,
      role: r.role,
      status: r.status,
      shared: (orgCount.get(r.user_id) ?? 0) > 1,
    };
  }).sort((a, b) => a.full_name.localeCompare(b.full_name));

  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending");

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const valid = org?.invite_token && org.invite_expires_at && new Date(org.invite_expires_at) > new Date();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.team}</h1>

      <InvitePanel
        url={valid ? `${origin}/join/${org!.invite_token}` : null}
        expiresAt={valid ? org!.invite_expires_at : null}
        orgName={org?.name ?? ""}
        requireApproval={org?.require_approval ?? true}
      />

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-orange-700">{t.admin.pendingRequests} ({pending.length})</h2>
          <ul className="card divide-y divide-slate-100 border-orange-200">
            {pending.map((m) => <PendingRow key={m.id} member={m} />)}
          </ul>
        </section>
      )}

      <ul className="card divide-y divide-slate-100">
        {others.map((m) => <MemberRow key={m.id} member={m} isMe={m.id === me.id} />)}
      </ul>

      <AddMemberForm />
    </div>
  );
}
