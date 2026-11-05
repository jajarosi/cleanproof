import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n/server";
import { AddMemberForm, MemberRow } from "./TeamForms";

export default async function TeamPage() {
  const me = await requireAdmin();
  const { t } = await getDict();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles").select("id, full_name, username, role, active").order("full_name");
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.team}</h1>
      <AddMemberForm />
      <ul className="card divide-y divide-slate-100">
        {(data ?? []).map((m) => <MemberRow key={m.id} member={m} isMe={m.id === me.id} />)}
      </ul>
    </div>
  );
}
