import Image from "next/image";

export function ScreenshotPanel({
  src,
  width,
  height,
  alt,
  caption,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
}) {
  return (
    <div className="flex w-full rounded-[2rem] bg-[linear-gradient(135deg,#fff7f3_0%,#ffd9ce_42%,#f7b6c6_100%)] p-6 shadow-[0_42px_110px_-86px_rgba(244,114,98,0.56)] md:p-8">
      <div className="relative w-full overflow-hidden rounded-2xl bg-white" style={{ aspectRatio: `${width} / ${height}` }}>
        <Image
          src={src}
          alt={alt}
          fill
          quality={100}
          className="object-cover object-left-top"
          sizes="(min-width: 1024px) 700px, 100vw"
        />
        {caption ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5">
            <p className="max-w-md text-sm font-normal leading-6 text-white">{caption}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
