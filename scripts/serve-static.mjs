#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const publicDir = path.resolve(import.meta.dirname, "..", "public");
const port = Number(process.env.PORT || 8765);
const types = new Map([
  [".avif", "image/avif"], [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"], [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".png", "image/png"],
  [".svg", "image/svg+xml"], [".webp", "image/webp"], [".xml", "application/xml; charset=utf-8"]
]);

async function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, "http://127.0.0.1").pathname);
  const relative = pathname.replace(/^\/+/, "");
  const candidates = pathname === "/"
    ? ["index.html"]
    : path.extname(relative)
      ? [relative]
      : [`${relative}.html`, path.join(relative, "index.html")];
  for (const candidate of candidates) {
    const file = path.resolve(publicDir, candidate);
    if (file !== publicDir && !file.startsWith(`${publicDir}${path.sep}`)) continue;
    try {
      if ((await fs.stat(file)).isFile()) return file;
    } catch {}
  }
  return path.join(publicDir, "404.html");
}

const server = http.createServer(async (request, response) => {
  try {
    const file = await resolveRequest(request.url || "/");
    const body = await fs.readFile(file);
    response.writeHead(path.basename(file) === "404.html" ? 404 : 200, {
      "content-type": types.get(path.extname(file).toLowerCase()) || "application/octet-stream",
      "content-length": body.length,
      "cache-control": "no-store"
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Static test server error: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => console.log(`PTHHS test server listening on ${port}`));
