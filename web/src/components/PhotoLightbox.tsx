"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { LocalTime } from "@/components/LocalTime";
import type { SignedPhoto } from "@/lib/photos";

/** Visionneuse plein écran : flèches / clavier / glisser du doigt, Échap pour fermer. */
export function PhotoLightbox({
  photos, index, onIndex, onClose,
}: {
  photos: SignedPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const touchX = useRef<number | null>(null);
  const n = photos.length;
  const go = (d: number) => onIndex((index + d + n) % n);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex((index + 1) % n);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, n, onIndex, onClose]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50 && n > 1) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center gap-3 p-3 text-sm" onClick={(e) => e.stopPropagation()}>
        <span className="font-semibold">{index + 1}/{n}</span>
        <span className="text-white/70"><LocalTime iso={photo.created_at} /></span>
        <button type="button" onClick={onClose} aria-label={t.common.close}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl hover:bg-white/20">
          ×
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        {n > 1 && (
          <>
            <button type="button" aria-label={t.common.previous}
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl hover:bg-white/20 sm:flex">
              ‹
            </button>
            <button type="button" aria-label={t.common.next}
              onClick={(e) => { e.stopPropagation(); go(1); }}
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl hover:bg-white/20 sm:flex">
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Grille de miniatures qui ouvre la visionneuse au clic. */
export function PhotoGrid({ photos, className }: { photos: SignedPhoto[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className={className}>
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setOpen(i)}
            className="relative block aspect-square overflow-hidden rounded-lg bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
              <LocalTime iso={p.created_at} mode="time" />
            </span>
          </button>
        ))}
      </div>
      {open !== null && <PhotoLightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}
