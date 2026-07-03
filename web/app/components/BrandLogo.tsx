import Image from "next/image";

interface Props {
  className?: string;
}

// /public/rizly-transparent.png is the real lockup (icon + "rizly" wordmark)
// with the white background removed, 1300x422 — keep that intrinsic ratio so
// callers only need to set a width via className.
export function BrandLogo({ className }: Props) {
  return (
    <Image
      src="/rizly-transparent.png"
      alt="rizly"
      width={1300}
      height={422}
      priority
      className={`h-auto ${className ?? "w-28"}`}
    />
  );
}
