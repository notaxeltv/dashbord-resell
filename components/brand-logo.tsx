import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  size = 40,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Dark Ghost Cards"
      width={size}
      height={size}
      priority={priority}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}
