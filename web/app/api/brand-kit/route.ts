import { ZipArchive } from "archiver";
import { createReadStream } from "fs";
import { join } from "path";
import { PassThrough } from "stream";
import { NextResponse } from "next/server";

const ASSETS = [
  { file: "rizly_white.png", name: "rizly-logo-black.png" },
  { file: "rizly.png", name: "rizly-logo-white.png" },
];

export async function GET() {
  const publicDir = join(process.cwd(), "public");
  const passthrough = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 9 } });

  archive.on("error", (err: Error) => {
    passthrough.destroy(err);
  });
  archive.pipe(passthrough);

  for (const asset of ASSETS) {
    archive.append(createReadStream(join(publicDir, asset.file)), { name: asset.name });
  }

  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of passthrough) {
    chunks.push(chunk as Buffer);
  }
  const zipBuffer = Buffer.concat(chunks);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="rizly-brand-kit.zip"',
      "Content-Length": String(zipBuffer.length),
    },
  });
}
