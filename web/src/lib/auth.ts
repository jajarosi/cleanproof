import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  org_id: string;
  role: "admin" | "cleaner";
  full_name: string;
  username: string;
  active: boolean;
};

/** Domaine technique des emails internes (les agents se connectent avec un simple identifiant). */
export const STAFF_EMAIL_DOMAIN = "staff.cleaner.local";
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
/** Email de connexion d'un profil : les responsables ont un vrai email, les agents un email technique. */
export const profileEmail = (username: string) => (username.includes("@") ? username : usernameToEmail(username));

/**
 * Clé de connexion à partir du nom : "Hélène  DUPONT" == "dupont helene".
 * Minuscules, sans accents, mots triés (l'ordre prénom/nom n'a pas d'importance).
 */
export function loginKey(name: string) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter(Boolean).sort().join(" ");
}

/** Identifiant technique unique (invisible pour l'utilisateur). */
export function technicalUsername(name: string) {
  const slug = loginKey(name).replace(/ /g, ".").slice(0, 40) || "user";
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Profil de l'utilisateur connecté, ou redirection vers /login. */
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role, full_name, username, active")
    .eq("id", uid)
    .single<Profile>();

  if (!profile || !profile.active) redirect("/login?disabled=1");
  return profile;
});

export async function requireAdmin(): Promise<Profile> {
  const p = await requireProfile();
  if (p.role !== "admin") redirect("/app");
  return p;
}
