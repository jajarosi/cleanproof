import Link from "next/link";
import { redirect } from "next/navigation";
import { myMemberships } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { LogoutButton } from "@/components/LogoutButton";

/** Après connexion : choix de l'entreprise (automatique s'il n'y en a qu'une). */
export default async function SelectOrgPage() {
  const { t } = await getDict();
  const memberships = await myMemberships();
  const active = memberships.filter((m) => m.status === "active");

  if (active.length === 1) redirect(`/select-org/set?org=${active[0].org_id}`);
  if (active.length === 0 && memberships.some((m) => m.status === "pending")) redirect("/pending");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      {active.length === 0 ? (
        <p className="card p-6 text-center text-slate-600">{t.auth.noOrg}</p>
      ) : (
        <>
          <h1 className="text-xl font-semibold">{t.auth.chooseOrg}</h1>
          <ul className="space-y-2">
            {active.map((m) => (
              <li key={m.org_id}>
                <Link
                  href={`/select-org/set?org=${m.org_id}`}
                  prefetch={false}
                  className="card flex items-center justify-between p-4 font-semibold hover:border-teal-600"
                >
                  {m.organizations?.name}
                  <span className="text-sm font-normal text-slate-500">
                    {m.role === "admin" ? t.admin.roleAdmin : t.admin.roleCleaner}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex justify-center"><LogoutButton label={t.common.logout} /></div>
    </main>
  );
}
