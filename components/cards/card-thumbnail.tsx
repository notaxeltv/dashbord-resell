"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { cardImageSrc } from "@/lib/card-image";

/**
 * Miniatura dell'immagine di una carta. Al passaggio del mouse mostra
 * un'anteprima ingrandita (solo se l'immagine è disponibile).
 */
export function CardThumbnail({
  imageUrl,
  name,
  className,
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
}) {
  const src = cardImageSrc(imageUrl);
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ top: number; left: number } | null>(
    null,
  );

  function showPreview() {
    if (!src || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const previewWidth = 220;
    const previewHeight = 308;
    const gap = 12;
    const spaceRight = window.innerWidth - rect.right;
    const left =
      spaceRight >= previewWidth + gap
        ? rect.right + gap
        : Math.max(8, rect.left - previewWidth - gap);
    const top = Math.min(
      Math.max(8, rect.top + rect.height / 2 - previewHeight / 2),
      window.innerHeight - previewHeight - 8,
    );
    setPreview({ top, left });
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={showPreview}
        onMouseLeave={() => setPreview(null)}
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted transition duration-200",
          src &&
            "cursor-zoom-in hover:z-10 hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-fuchsia-400/60",
          className,
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {preview &&
        src &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[200] animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ top: preview.top, left: preview.left }}
          >
            <div className="overflow-hidden rounded-xl border border-fuchsia-400/40 bg-[#170821] shadow-2xl shadow-fuchsia-950/40 ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={name}
                className="h-[308px] w-[220px] object-cover"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
