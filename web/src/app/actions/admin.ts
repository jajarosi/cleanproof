"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginKey, requireAdmin, technicalUsername, usernameToEmail } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { errorMessage } from "@/lib/i18n/dictionaries";
import type { FormState } from "./auth";

// ---------- Logements ----------
export async function addApartment(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const { t } = await getDict();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.from("apartments").insert({ org_id: me.org_id, name });
  if (error) return { error: errorMessage(t, error.message) };
  revalidatePath("/admin", "layout");
  return { ok: t.admin.saved };
}

export async function renameApartment(id: string, name: string): Promise<FormState> {
  await requireAdmin();
  const { t } = await getDict();
  if (!name.trim()) return { error: t.errors.generic };
  const supabase = await createClient();
  const { error } = await supabase.from("apartments").update({ name: name.trim() }).eq("id", id);
  if (error) return { error: errorMessage(t, error.message) };
  revalidatePath("/admin", "layout");
  return { ok: t.admin.saved };
}

export async function deleteApartment(id: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("apartments").delete().eq("id", id);
  if (error) {
    const { t } = await getDict();
    return { error: errorMessage(t, error.message) };
  }
  revalidatePath("/admin", "layout");
}

export async function markDirty(id: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  // On ne touche pas à un logement en cours de nettoyage
  const { error } = await supabase.from("apartments")
    .update({ status: "dirty" }).eq("id", id).neq("status", "in_progress");
  if (error) {
    const { t } = await getDict();
    return { error: errorMessage(t, error.message) };
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/app");
}

// ---------- Équipe ----------
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

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles")
    .select("id").eq("org_id", me.org_id).eq("login_key", key).maybeSingle();
  if (existing) return { error: t.admin.nameTaken };

  const username = technicalUsername(fullName);
  const { data: created, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username), password, email_confirm: true,
  });
  if (error || !created.user) return { error: t.errors.generic };

  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id, org_id: me.org_id, role, full_name: fullName, username, login_key: key,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profErr.message.includes("duplicate") ? t.admin.nameTaken : t.errors.generic };
  }
  revalidatePath("/admin/team");
  return { ok: t.admin.saved };
}

/** Vérifie que le membre ciblé appartient bien à l'entreprise de l'admin connecté. */
async function assertSameOrg(memberId: string) {
  const me = await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("org_id").eq("id", memberId).single();
  if (!data || data.org_id !== me.org_id || memberId === me.id) throw new Error("forbidden");
  return admin;
}

export async function setMemberActive(memberId: string, active: boolean): Promise<FormState> {
  const admin = await assertSameOrg(memberId);
  await admin.from("profiles").update({ active }).eq("id", memberId);
  await admin.auth.admin.updateUserById(memberId, { ban_duration: active ? "none" : "876000h" });
  revalidatePath("/admin/team");
  return undefined;
}

export async function resetMemberPassword(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDict();
  const memberId = String(formData.get("memberId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: t.auth.passwordMin };
  const admin = await assertSameOrg(memberId);
  const { error } = await admin.auth.admin.updateUserById(memberId, { password });
  if (error) return { error: t.errors.generic };
  return { ok: t.admin.saved };
}

// ---------- Réglages ----------
export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const { t } = await getDict();
  const name = String(formData.get("name") ?? "").trim();
  const minPhotos = Number(formData.get("minPhotos"));
  const retention = Number(formData.get("retentionDays"));
  if (!name || !(minPhotos >= 1 && minPhotos <= 20) || !(retention >= 1)) return { error: t.errors.generic };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations")
    .update({ name, min_photos: minPhotos, photo_retention_days: retention }).eq("id", me.org_id);
  if (error) return { error: errorMessage(t, error.message) };
  revalidatePath("/admin", "layout");
  return { ok: t.admin.saved };
}
