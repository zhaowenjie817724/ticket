import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(join(fileURLToPath(import.meta.url), "..", ".."));
const port = Number(process.env.PORT || 5177);
const host = process.env.HOST || "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const server = createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
  const safePath = normalize(join(root, requestPath === "/" ? "index.html" : requestPath));

  if (!safePath.startsWith(root) || !existsSync(safePath) || statSync(safePath).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  res.writeHead(200, {
    "content-type": types[extname(safePath)] || "application/octet-stream"
  });
  createReadStream(safePath).pipe(res);
});

function getLanUrls() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${port}/`);
}

server.listen(port, host, () => {
  console.log(`极速抢已启动：http://127.0.0.1:${port}/`);
  getLanUrls().forEach((url) => console.log(`手机同一 Wi-Fi 可访问：${url}`));
});
