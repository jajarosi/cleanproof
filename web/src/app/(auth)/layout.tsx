import { LangSwitcher } from "@/components/LangSwitcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4"><LangSwitcher /></div>
      <div className="mb-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-10 w-10" />
        <span className="text-2xl font-bold tracking-tight">Cleaner</span>
      </div>
      <div className="card w-full max-w-sm p-6">{children}</div>
    </main>
  );
}
