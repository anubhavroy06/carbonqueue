import { cp, readdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await cp("public", "dist", { recursive: true });
const files = (await readdir("dist"))
  .filter(
    (x) =>
      ![
        "sw.js",
        "headers.txt",
        "_headers",
        "release.json",
        "_worker.js",
        "_routes.json",
      ].includes(x),
  )
  .sort();
const hashes = {};
for (const name of files)
  hashes[name] = createHash("sha256")
    .update(await readFile("dist/" + name))
    .digest("hex");
const serverFiles = {};
for (const name of ["_worker.js", "_routes.json", "_headers"])
  serverFiles[name] = createHash("sha256")
    .update(await readFile("dist/" + name))
    .digest("hex");
const buildHash = createHash("sha256")
  .update(JSON.stringify({ files: hashes, serverFiles }))
  .digest("hex");
let sw = await readFile("public/sw.js", "utf8");
sw = sw
  .replace("carbonqueue-1.1.0", "carbonqueue-1.1.0-" + buildHash.slice(0, 12))
  .replace("/*ASSETS*/[]", JSON.stringify(files.map((x) => "./" + x)));
await writeFile("dist/sw.js", sw);
await writeFile(
  "dist/release.json",
  JSON.stringify(
    { version: "1.1.0", buildHash, files: hashes, serverFiles },
    null,
    2,
  ),
);
console.log(
  "Production build:",
  files.length,
  "cached files; build",
  buildHash.slice(0, 12),
);
