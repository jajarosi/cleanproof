"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginKey, ORG_COOKIE, safeNext } from "@/lib/auth";
import { setOrgCookie, signInWithIdentifier } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { LANGS } from "@/lib/i18n/dictionaries";

export type FormState = { error?: string; ok?: string } | undefined;

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDict();
  const uid = await signInWithIdentifier(
    String(formData.get("identifier") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (!uid) return { error: t.auth.invalid };
  redirect(safeNext(formData.get("next")) ?? "/select-org");
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
  if (userErr || !created.user) {
    console.error("[signup] createUser failed:", userErr);
    return { error: userErr?.message?.includes("already") ? t.auth.emailTaken : t.errors.generic };
  }
  const uid = created.user.id;

  const { data: org, error: orgErr } = await admin.from("organizations").insert({ name: company }).select("id").single();
  const { error: profErr } = await admin.from("profiles").insert({
    id: uid, full_name: fullName, username: email, login_key: loginKey(fullName),
  });
  const { error: memErr } = org
    ? await admin.from("memberships").insert({ user_id: uid, org_id: org.id, role: "admin", status: "active" })
    : { error: true };

  if (!org || profErr || memErr) {
    console.error("[signup] setup failed:", { orgErr, profErr, memErr });
    // Annule tout pour ne pas laisser de compte orphelin
    if (org) await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(uid);
    return { error: t.errors.generic };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  await setOrgCookie(org.id);
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ORG_COOKIE);
  redirect("/login");
}

export async function setLang(lang: string) {
  if (!(LANGS as readonly string[]).includes(lang)) return;
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
