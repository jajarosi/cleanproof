"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cancelCleaning, deletePhoto, finishCleaning } from "@/app/actions/cleaning";
import { useI18n } from "@/lib/i18n/client";
import { errorMessage, fmt } from "@/lib/i18n/dictionaries";
import { LocalTime } from "@/components/LocalTime";
import { PhotoLightbox } from "@/components/PhotoLightbox";
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

const RETRY_DELAYS_MS = [1000, 3000, 6000];

/** Réessaie automatiquement (réseau instable : cave, 4G faible…). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= RETRY_DELAYS_MS.length) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

/** Photo prise sur le téléphone, pas encore enregistrée côté serveur. */
type Upload = {
  key: string;
  file: File;
  caption: string;
  preview: string;
  path: string;
  state: "uploading" | "failed" | "done";
};

const draftKey = (id: string) => `cleaning-draft:${id}`;
function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function CleaningSession(props: {
  cleaningId: string;
  orgId: string;
  apartmentName: string;
  address: string;
  cleanerName: string;
  startedAt: string;
  minPhotos: number;
  photos: SignedPhoto[];
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();

  // Brouillon du commentaire : survit à la fermeture de l'app / au verrouillage du téléphone
  useEffect(() => {
    const saved = storage()?.getItem(draftKey(props.cleaningId));
    // Lecture après hydratation (localStorage n'existe pas côté serveur)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setComment(saved);
  }, [props.cleaningId]);
  function saveDraft(value: string) {
    const s = storage();
    try {
      if (value) s?.setItem(draftKey(props.cleaningId), value);
      else s?.removeItem(draftKey(props.cleaningId));
    } catch { /* stockage plein ou bloqué : pas grave */ }
  }
  function onComment(value: string) {
    setComment(value);
    saveDraft(value);
  }

  // Les photos envoyées arrivent dans la liste serveur : on retire alors leur aperçu local
  const [prevPhotos, setPrevPhotos] = useState(props.photos);
  if (props.photos !== prevPhotos) {
    setPrevPhotos(props.photos);
    if (uploads.some((u) => u.state === "done")) setUploads(uploads.filter((u) => u.state !== "done"));
  }
  // Libère la mémoire des aperçus retirés
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const current = new Set(uploads.map((u) => u.preview));
    previews.current.forEach((url) => { if (!current.has(url)) URL.revokeObjectURL(url); });
    previews.current = current;
  }, [uploads]);

  const active = uploads.filter((u) => u.state === "uploading");
  const failed = uploads.filter((u) => u.state === "failed");
  const busy = active.length > 0 || deletingId !== null;
  const missing = Math.max(0, props.minPhotos - props.photos.length);

  const setState = (key: string, state: Upload["state"]) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, state } : u)));

  async function send(u: Upload) {
    setState(u.key, "uploading");
    const supabase = createClient();
    try {
      const blob = await preparePhoto(u.file, u.caption);
      await withRetry(async () => {
        const { error: upErr } = await supabase.storage.from("photos").upload(u.path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
        // Déjà envoyé lors d'un essai précédent (réponse perdue) : on continue
        if (upErr && !/exists|duplicate/i.test(upErr.message)) throw upErr;
      });
      await withRetry(async () => {
        const { error: rpcErr } = await supabase.rpc("add_cleaning_photo", {
          p_cleaning_id: props.cleaningId,
          p_path: u.path,
        });
        if (rpcErr && !/duplicate/i.test(rpcErr.message)) throw rpcErr;
      });
      setState(u.key, "done");
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message ?? "";
      // Ménage terminé/annulé ailleurs : inutile de réessayer
      if (msg.includes("cleaning_not_found")) setError(errorMessage(t, msg));
      setState(u.key, "failed");
    }
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const stamp = new Date().toLocaleString(lang === "fr" ? "fr-FR" : "en-GB");
    const added: Upload[] = Array.from(files).map((file) => ({
      key: crypto.randomUUID(),
      file,
      caption: `${props.apartmentName} · ${props.cleanerName} · ${stamp}`,
      preview: URL.createObjectURL(file),
      path: `${props.orgId}/${props.cleaningId}/${crypto.randomUUID()}.jpg`,
      state: "uploading",
    }));
    setUploads((list) => [...list, ...added]);
    if (inputRef.current) inputRef.current.value = "";
    // Une à la fois : moins de risques d'échec sur une connexion faible
    (async () => { for (const u of added) await send(u); })();
  }

  async function retryFailed() {
    setError(null);
    for (const u of failed) await send(u);
  }

  async function onDelete(photoId: string) {
    if (!confirm(t.cleaner.confirmDeletePhoto)) return;
    setError(null);
    setDeletingId(photoId);
    const res = await deletePhoto(photoId);
    if (res?.error) setError(res.error);
    router.refresh();
    setDeletingId(null);
  }

  const total = props.photos.length + uploads.filter((u) => u.state !== "done").length;
  const sentInBatch = uploads.filter((u) => u.state === "done").length;
  const batchSize = active.length + sentInBatch;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{props.apartmentName}</h1>
        {props.address && <p className="text-slate-600">📍 {props.address}</p>}
        <p className="text-sm text-slate-500">
          {t.cleaner.startedAt} <LocalTime iso={props.startedAt} mode="time" />
        </p>
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">
          {t.cleaner.photos} ({props.photos.length}/{props.minPhotos})
        </h2>
        <p className="text-sm text-slate-600">{fmt(t.cleaner.photosHelp, { n: props.minPhotos })}</p>

        {total > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {props.photos.map((p, i) => (
              <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                <button type="button" onClick={() => setViewing(i)} className="block h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className={`h-full w-full object-cover ${deletingId === p.id ? "opacity-40" : ""}`} />
                </button>
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                  <LocalTime iso={p.created_at} mode="time" />
                </span>
                <button
                  type="button"
                  aria-label={t.cleaner.deletePhoto}
                  title={t.cleaner.deletePhoto}
                  disabled={busy || pending}
                  onClick={() => onDelete(p.id)}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-lg leading-none text-white disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
            {uploads.filter((u) => u.state !== "done").map((u) => (
              <div key={u.key} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.preview} alt="" className="h-full w-full object-cover opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {u.state === "uploading" ? (
                    <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
                  ) : (
                    <button type="button" onClick={() => send(u)}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                      ↻ {t.cleaner.retry}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewing !== null && props.photos[viewing] && (
          <PhotoLightbox photos={props.photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
        )}

        {failed.length > 0 && active.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <p className="flex-1">{fmt(t.cleaner.uploadFailed, { n: failed.length })}</p>
            <button type="button" className="btn-secondary shrink-0" onClick={retryFailed}>{t.cleaner.retry}</button>
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
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {active.length > 0
            ? fmt(t.cleaner.uploadProgress, { done: sentInBatch, total: batchSize })
            : `📷 ${t.cleaner.takePhoto}`}
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
          onChange={(e) => onComment(e.target.value)}
        />
      </section>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="button"
        className="btn-primary w-full py-4 text-base"
        disabled={missing > 0 || busy || failed.length > 0 || pending}
        onClick={() =>
          start(async () => {
            // La réussite redirige (le code après n'est pas exécuté) : on efface le brouillon avant
            saveDraft("");
            const res = await finishCleaning(props.cleaningId, comment);
            if (res?.error) { setError(res.error); saveDraft(comment); }
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
            saveDraft("");
            const res = await cancelCleaning(props.cleaningId);
            if (res?.error) { setError(res.error); saveDraft(comment); }
          });
        }}
      >
        {t.cleaner.cancelCleaning}
      </button>
    </div>
  );
}
