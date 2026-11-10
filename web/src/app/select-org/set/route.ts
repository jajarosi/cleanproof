import { NextResponse, type NextRequest } from "next/server";
import { myMemberships } from "@/lib/auth";
import { setOrgCookie } from "@/lib/session";

/** Enregistre l'entreprise choisie (si la personne en est bien membre active) puis redirige. */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org");
  const membership = (await myMemberships()).find((m) => m.org_id === orgId && m.status === "active");
  if (!membership) return NextResponse.redirect(new URL("/select-org", request.url));

  await setOrgCookie(membership.org_id);
  return NextResponse.redirect(new URL(membership.role === "admin" ? "/admin" : "/app", request.url));
}
