import { adminAuthorized, json, putObject, validObjectKey, writeClient } from "../_lib/b2.js";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_PREFIXES = ["shadow-garden/books/", "shadow-garden/covers/"];
const OPAQUE_COVER_KEY = /^shadow-garden\/covers\/cv_[A-Za-z0-9_-]{20,64}-(?:detail|thumb)\.(?:jpe?g|png|webp|avif|gif)$/i;

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await adminAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  if (!validObjectKey(key, ALLOWED_PREFIXES)) return json({ ok: false, error: "Invalid object key" }, 400);
  if (key.startsWith("shadow-garden/covers/") && !OPAQUE_COVER_KEY.test(key)) {
    return json({ ok: false, error: "Cover object keys must use an opaque cv_ identifier" }, 400);
  }

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) return json({ ok: false, error: "File exceeds the 50 MB mobile upload limit" }, 413);

  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ ok: false, error: "Empty upload" }, 400);
  if (body.byteLength > MAX_BYTES) return json({ ok: false, error: "File exceeds the 50 MB mobile upload limit" }, 413);

  const type = request.headers.get("content-type") || "application/octet-stream";
  if (key.endsWith(".epub") && !["application/epub+zip", "application/octet-stream", "application/zip"].includes(type.split(";")[0])) {
    return json({ ok: false, error: "EPUB upload has an unexpected content type" }, 415);
  }
  if (key.includes("/covers/") && !type.startsWith("image/")) {
    return json({ ok: false, error: "Cover upload must be an image" }, 415);
  }

  try {
    const aws = writeClient(env);
    const headers = {
      "content-type": key.endsWith(".epub") ? "application/epub+zip" : type,
      "cache-control": key.includes("/covers/") ? "public, max-age=31536000, immutable" : "private, max-age=0"
    };
    await putObject(aws, key, body, headers);

    /* Replacement uploads can deliberately keep the same public EPUB URL so reader
       progress/bookmark keys remain stable. Evict that URL from the edge immediately. */
    try {
      const mediaUrl = `${url.origin}/media/${key.split("/").map(encodeURIComponent).join("/")}`;
      const eviction = caches.default.delete(new Request(mediaUrl));
      if (context.waitUntil) context.waitUntil(eviction); else await eviction;
    } catch (error) {
      console.warn("Uploaded media cache invalidation skipped", error);
    }

    return json({ ok: true, key, size: body.byteLength, url: `/media/${key}` });
  } catch (error) {
    console.error("Admin B2 upload failed", error);
    return json({ ok: false, error: "Backblaze upload failed", detail: String(error?.message || error) }, 502);
  }
}
