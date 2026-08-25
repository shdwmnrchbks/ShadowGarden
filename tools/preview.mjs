import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const HOST = String(process.env.HOST || "127.0.0.1");
const PORT = Number(process.env.PORT || process.argv[2] || 4173);

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".epub", "application/epub+zip"],
  [".wasm", "application/wasm"]
]);

function safeFile(urlPath) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(urlPath, "http://preview.local").pathname); }
  catch { return null; }
  if (pathname.endsWith("/")) pathname += "index.html";
  const relative = pathname.replace(/^\/+/, "");
  const file = path.resolve(DIST, relative);
  return file === DIST || file.startsWith(`${DIST}${path.sep}`) ? file : null;
}

async function sendFile(req, res, file) {
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) throw Object.assign(new Error("Not a file"), { code: "ENOENT" });
    const headers = {
      "Content-Type": MIME.get(path.extname(file).toLowerCase()) || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store"
    };
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    if (error?.code !== "ENOENT") console.error(error);
    res.writeHead(error?.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end(error?.code === "ENOENT" ? "Not found\n" : "Preview server error\n");
  }
}

try {
  const stat = await fsp.stat(DIST);
  if (!stat.isDirectory()) throw new Error();
} catch {
  throw new Error("dist/ is missing. Run npm run build before npm run preview.");
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Method not allowed\n");
  }
  const file = safeFile(req.url || "/");
  if (!file) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Bad request\n");
  }
  await sendFile(req, res, file);
});

server.listen(PORT, HOST, () => {
  console.log(`Shadow Garden preview: http://${HOST}:${PORT}`);
  console.log(`Serving ${fileURLToPath(new URL("../dist/", import.meta.url))}`);
});
