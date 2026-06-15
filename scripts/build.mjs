import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT_DIR = "dist";
const FILES = [
  ".nojekyll",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "src/strategy.js",
  "src/extract.js",
  "assets/icon-192.svg",
  "assets/icon-512.svg"
];

await rm(OUT_DIR, { recursive: true, force: true });

for (const file of FILES) {
  const target = join(OUT_DIR, file);
  await mkdir(dirname(target), { recursive: true });
  await cp(file, target);
}

console.log(`built ${FILES.length} files into ${OUT_DIR}`);
