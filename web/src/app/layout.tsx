import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getLang } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cleaner",
  description: "Suivi des ménages avec preuve photo",
  appleWebApp: { capable: true, title: "Cleaner", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/180" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

// Dev only: some browser extensions (e.g. Bitdefender) stamp attributes like
// `bis_skin_checked` on every element before React hydrates, flooding the
// console with hydration-mismatch errors. Strip them as soon as they appear.
const STRIP_EXTENSION_ATTRS = `(() => {
  const isExt = (n) => n.startsWith("bis_") || n.startsWith("__processed_");
  const clean = (el) => {
    for (const a of Array.from(el.attributes || [])) if (isExt(a.name)) el.removeAttribute(a.name);
  };
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes" && m.attributeName && isExt(m.attributeName)) m.target.removeAttribute(m.attributeName);
      else for (const n of m.addedNodes) if (n.nodeType === 1) { clean(n); n.querySelectorAll("*").forEach(clean); }
    }
  }).observe(document.documentElement, { attributes: true, childList: true, subtree: true });
  document.querySelectorAll("*").forEach(clean);
})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900" suppressHydrationWarning>
        {process.env.NODE_ENV === "development" && (
          <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS }} />
        )}
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
