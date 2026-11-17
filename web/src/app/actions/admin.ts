"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginKey, requireAdmin, technicalUsername, usernameToEmail } from "@/lib/auth";
import { INVITE_DAYS, newInviteToken } from "@/lib/invites";
import { getDict } from "@/lib/i18n/server";
import { errorMessage } from "@/lib/i18n/dictionaries";
import type { FormState } from "./auth";

// ---------- Logements ----------
/** Champs du formulaire logement (adresse facultative, texte libre). */
function apartmentFields(formData: FormData) {
  const opt = (k: string) => String(formData.get(k) ?? "").trim() || null;
  return {
    name: String(formData.get("name") ?? "").trim(),
    street: opt("street"),
    building_number: opt("building_number"),
    floor: opt("floor"),
    unit: opt("unit"),
  };
}

export async function addApartment(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const { t } = await getDict();
  const fields = apartmentFields(formData);
  if (!fields.name) return { error: t.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.from("apartments").insert({ org_id: me.org_id, ...fields });
  if (error) return { error: errorMessage(t, error.message) };
  revalidatePath("/admin", "layout");
  revalidatePath("/app");
  return { ok: t.admin.saved };
}

export async function updateApartment(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const { t } = await getDict();
  const id = String(formData.get("id") ?? "");
  const fields = apartmentFields(formData);
  if (!id || !fields.name) return { error: t.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.from("apartments").update(fields).eq("id", id).eq("org_id", me.org_id);
  if (error) return { error: errorMessage(t, error.message) };
  revalidatePath("/admin", "layout");
  revalidatePath("/app");
  return { ok: t.admin.saved };
}

export async function deleteApartment(id: string): Promise<FormState> {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("apartments").delete().eq("id", id).eq("org_id", me.org_id);
  if (error) {
    const { t } = await getDict();
    return { error: errorMessage(t, error.message) };
  }
  revalidatePath("/admin", "layout");
  return undefined;
}

export async function markDirty(id: string): Promise<FormState> {
  const me = await requireAdmin();
  const supabase = await createClient();
  // On ne touche pas à un logement en cours de nettoyage
  const { error } = await supabase.from("apartments")
    .update({ status: "dirty" }).eq("id", id).eq("org_id", me.org_id).neq("status", "in_progress");
  if (error) {
    const { t } = await getDict();
    return { error: errorMessage(t, error.message) };
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/app");
  return undefined;
}

// ---------- Équipe ----------
/** Personne de l'équipe portant déjà ce nom ? */
async function nameTakenInOrg(orgId: string, key: string) {
  const { data } = await createAdminClient()
    .from("memberships").select("user_id, profiles!inner(login_key)")
    .eq("org_id", orgId).eq("profiles.login_key", key).limit(1);
  return !!data?.length;
}

/** Le patron crée directement un compte pour quelqu'un (sans lien d'invitation). */
export async function addMember(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const { t } = await getDict();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "cleaner";

  const fullName = `${firstName} ${lastName}`.trim();
  const key = loginKey(fullName);
  if (!firstName || !lastName || !key) return { error: t.errors.generic };
  if (password.length < 8) return { error: t.auth.passwordMin };
  if (await nameTakenInOrg(me.org_id, key)) return { error: t.admin.nameTaken };

  const admin = createAdminClient();
  const username = technicalUsername(fullName);
  const { data: created, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username), password, email_confirm: true,
  });
  if (error || !created.user) return { error: t.errors.generic };

  const uid = created.user.id;
  const { error: profErr } = await admin.from("profiles").insert({ id: uid, full_name: fullName, username, login_key: key });
  const { error: memErr } = profErr
    ? { error: profErr }
    : await admin.from("memberships").insert({ user_id: uid, org_id: me.org_id, role, status: "active" });
  if (profErr || memErr) {
    await admin.auth.admin.deleteUser(uid);
    return { error: t.errors.generic };
  }
  revalidatePath("/admin", "layout");
  return { ok: t.admin.saved };
}

/** Vérifie que la personne fait partie de l'entreprise du patron connecté (et n'est pas lui-même). */
async function assertMember(memberId: string) {
  const me = await requireAdmin();
  if (memberId === me.id) throw new Error("forbidden");
  const admin = createAdminClient();
  const { data } = await admin.from("memberships")
    .select("status").eq("user_id", memberId).eq("org_id", me.org_id).maybeSingle();
  if (!data) throw new Error("forbidden");
  return { me, admin };
}

/** Accepter une demande / désactiver / réactiver. */
export async function setMemberStatus(memberId: string, status: "active" | "disabled"): Promise<FormState> {
  const { me, admin } = await assertMember(memberId);
  await admin.from("memberships").update({ status }).eq("user_id", memberId).eq("org_id", me.org_id);
  revalidatePath("/admin", "layout");
  return undefined;
}

/** Refuser une demande en attente (supprime uniquement l'adhésion, pas le compte). */
export async function refuseMember(memberId: string): Promise<FormState> {
  const { me, admin } = await assertMember(memberId);
  await admin.from("memberships").delete()
    .eq("user_id", memberId).eq("org_id", me.org_id).eq("status", "pending");
  revalidatePath("/admin", "layout");
  return undefined;
}

/** Changer le mot de passe — seulement si la personne ne travaille que pour cette entreprise. */
export async function resetMemberPassword(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDict();
  const memberId = String(formData.get("memberId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: t.auth.passwordMin };
  const { admin } = await assertMember(memberId);

  const { count } = await admin.from("memberships")
    .select("org_id", { count: "exact", head: true }).eq("user_id", memberId);
  if ((count ?? 0) > 1) return { error: t.admin.sharedMember };

  const { error } = await admin.auth.admin.updateUserById(memberId, { password });
  if (error) return { error: t.errors.generic };
  return { ok: t.admin.saved };
}

// ---------- Lien d'invitation ----------
export async function regenerateInvite(): Promise<FormState> {
  const me = await requireAdmin();
  const expires = new Date(Date.now() + INVITE_DAYS * 24 * 3600 * 1000).toISOString();
  await createAdminClient().from("organizations")
    .update({ invite_token: newInviteToken(), invite_expires_at: expires }).eq("id", me.org_id);
  revalidatePath("/admin/team");
  return undefined;
}

export async function disableInvite(): Promise<FormState> {
  const me = await requireAdmin();
  await createAdminClient().from("organizations")
    .update({ invite_token: null, invite_expires_at: null }).eq("id", me.org_id);
  revalidatePath("/admin/team");
  return undefined;
}

// ---------- Réglages ----------
export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const { t } = await getDict();
  const name = String(formData.get("name") ?? "").trim();
  const minPhotos = Number(formData.get("minPhotos"));
  const retention = Number(formData.get("retentionDays"));
  const requireApproval = formData.get("requireApproval") === "on";
  if (!name || !(minPhotos >= 1 && minPhotos <= 20) || !(retention >= 1)) return { error: t.errors.generic };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations")
    .update({ name, min_photos: minPhotos, photo_retention_days: retention, require_approval: requireApproval })
    .eq("id", me.org_id);
  if (error) return { error: errorMessage(t, error.message) };
  revalidatePath("/", "layout");
  return { ok: t.admin.saved };
}
