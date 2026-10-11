import { launchBrowser } from "./support/browser.mjs";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const b = await launchBrowser();
const checks = [],
  add = (n, v = "PASS") => {
    checks.push({ name: n, detail: v });
    console.log(n + ": " + v);
  };
const errors = [];
async function create() {
  const c = await b.newContext({ serviceWorkers: "block" }),
    p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4173");
  await p.locator("h1").waitFor();
  return [c, p];
}
async function confirm(p) {
  await p.locator("#confirm-dialog button[value=confirm]").click();
}
try {
  let [c, p] = await create();
  const f = JSON.parse(await readFile("dist/forecast.json", "utf8"));
  f.kind = "measurement";
  f.name = "Custom user dataset";
  await p.locator('[data-action="import-forecast"]').click();
  await p
    .locator("#import-file")
    .setInputFiles({
      name: "custom.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(f)),
    });
  await p
    .getByText("Imported dataset is user-provided", { exact: false })
    .waitFor();
  assert.ok((await p.locator("#main").textContent()).includes("CUSTOM"));
  add("Custom dataset import labels provenance correctly");
  await p
    .getByText("Inspect exact interval values and dataset", { exact: true })
    .click();
  await p.locator('[data-action="save-dataset"]').click();
  await p.locator('[data-action="load-dataset"]').first().click();
  await p.locator('[data-action="delete-dataset"]').first().click();
  await confirm(p);
  await p.waitForFunction(
    () =>
      document.querySelectorAll('[data-action="load-dataset"]').length === 0,
  );
  assert.equal(await p.locator('[data-action="load-dataset"]').count(), 0);
  add("Snapshot save/load/delete");
  await p.locator('[data-action="save-workflow"]').click();
  await p.locator("#workflow-name").fill("Changed");
  await p.locator("#workflow-name").dispatchEvent("change");
  await p.locator('[data-action="load-workflow"]').first().click();
  await confirm(p);
  await p.waitForFunction(
    () =>
      document.querySelector("#workflow-name").value === "Research batch · GB",
  );
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Research batch · GB",
  );
  await p.locator('[data-action="delete-workflow"]').first().click();
  await confirm(p);
  add("Named workflow save/load/delete");
  const backup = {
    schemaVersion: 1,
    workflow: JSON.parse(await readFile("tests/exported-backup.json", "utf8"))
      .workflow,
    forecast: f,
    saved: [],
    datasets: [],
    scenarios: [],
  };
  backup.workflow.name = "Replacement backup";
  await p.locator('[data-action="import-backup"]').click();
  await p
    .locator("#import-file")
    .setInputFiles({
      name: "replace.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await p.locator("#confirm-dialog button[value=cancel]").click();
  await confirm(p);
  await p.getByText("Validated backup restored transactionally.").waitFor();
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Replacement backup",
  );
  add("Transactional backup replacement");
  const invalid = { ...backup, workflow: { schemaVersion: 9 } };
  await p.locator('[data-action="import-backup"]').click();
  await p
    .locator("#import-file")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
  await p
    .getByText("Import rejected; working data preserved:", { exact: false })
    .waitFor();
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Replacement backup",
  );
  add("Invalid backup rollback preserves editor");
  await p.locator('[data-action="clear-all"]').click();
  await confirm(p);
  await p
    .getByText("All local records reset/deleted from the active workspace.", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Research batch · GB",
  );
  add("Clear-all local record reset");
  // HTTP failure, malformed forecast, timeout: each remains in explicit replay.
  for (const [name, handler] of [
    [
      "HTTP 503",
      (route) =>
        route.fulfill({
          status: 503,
          headers: { "access-control-allow-origin": "*" },
        }),
    ],
    [
      "Malformed provider data",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: '{"data":[]}',
        }),
    ],
    [
      "Network timeout",
      async (route) => {
        await new Promise((r) => setTimeout(r, 11000));
        await route.abort().catch(() => {});
      },
    ],
  ]) {
    await c.unrouteAll({ behavior: "ignoreErrors" });
    await c.route("https://api.carbonintensity.org.uk/**", handler);
    await p.locator('[data-action="live"]').click();
    await p
      .getByText("Live fetch failed:", { exact: false })
      .waitFor({ timeout: 15000 });
    assert.ok(
      (await p.locator("#notice").textContent()).includes(
        "Current data remains REPLAY",
      ),
    );
    add(name + " preserves explicit data mode");
  }
  await c.close();
  // Subpath + server header policies + manifest icon validity.
  c = await b.newContext({ serviceWorkers: "allow" });
  p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  const response = await p.goto("http://127.0.0.1:4174/carbonqueue/");
  assert.ok(
    response.headers()["content-security-policy"].includes("worker-src 'self'"),
  );
  await p.locator("h1").waitFor();
  await p.locator('[data-action="analyze"]').first().click();
  await p.getByText("Analysis complete:", { exact: false }).waitFor();
  await p.evaluate(async () => navigator.serviceWorker.ready);
  await p.reload();
  await p.locator("h1").waitFor();
  await c.setOffline(true);
  await p.reload();
  await p.locator("h1").waitFor();
  add("Project-subpath Worker, security policy, and offline reload");
  await c.setOffline(false);
  const session = await c.newCDPSession(p);
  const manifest = await session.send("Page.getAppManifest");
  assert.equal(manifest.errors.length, 0);
  add("Manifest parses without errors");
  let iconSizes = await p.evaluate(async () => {
    const m = await fetch("./manifest.webmanifest").then((r) => r.json());
    return Promise.all(
      m.icons
        .filter((x) => x.type === "image/png")
        .map(
          (x) =>
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () =>
                resolve([image.naturalWidth, image.naturalHeight]);
              image.src = x.src;
            }),
        ),
    );
  });
  assert.deepEqual(iconSizes, [
    [192, 192],
    [512, 512],
  ]);
  add("192px and 512px app icons decoded");
  await p.setViewportSize({ width: 640, height: 900 });
  await p.keyboard.press("Tab");
  assert.ok(await p.evaluate(() => document.activeElement !== document.body));
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  add("Narrow/reflow layout and keyboard focus");
  await c.close();
  assert.deepEqual(errors, []);
  add("No uncaught fault-suite errors");
  await writeFile(
    "tests/failure-browser-results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (e) {
  console.error(e);
  await writeFile(
    "tests/failure-browser-errors.json",
    JSON.stringify({ message: e.message, checks, errors }, null, 2),
  );
  await b.close();
  process.exit(1);
}
await b.close();
process.exit(0);
