import { requireProfile } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { AppHeader } from "@/components/AppHeader";

export default async function CleanerLayout({ children }: LayoutProps<"/app">) {
  const profile = await requireProfile();
  const { t } = await getDict();
  return (
    <>
      <AppHeader
        title={t.appName}
        userName={profile.full_name}
        logoutLabel={t.common.logout}
        links={profile.role === "admin" ? [{ href: "/admin", label: t.admin.dashboard }] : []}
      />
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </>
  );
}
