import { requireAdmin } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { AppHeader } from "@/components/AppHeader";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireAdmin();
  const { t } = await getDict();
  return (
    <>
      <AppHeader
        title={t.appName}
        userName={profile.full_name}
        logoutLabel={t.common.logout}
        links={[
          { href: "/admin", label: t.admin.dashboard },
          { href: "/admin/apartments", label: t.admin.apartments },
          { href: "/admin/team", label: t.admin.team },
          { href: "/admin/settings", label: t.admin.settings },
          { href: "/app", label: t.admin.cleanerView },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
