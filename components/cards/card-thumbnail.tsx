import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Miniatura dell'immagine di una carta (recuperata da CardTrader). Mostra
 * un placeholder quando l'immagine non è ancora stata trovata/salvata.
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
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted",
        className,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}
