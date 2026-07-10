"use client";

export function PhoneVideo({
  src,
  width,
  height,
  className = "",
  rate = 1.75,
}: {
  src: string;
  width: number;
  height: number;
  className?: string;
  rate?: number;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-black shadow-[0_30px_80px_-40px_rgba(32,21,28,0.5)] ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        ref={(el) => {
          if (el) el.playbackRate = rate;
        }}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
