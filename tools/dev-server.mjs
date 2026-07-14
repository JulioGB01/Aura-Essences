import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT) || 4173;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = normalize(join(root, relativePath));

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("No encontrado");
    return;
  }

  if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Aura Essences disponible en http://127.0.0.1:${port}`);
});
