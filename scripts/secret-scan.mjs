import { readdir, readFile, writeFile } from "node:fs/promises";
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
];
const scanned = [],
  findings = [];
for (const dir of ["src", "public", "scripts", "docs"])
  for (const file of await readdir(dir)) {
    if (!/\.(?:ts|js|mjs|json|md|html|css|txt|svg|webmanifest)$/.test(file))
      continue;
    const name = dir + "/" + file,
      text = await readFile(name, "utf8");
    scanned.push(name);
    if (patterns.some((p) => p.test(text))) findings.push(name);
  }
await writeFile(
  "tests/secret-scan.json",
  JSON.stringify(
    {
      scanned,
      findings,
      note: "Pattern scan of release source; not proof that all possible secrets or security flaws are absent.",
    },
    null,
    2,
  ),
);
if (findings.length) throw Error("Potential secrets in " + findings.join(", "));
console.log("Secret pattern scan:", scanned.length, "files, zero matches");
