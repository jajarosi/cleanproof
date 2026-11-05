"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { errorMessage } from "@/lib/i18n/dictionaries";
import type { FormState } from "./auth";

export async function startCleaning(apartmentId: string): Promise<FormState> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_cleaning", { p_apartment_id: apartmentId });
  if (error) {
    const { t } = await getDict();
    return { error: errorMessage(t, error.message) };
  }
  redirect(`/app/cleaning/${data}`);
}

export async function finishCleaning(cleaningId: string, comment: string): Promise<FormState> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_cleaning", { p_cleaning_id: cleaningId, p_comment: comment });
  if (error) {
    const { t } = await getDict();
    return { error: errorMessage(t, error.message) };
  }
  revalidatePath("/app");
  redirect("/app?done=1");
}

export async function cancelCleaning(cleaningId: string): Promise<FormState> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_cleaning", { p_cleaning_id: cleaningId });
  if (error) {
    const { t } = await getDict();
    return { error: errorMessage(t, error.message) };
  }
  redirect(profile.role === "admin" ? "/admin" : "/app");
}
