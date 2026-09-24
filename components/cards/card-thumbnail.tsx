"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { cardImageSrc } from "@/lib/card-image";

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = 336;
const GAP = 16;

function previewPosition(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const spaceRight = window.innerWidth - rect.right;
  const left =
    spaceRight >= PREVIEW_WIDTH + GAP
      ? rect.right + GAP
      : Math.max(8, rect.left - PREVIEW_WIDTH - GAP);
  const top = Math.min(
    Math.max(8, rect.top + rect.height / 2 - PREVIEW_HEIGHT / 2),
    window.innerHeight - PREVIEW_HEIGHT - 8,
  );
  return { top, left };
}

/**
 * Miniatura dell'immagine di una carta. Al passaggio del mouse mostra
 * un'anteprima ingrandita nel viewport (fuori da tabelle con overflow).
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
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState<{ top: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!preview) return;
    function hide() {
      setPreview(null);
    }
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [preview]);

  function show(el: HTMLElement) {
    if (!src) return;
    setPreview(previewPosition(el));
  }

  return (
    <>
      <div
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          show(event.currentTarget);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "touch" || !src) return;
          show(event.currentTarget);
        }}
        onPointerLeave={() => setPreview(null)}
        className={cn(
          "relative flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted",
          src && "cursor-zoom-in",
          className,
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            draggable={false}
            className="pointer-events-none h-full w-full object-cover"
          />
        ) : (
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {mounted &&
        preview &&
        src &&
        createPortal(
          <div
            role="presentation"
            className="pointer-events-none fixed z-[9999]"
            style={{
              top: preview.top,
              left: preview.left,
              width: PREVIEW_WIDTH,
              height: PREVIEW_HEIGHT,
            }}
          >
            <div className="h-full w-full overflow-hidden rounded-xl border-2 border-fuchsia-400 bg-[#170821] shadow-2xl shadow-black/50 ring-1 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
