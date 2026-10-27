import { createServer } from "node:http";
import { readFile, stat, realpath } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError("PORT must be 0–65535");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const publicRoots = ["examples", "docs", "src", "dist"];
const server = createServer(async (request, response) => {
  const reply = (status, text) => { response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" }); response.end(text); };
  try {
    if (!["GET", "HEAD"].includes(request.method)) return reply(405, "Method not allowed");
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const parts = pathname.split("/").filter(Boolean);
    // Only serve the demo, docs and core; never expose dotfiles, config or dependencies.
    if (parts.some((part) => part.startsWith(".") || part.includes("\\")) ||
        (parts.length && pathname !== "/index.html" && !publicRoots.includes(parts[0]))) {
      return reply(404, "Not found");
    }
    let file = resolve(root, "." + pathname);
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const canonical = await realpath(file);
    if (!canonical.startsWith(root.endsWith(sep) ? root : root + sep)) return reply(404, "Not found");
    const bytes = await readFile(canonical);
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch (error) {
    reply(error instanceof URIError ? 400 : 404, error instanceof URIError ? "Bad request" : "Not found");
  }
});
server.listen(port, "127.0.0.1", () => console.log(`ContrastFit: http://127.0.0.1:${server.address().port}/`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
