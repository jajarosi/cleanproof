import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n/server";
import { AppHeader } from "@/components/AppHeader";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireAdmin();
  const { t } = await getDict();
  const supabase = await createClient();
  const { count: pending } = await supabase
    .from("memberships").select("user_id", { count: "exact", head: true })
    .eq("org_id", profile.org_id).eq("status", "pending");

  return (
    <>
      <AppHeader
        orgName={profile.org_name}
        userName={profile.full_name}
        logoutLabel={t.common.logout}
        switchOrgLabel={profile.org_count > 1 ? t.auth.switchOrg : undefined}
        links={[
          { href: "/admin", label: t.admin.dashboard },
          { href: "/admin/apartments", label: t.admin.apartments },
          { href: "/admin/team", label: t.admin.team, badge: pending ?? 0 },
          { href: "/admin/settings", label: t.admin.settings },
          { href: "/app", label: t.admin.cleanerView },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
