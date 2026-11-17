"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "install-prompt-dismissed";

/**
 * Propose d'installer l'app sur l'écran d'accueil.
 * Android/Chrome : bouton natif. iPhone (Safari) : pas d'API, on explique le geste.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(DISMISS_KEY); } catch { /* stockage bloqué */ }
    if (standalone || dismissed) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      // Détection navigateur possible seulement après hydratation
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIos(true);
      setHidden(false);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* stockage bloqué */ }
  };

  return (
    <div className="card flex items-start gap-3 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold">{t.cleaner.installTitle}</p>
        <p className="text-sm text-slate-600">{ios && !deferred ? t.cleaner.installIos : t.cleaner.installText}</p>
        <div className="flex gap-2">
          {deferred && (
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                setDeferred(null);
                setHidden(true);
              }}
            >
              {t.cleaner.installButton}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={dismiss}>{t.cleaner.later}</button>
        </div>
      </div>
    </div>
  );
}
