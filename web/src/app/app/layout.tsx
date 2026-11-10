import { requireProfile } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { AppHeader } from "@/components/AppHeader";

export default async function CleanerLayout({ children }: LayoutProps<"/app">) {
  const profile = await requireProfile();
  const { t } = await getDict();
  return (
    <>
      <AppHeader
        orgName={profile.org_name}
        userName={profile.full_name}
        logoutLabel={t.common.logout}
        switchOrgLabel={profile.org_count > 1 ? t.auth.switchOrg : undefined}
        links={profile.role === "admin" ? [{ href: "/admin", label: t.admin.dashboard }] : []}
      />
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </>
  );
}
