import Image from "next/image";

interface Props {
  className?: string;
}

// /public/heyriz-transparent.png is the real lockup (icon + "Heyriz" wordmark)
// with the white background removed, 1300x422 — keep that intrinsic ratio so
// callers only need to set a width via className.
export function BrandLogo({ className }: Props) {
  return (
    <Image
      src="/heyriz-transparent.png"
      alt="Heyriz"
      width={1300}
      height={422}
      priority
      className={`h-auto ${className ?? "w-28"}`}
    />
  );
}
