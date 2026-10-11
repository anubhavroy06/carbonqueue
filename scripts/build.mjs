import { cp, readdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await cp("public", "dist", { recursive: true });
const files = (await readdir("dist"))
  .filter(
    (x) => !["sw.js", "headers.txt", "_headers", "release.json"].includes(x),
  )
  .sort();
const hashes = {};
for (const name of files)
  hashes[name] = createHash("sha256")
    .update(await readFile("dist/" + name))
    .digest("hex");
const buildHash = createHash("sha256")
  .update(JSON.stringify(hashes))
  .digest("hex");
let sw = await readFile("public/sw.js", "utf8");
sw = sw
  .replace("carbonqueue-1.0.1", "carbonqueue-1.0.1-" + buildHash.slice(0, 12))
  .replace("/*ASSETS*/[]", JSON.stringify(files.map((x) => "./" + x)));
await writeFile("dist/sw.js", sw);
await writeFile(
  "dist/release.json",
  JSON.stringify({ version: "1.0.1", buildHash, files: hashes }, null, 2),
);
console.log(
  "Production build:",
  files.length,
  "cached files; build",
  buildHash.slice(0, 12),
);
