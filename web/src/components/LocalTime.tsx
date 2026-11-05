"use client";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/client";

const noop = () => () => {};

/** Affiche une date dans le fuseau horaire de l'appareil (rendu côté client uniquement). */
export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "time" }) {
  const { lang } = useI18n();
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <span className="opacity-0">--</span>;
  const d = new Date(iso);
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const text =
    mode === "time"
      ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleString(locale, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return <time dateTime={iso} title={d.toLocaleString(locale)}>{text}</time>;
}

export function Duration({ from, to }: { from: string; to: string }) {
  const min = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  const h = Math.floor(min / 60);
  return <span>{h > 0 ? `${h} h ${String(min % 60).padStart(2, "0")}` : `${min} min`}</span>;
}
