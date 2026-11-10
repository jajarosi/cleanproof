import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const INVITE_DAYS = 7;

export function newInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Buffer.from(bytes).toString("base64url");
}

export type Invite = { id: string; name: string; require_approval: boolean };

/** Entreprise correspondant à un lien d'invitation valide (non expiré), sinon null. */
export async function findValidInvite(token: string): Promise<Invite | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const { data } = await createAdminClient()
    .from("organizations")
    .select("id, name, require_approval")
    .eq("invite_token", token)
    .gt("invite_expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}
