import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "cleaner";
export type MembershipStatus = "pending" | "active" | "disabled";

/** Utilisateur connecté + entreprise sélectionnée. */
export type Profile = {
  id: string;
  full_name: string;
  username: string;
  org_id: string;
  org_name: string;
  role: Role;
  /** Nombre d'entreprises actives de la personne (pour afficher "changer d'entreprise"). */
  org_count: number;
};

/** Cookie contenant l'entreprise choisie à la connexion. */
export const ORG_COOKIE = "org";

/** Domaine technique des emails internes (les agents se connectent avec leur nom). */
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
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter(Boolean).sort().join(" ");
}

/** Identifiant technique unique (invisible pour l'utilisateur). */
export function technicalUsername(name: string) {
  const slug = loginKey(name).replace(/ /g, ".").slice(0, 40) || "user";
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Id de l'utilisateur connecté, ou redirection vers /login. */
export const requireUserId = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) redirect("/login");
  return uid;
});

export type MembershipRow = {
  org_id: string;
  role: Role;
  status: MembershipStatus;
  organizations: { name: string } | null;
};

/** Toutes les adhésions de l'utilisateur connecté. */
export const myMemberships = cache(async (): Promise<MembershipRow[]> => {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("org_id, role, status, organizations(name)")
    .eq("user_id", uid);
  return (data ?? []) as unknown as MembershipRow[];
});

/**
 * Profil + entreprise sélectionnée (cookie). Si aucune entreprise valide
 * n'est sélectionnée → page de choix d'entreprise.
 */
export const requireProfile = cache(async (): Promise<Profile> => {
  const uid = await requireUserId();
  const supabase = await createClient();
  const [{ data: profile }, memberships, cookieStore] = await Promise.all([
    supabase.from("profiles").select("id, full_name, username").eq("id", uid).single(),
    myMemberships(),
    cookies(),
  ]);
  if (!profile) redirect("/login");

  const active = memberships.filter((m) => m.status === "active");
  const selected = active.find((m) => m.org_id === cookieStore.get(ORG_COOKIE)?.value);
  if (!selected) redirect("/select-org");

  return {
    ...profile,
    org_id: selected.org_id,
    org_name: selected.organizations?.name ?? "",
    role: selected.role,
    org_count: active.length,
  };
});

export async function requireAdmin(): Promise<Profile> {
  const p = await requireProfile();
  if (p.role !== "admin") redirect("/app");
  return p;
}

/** N'accepte que des chemins internes (évite les redirections vers un site externe). */
export function safeNext(next: unknown): string | null {
  return typeof next === "string" && /^\/[a-zA-Z0-9/_-]*$/.test(next) && !next.startsWith("//") ? next : null;
}
