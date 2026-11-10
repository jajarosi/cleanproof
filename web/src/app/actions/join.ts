"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginKey, requireUserId, technicalUsername, usernameToEmail } from "@/lib/auth";
import { setOrgCookie, signInWithIdentifier } from "@/lib/session";
import { findValidInvite, type Invite } from "@/lib/invites";
import { getDict } from "@/lib/i18n/server";
import type { FormState } from "./auth";

/** Ajoute la personne à l'entreprise (en attente ou directement active) puis redirige. */
async function addMembershipAndRedirect(uid: string, org: Invite): Promise<never> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("memberships").select("status").eq("user_id", uid).eq("org_id", org.id).maybeSingle();

  let status = existing?.status as "pending" | "active" | "disabled" | undefined;
  if (!status) {
    status = org.require_approval ? "pending" : "active";
    await admin.from("memberships").insert({ user_id: uid, org_id: org.id, role: "cleaner", status });
  }

  if (status === "active") {
    await setOrgCookie(org.id);
    redirect("/select-org/set?org=" + org.id);
  }
  redirect(status === "pending" ? "/pending" : "/select-org");
}

/** Nouvelle personne : création du compte via le lien d'invitation. */
export async function joinWithNewAccount(token: string, _: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDict();
  const org = await findValidInvite(token);
  if (!org) return { error: t.join.invalid };

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = `${firstName} ${lastName}`.trim();
  const key = loginKey(fullName);
  if (!firstName || !lastName || !key) return { error: t.errors.generic };
  if (password.length < 8) return { error: t.auth.passwordMin };

  // Même nom + même mot de passe qu'un compte existant → c'est la même personne
  const existingUid = await signInWithIdentifier(fullName, password);
  if (existingUid) return addMembershipAndRedirect(existingUid, org);

  const admin = createAdminClient();
  const { data: sameName } = await admin
    .from("memberships").select("user_id, profiles!inner(login_key)")
    .eq("org_id", org.id).eq("profiles.login_key", key).limit(1);
  if (sameName?.length) return { error: t.join.nameTaken };

  const username = technicalUsername(fullName);
  const email = usernameToEmail(username);
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) return { error: t.errors.generic };

  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id, full_name: fullName, username, login_key: key,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: t.errors.generic };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  return addMembershipAndRedirect(created.user.id, org);
}

/** Personne déjà connectée (compte existant) : rejoint une entreprise de plus. */
export async function joinAsCurrentUser(token: string): Promise<FormState> {
  const uid = await requireUserId();
  const org = await findValidInvite(token);
  if (!org) {
    const { t } = await getDict();
    return { error: t.join.invalid };
  }
  return addMembershipAndRedirect(uid, org);
}
