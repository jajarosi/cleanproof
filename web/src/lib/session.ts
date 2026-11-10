import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginKey, ORG_COOKIE, profileEmail } from "@/lib/auth";

const ORG_COOKIE_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax" as const };

export async function setOrgCookie(orgId: string) {
  (await cookies()).set(ORG_COOKIE, orgId, ORG_COOKIE_OPTS);
}

/**
 * Connecte l'utilisateur à partir d'un email ou d'un "Prénom Nom".
 * Pour un nom, on essaie le mot de passe sur chaque compte portant ce nom.
 * Retourne l'id de l'utilisateur connecté, ou null.
 */
export async function signInWithIdentifier(identifier: string, password: string): Promise<string | null> {
  const id = identifier.trim().toLowerCase();
  if (!id || !password) return null;

  let emails: string[];
  if (id.includes("@")) {
    emails = [id];
  } else {
    const key = loginKey(id);
    if (!key) return null;
    const { data } = await createAdminClient()
      .from("profiles").select("username").eq("login_key", key).limit(20);
    emails = (data ?? []).map((c) => profileEmail(c.username));
  }

  const supabase = await createClient();
  for (const email of emails) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) return data.user.id;
  }
  return null;
}

