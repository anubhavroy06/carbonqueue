import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.env.ROOT || "dist"),
  base = (process.env.BASE_PATH || "").replace(/\/$/, "");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (base && !pathname.startsWith(base + "/")) {
        res.writeHead(404);
        return res.end("Not found");
      }
      pathname = pathname.slice(base.length);
      let target = path.resolve(root, "." + pathname);
      if (target !== root && !target.startsWith(root + path.sep)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }
      if ((await stat(target)).isDirectory())
        target = path.join(target, "index.html");
      const bytes = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.carbonintensity.org.uk; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`CarbonQueue static preview http://127.0.0.1:${port}${base}/`),
  );
