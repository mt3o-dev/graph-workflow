import type { APIRoute } from "astro";

const UPLOAD_DIR = "./data/uploads";
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export const GET: APIRoute = async ({ params }) => {
  const filename = params.filename ?? "";
  if (!/^[a-f0-9-]+\.[a-z]+$/i.test(filename)) return new Response("Not found", { status: 404 });

  const file = Bun.file(`${UPLOAD_DIR}/${filename}`);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });

  const ext = filename.split(".").pop() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  return new Response(file, { headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" } });
};
