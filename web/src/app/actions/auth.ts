"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginKey, profileEmail } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { LANGS } from "@/lib/i18n/dictionaries";

export type FormState = { error?: string; ok?: string } | undefined;

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDict();
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: t.auth.invalid };

  // Email → connexion directe. Sinon "Prénom Nom" → on cherche les comptes portant ce nom
  // (un par entreprise au maximum) et on essaie le mot de passe sur chacun.
  let emails: string[];
  if (identifier.includes("@")) {
    emails = [identifier];
  } else {
    const { data: candidates } = await createAdminClient()
      .from("profiles").select("username").eq("login_key", loginKey(identifier)).limit(10);
    emails = (candidates ?? []).map((c) => profileEmail(c.username));
  }

  const supabase = await createClient();
  let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null = null;
  for (const email of emails) {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (!res.error && res.data.user) { data = res.data; break; }
  }
  if (!data?.user) return { error: t.auth.invalid };

  const { data: profile } = await supabase
    .from("profiles").select("role, active").eq("id", data.user.id).single();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { error: t.auth.disabled };
  }
  redirect(profile.role === "admin" ? "/admin" : "/app");
}

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDict();
  const company = String(formData.get("company") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!company || !fullName || !email.includes("@")) return { error: t.errors.generic };
  if (password.length < 8) return { error: t.auth.passwordMin };

  const admin = createAdminClient();
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr || !created.user) return { error: userErr?.message ?? t.errors.generic };

  const { data: org, error: orgErr } = await admin
    .from("organizations").insert({ name: company }).select("id").single();
  const { error: profErr } = org
    ? await admin.from("profiles").insert({
        id: created.user.id, org_id: org.id, role: "admin", full_name: fullName, username: email,
        login_key: loginKey(fullName),
      })
    : { error: orgErr };

  if (orgErr || profErr) {
    // Annule tout pour ne pas laisser de compte orphelin
    if (org) await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: t.errors.generic };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setLang(lang: string) {
  if (!(LANGS as readonly string[]).includes(lang)) return;
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
