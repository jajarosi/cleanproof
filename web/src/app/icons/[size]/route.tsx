import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((s) => ({ size: String(s) }));
}

/**
 * Icônes PNG de l'app (écran d'accueil iPhone/Android), générées depuis le logo.
 * Fond plein bord à bord : iOS arrondit lui-même, Android applique son masque.
 */
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!(SIZES as readonly number[]).includes(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f766e" }}>
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 64 64">
          <path d="M14 34l12 12 24-27" fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
