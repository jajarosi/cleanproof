import "server-only";
import { cookies, headers } from "next/headers";
import { dictionaries, LANGS, type Lang } from "./dictionaries";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  if (c && (LANGS as readonly string[]).includes(c)) return c as Lang;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("en") ? "en" : "fr";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}
