import { logout } from "@/app/actions/auth";

export function LogoutButton({ label }: { label: string }) {
  return (
    <form action={logout}>
      <button className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">{label}</button>
    </form>
  );
}
