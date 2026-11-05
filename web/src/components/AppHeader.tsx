import Link from "next/link";
import { LangSwitcher } from "./LangSwitcher";
import { LogoutButton } from "./LogoutButton";

export function AppHeader({
  title, userName, logoutLabel, links = [],
}: {
  title: string; userName: string; logoutLabel: string; links?: { href: string; label: string }[];
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          <span className="hidden sm:inline">{title}</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {l.label}
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
