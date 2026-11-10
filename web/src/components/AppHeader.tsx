import Link from "next/link";
import { LangSwitcher } from "./LangSwitcher";
import { LogoutButton } from "./LogoutButton";

export function AppHeader({
  orgName, userName, logoutLabel, switchOrgLabel, links = [],
}: {
  orgName: string;
  userName: string;
  logoutLabel: string;
  /** Affiché seulement si la personne travaille pour plusieurs entreprises. */
  switchOrgLabel?: string;
  links?: { href: string; label: string; badge?: number }[];
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="hidden truncate sm:inline">{orgName}</span>
        </Link>
        {switchOrgLabel && (
          <Link href="/select-org" prefetch={false} title={switchOrgLabel}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50">
            ⇄ <span className="sm:hidden">{orgName}</span>
          </Link>
        )}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {l.label}
              {!!l.badge && (
                <span className="rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">{l.badge}</span>
              )}
            </Link>
          ))}
        </nav>
        <span className="hidden text-sm text-slate-500 md:inline">{userName}</span>
        <LangSwitcher />
        <LogoutButton label={logoutLabel} />
      </div>
    </header>
  );
}
