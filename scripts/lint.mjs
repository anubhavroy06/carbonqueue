import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
for (const dir of ["public", "scripts", "tests"])
  for (const name of await readdir(dir)) {
    if (!/\.(js|mjs)$/.test(name)) continue;
    const r = spawnSync(process.execPath, ["--check", dir + "/" + name], {
      encoding: "utf8",
    });
    if (r.status) throw Error(r.stderr);
    const text = await readFile(dir + "/" + name, "utf8");
    if (/\beval\s*\(|new\s+Function\s*\(/.test(text))
      throw Error("Unsafe executable code: " + name);
  }
console.log(
  "Syntax and unsafe-evaluation checks passed (not a full style linter).",
);
