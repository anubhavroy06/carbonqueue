import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
const owned = [];
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error(command + " " + args.join(" ") + " exited " + code)),
    );
  });
}
async function preview(port, base = "") {
  const url = `http://127.0.0.1:${port}${base}/release.json`,
    expected = JSON.parse(
      await readFile("dist/release.json", "utf8"),
    ).buildHash;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
    if (r.ok && (await r.json()).buildHash === expected) return;
  } catch {}
  const child = spawn(process.execPath, ["scripts/server.mjs"], {
    env: { ...process.env, PORT: String(port), BASE_PATH: base },
    stdio: "inherit",
  });
  owned.push(child);
  let died = false;
  child.once("exit", () => (died = true));
  child.once("error", () => (died = true));
  for (let i = 0; i < 50; i++) {
    if (died) throw Error("Preview port occupied or server failed: " + port);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (r.ok && (await r.json()).buildHash === expected) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Preview could not be verified: " + port);
}
try {
  for (const cmd of ["typecheck", "test", "lint"])
    await run("npm", ["run", cmd]);
  await run(process.execPath, ["scripts/secret-scan.mjs"]);
  await preview(4173);
  await preview(4174, "/carbonqueue");
  for (const file of [
    "browser",
    "release-browser",
    "failure-browser",
    "keyboard",
    "hardening-browser",
    "contract-browser",
  ])
    await run(process.execPath, ["tests/" + file + ".mjs"]);
  await run(process.execPath, ["scripts/measure.mjs"]);
  await run(process.execPath, ["scripts/visual-check.mjs"]);
  await writeFile(
    "tests/release-verification.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        buildHash: JSON.parse(await readFile("dist/release.json", "utf8"))
          .buildHash,
        result: "LOCAL RELEASE CHECKS PASS",
        publicDeployment: "NOT VERIFIED",
      },
      null,
      2,
    ),
  );
  console.log(
    "All local release checks passed. Public deployment remains a separate gate.",
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  for (const child of owned) child.kill();
}
