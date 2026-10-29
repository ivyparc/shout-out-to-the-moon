import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 5173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function resolvePath(url) {
  const pathname = new URL(url, `http://127.0.0.1:${port}`).pathname;
  const requested =
    pathname === "/"
      ? "/index.html"
      : pathname.startsWith("/assets/")
        ? `/public${pathname}`
        : pathname;
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  return join(root, normalized);
}

createServer(async (request, response) => {
  try {
    if (request.url?.split("?")[0] === "/src/web/leaderboard-config.js" && process.env.LEADERBOARD_ENDPOINT) {
      const config = await readFile(join(root, "src/web/leaderboard-config.js"), "utf8");
      response.writeHead(200, { "Content-Type": contentTypes[".js"], "Cache-Control": "no-store" });
      response.end(`${config}\nwindow.SHOUT_MOON_LEADERBOARD.endpoint = ${JSON.stringify(process.env.LEADERBOARD_ENDPOINT)};`);
      return;
    }
    const filePath = resolvePath(request.url ?? "/");
    const body = await readFile(filePath);
    if (extname(filePath) === ".mp4" && request.headers.range) {
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
      const start = range ? Number(range[1]) : NaN;
      const end = range?.[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      if (!Number.isSafeInteger(start) || start > end || start >= body.length) {
        response.writeHead(416, { "Content-Range": `bytes */${body.length}` }); response.end(); return;
      }
      response.writeHead(206, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${body.length}`, "Content-Length": end - start + 1 });
      response.end(body.subarray(start, end + 1)); return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Shout Out to the Moon web POC: http://127.0.0.1:${port}`);
});
