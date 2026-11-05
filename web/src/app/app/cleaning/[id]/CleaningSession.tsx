"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelCleaning, finishCleaning } from "@/app/actions/cleaning";
import { useI18n } from "@/lib/i18n/client";
import { errorMessage, fmt } from "@/lib/i18n/dictionaries";
import { LocalTime } from "@/components/LocalTime";
import type { SignedPhoto } from "@/lib/photos";

const MAX_SIDE = 1600;

/**
 * Redimensionne la photo (envoi rapide même en 4G) et incruste en bas
 * le nom du logement, l'agent et l'heure — utile si la photo est montrée à un client.
 * L'heure qui fait foi reste celle enregistrée par le serveur.
 */
async function preparePhoto(file: File, caption: string): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const fontSize = Math.max(14, Math.round(w / 45));
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const pad = fontSize * 0.6;
  const textW = ctx.measureText(caption).width;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, h - fontSize - pad * 2, Math.min(w, textW + pad * 2), fontSize + pad * 2);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "bottom";
  ctx.fillText(caption, pad, h - pad);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.82),
  );
}

export function CleaningSession(props: {
  cleaningId: string;
  orgId: string;
  apartmentName: string;
  cleanerName: string;
  startedAt: string;
  minPhotos: number;
  photos: SignedPhoto[];
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();

  const missing = Math.max(0, props.minPhotos - props.photos.length);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createClient();
    const list = Array.from(files);
    setUploading(list.length);
    try {
      for (const file of list) {
        const caption = `${props.apartmentName} · ${props.cleanerName} · ${new Date().toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}`;
        const blob = await preparePhoto(file, caption);
        const path = `${props.orgId}/${props.cleaningId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("photos").upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (upErr) throw upErr;
        const { error: rpcErr } = await supabase.rpc("add_cleaning_photo", {
          p_cleaning_id: props.cleaningId,
          p_path: path,
        });
        if (rpcErr) throw rpcErr;
        setUploading((n) => n - 1);
      }
    } catch (e) {
      setError(errorMessage(t, (e as Error).message));
    } finally {
      setUploading(0);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{props.apartmentName}</h1>
        <p className="text-sm text-slate-500">
          {t.cleaner.startedAt} <LocalTime iso={props.startedAt} mode="time" />
        </p>
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">
          {t.cleaner.photos} ({props.photos.length}/{props.minPhotos})
        </h2>
        <p className="text-sm text-slate-600">{fmt(t.cleaner.photosHelp, { n: props.minPhotos })}</p>

        {props.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {props.photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-lg bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                  <LocalTime iso={p.created_at} mode="time" />
                </span>
              </a>
            ))}
          </div>
        )}

        {/* capture="environment" ouvre directement l'appareil photo sur mobile (pas la galerie) */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <button
          type="button"
          className="btn-secondary w-full py-4 text-base"
          disabled={uploading > 0 || pending}
          onClick={() => inputRef.current?.click()}
        >
          {uploading > 0 ? t.cleaner.uploading : `📷 ${t.cleaner.takePhoto}`}
        </button>
      </section>

      <section className="card space-y-2 p-4">
        <label className="label" htmlFor="comment">{t.cleaner.comment}</label>
        <textarea
          id="comment"
          rows={3}
          className="input"
          placeholder={t.cleaner.commentPlaceholder}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </section>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="button"
        className="btn-primary w-full py-4 text-base"
        disabled={missing > 0 || uploading > 0 || pending}
        onClick={() =>
          start(async () => {
            const res = await finishCleaning(props.cleaningId, comment);
            if (res?.error) setError(res.error);
          })
        }
      >
        {missing > 0 ? fmt(t.cleaner.missingPhotos, { n: missing }) : `✓ ${t.cleaner.finish}`}
      </button>

      <button
        type="button"
        className="w-full py-2 text-sm text-slate-500 underline"
        disabled={pending}
        onClick={() => {
          if (!confirm(t.cleaner.confirmCancel)) return;
          start(async () => {
            const res = await cancelCleaning(props.cleaningId);
            if (res?.error) setError(res.error);
          });
        }}
      >
        {t.cleaner.cancelCleaning}
      </button>
    </div>
  );
}
