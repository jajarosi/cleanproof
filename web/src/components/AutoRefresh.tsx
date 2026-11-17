"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Recharge les données de la page régulièrement et dès que l'app revient
 * au premier plan (téléphone déverrouillé, retour sur l'onglet…).
 */
export function AutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [router, intervalMs]);
  return null;
}
