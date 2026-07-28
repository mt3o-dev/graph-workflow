import type { APIRoute } from "astro";
import { mkdir } from "node:fs/promises";
import { getCurrentUser } from "../../lib/session";

// Local-disk image storage for image_occlusion cards (slice 1 scope — no
// cloud storage). Files are served back via the SSR route
// src/pages/uploads/[filename].ts rather than Astro's static public/ folder,
// so uploads work identically in `astro dev` and a built `astro build` +
// `astro preview`/production server (public/ is only copied to dist at BUILD
// time, so writes to it after a build would never be served).
const UPLOAD_DIR = "./data/uploads";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) return new Response("Missing image file", { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return new Response("Unsupported image type", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("Image too large", { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = file.type.split("/")[1] ?? "bin";
  const filename = `${crypto.randomUUID()}.${ext}`;
  await Bun.write(`${UPLOAD_DIR}/${filename}`, file);

  return new Response(JSON.stringify({ url: `/uploads/${filename}` }), {
    headers: { "content-type": "application/json" },
  });
};
