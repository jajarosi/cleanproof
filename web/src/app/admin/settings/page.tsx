import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const me = await requireAdmin();
  const { t } = await getDict();
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations").select("name, min_photos, photo_retention_days, require_approval").eq("id", me.org_id).single();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.settings}</h1>
      {org && <SettingsForm org={org} />}
    </div>
  );
}
