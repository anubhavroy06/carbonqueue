import { launchBrowser } from "./support/browser.mjs";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const browser = await launchBrowser();
const results = [],
  record = (name, detail = "PASS") => {
    results.push({ name, detail });
    console.log(name + ": " + detail);
  };
const exceptions = [];
async function pageFor(options = {}) {
  const c = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
    ...options,
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => exceptions.push(e.message));
  await p.goto("http://127.0.0.1:4173");
  await p.locator("h1").waitFor();
  return [c, p];
}
async function run(p) {
  await p.locator('[data-action="analyze"]').first().click();
  await p
    .getByText("Analysis complete:", { exact: false })
    .waitFor({ timeout: 20000 });
}
const rawTemplate = JSON.parse(await readFile("dist/forecast.json", "utf8"));
function futureRaw() {
  const start = Math.ceil(Date.now() / 1800000) * 1800000;
  return {
    data: Array.from({ length: 48 }, (_, i) => ({
      from: new Date(start + i * 1800000).toISOString(),
      to: new Date(start + (i + 1) * 1800000).toISOString(),
      intensity: { forecast: 100 + i, actual: null, index: "moderate" },
    })),
  };
}
let swOriginal;
try {
  let [c, p] = await pageFor();
  // Undo/redo, task duplication/deletion and resource safe reassign.
  await p.locator("#workflow-name").fill("Edited name");
  await p.locator("#workflow-name").dispatchEvent("change");
  await p.locator('[data-action="undo"]').click();
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Research batch · GB",
  );
  await p.locator('[data-action="redo"]').click();
  assert.equal(await p.locator("#workflow-name").inputValue(), "Edited name");
  record("Undo/redo");
  await p.locator('[data-action="duplicate-task"]').first().click();
  assert.equal(await p.locator(".task-card").count(), 5);
  await p.locator('[data-action="delete-task"]').last().click();
  await p.locator('#confirm-dialog button[value="confirm"]').click();
  await p.waitForFunction(
    () => document.querySelectorAll(".task-card").length === 4,
  );
  assert.equal(await p.locator(".task-card").count(), 4);
  record("Task duplicate/delete");
  await p.getByText("Resources (2/2)", { exact: true }).click();
  await p.locator('[data-action="delete-resource"]').last().click();
  await p.locator('#confirm-dialog button[value="confirm"]').click();
  await p.locator('[data-action="add-resource"]').click();
  record("Resource delete/reassign/add");
  // Field errors are navigable and never accepted by scheduler.
  await p.locator("#energy-prep").fill("-1");
  await p.locator("#energy-prep").dispatchEvent("change");
  await p.locator('[data-action="analyze"]').first().click();
  await p.locator("#error-summary").waitFor();
  await p.locator("#error-summary a").first().click();
  assert.equal(
    await p.evaluate(() => document.activeElement.id),
    "energy-prep",
  );
  assert.equal(
    await p.locator("#energy-prep").getAttribute("aria-invalid"),
    "true",
  );
  record("Accessible field-level validation");
  await p.locator('[data-action="restore-deadline"]').click();
  await p.getByText("Analysis complete:", { exact: false }).waitFor();
  await p.locator("#what-task").selectOption("report");
  await p.locator("#what-deadline").fill("4");
  await p.locator('[data-action="whatif"]').click();
  await p
    .getByText("Analysis complete: INFEASIBLE", { exact: false })
    .waitFor();
  record("Explicit deadline what-if and previous snapshot");
  // Mocked provider success is labeled test evidence, not actual API verification.
  await c.route("https://api.carbonintensity.org.uk/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(futureRaw()),
    }),
  );
  await p.locator('[data-action="live"]').click();
  await p.getByText("Live GB loaded.", { exact: false }).waitFor();
  await p.locator('[data-action="restore-deadline"]').click();
  await p.getByText("Analysis complete:", { exact: false }).waitFor();
  await p.locator('[data-action="live"]').click();
  await p.getByText("Live GB loaded.", { exact: false }).waitFor();
  await run(p);
  assert.ok((await p.locator("#results").textContent()).includes("LIVE"));
  record("Live future-only parsing and computation (mocked provider)");
  await p.locator('[data-action="live"]').click();
  await p.getByText("Fresh snapshot cached.", { exact: false }).waitFor();
  record("Live in-flight/cache request restraint");
  await p.locator('[data-action="replay"]').click();
  await c.unrouteAll();
  await c.route("https://api.carbonintensity.org.uk/**", (route) =>
    route.fulfill({
      status: 429,
      headers: { "retry-after": "60", "access-control-allow-origin": "*" },
    }),
  );
  await p.locator('[data-action="live"]').click();
  await p.getByText("Live fetch failed:", { exact: false }).waitFor();
  assert.ok(
    (await p.locator("#notice").textContent()).includes(
      "Current data remains REPLAY",
    ),
  );
  await p.locator('[data-action="live"]').click();
  await p.getByText("Provider cooldown active.", { exact: false }).waitFor();
  record("429, Retry-After, explicit fallback and cooldown");
  // Old result cannot overwrite edits; cancellation is real.
  const longWorkflow = {
    schemaVersion: 1,
    id: "cancel-test",
    name: "Cancellation test",
    horizon: 48,
    resources: [
      { id: "r", name: "R" },
      { id: "s", name: "S" },
    ],
    tasks: Array.from({ length: 6 }, (_, i) => ({
      id: "long" + i,
      name: "Long search " + i,
      notes: "",
      resourceId: i % 2 ? "r" : "s",
      duration: 1,
      energyKWh: 0,
      release: 0,
      deadline: 48,
      dependsOn: [],
    })),
  };
  await p.locator('[data-action="import-workflow"]').click();
  await p.locator("#import-file").setInputFiles({
    name: "long.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(longWorkflow)),
  });
  await p.locator("#workflow-name").filter({ hasText: "" }).waitFor();
  await p.locator("#results details").first().locator("summary").click();
  await p.locator("#maxnodes").fill("10000000");
  await p.locator("#maxnodes").dispatchEvent("change");
  await p.locator("#maxms").fill("60000");
  await p.locator("#maxms").dispatchEvent("change");
  await p.locator('[data-action="analyze"]').first().click();
  await p.locator('[data-action="cancel"]').click();
  await p.getByText("Analysis cancelled.", { exact: false }).waitFor();
  await p.waitForTimeout(200);
  assert.ok(!(await p.locator("#results").textContent()).includes("RUNNING"));
  record("Worker cancellation without false infeasibility");
  await p.locator("#workflow-name").fill("Newer workflow");
  await p.locator("#workflow-name").dispatchEvent("change");
  assert.ok(
    (await p.locator("#results").textContent()).includes("out of date"),
  );
  record("Edited-input stale-result protection");
  // Reject malformed imports while preserving live editor.
  await p.locator('[data-action="import-workflow"]').click();
  await p.locator("#import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not json"),
  });
  await p
    .getByText("Import rejected; working data preserved:", { exact: false })
    .waitFor();
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Newer workflow",
  );
  record("Malformed import preserves workspace");
  await c.close();
  // Missing local storage degrades to memory, not a broken application.
  c = await browser.newContext({ serviceWorkers: "block" });
  await c.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", { value: undefined }),
  );
  p = await c.newPage();
  p.on("pageerror", (e) => exceptions.push(e.message));
  await p.goto("http://127.0.0.1:4173");
  await p.locator("h1").waitFor();
  assert.ok(
    (await p.locator("#workspace").textContent()).includes("memory-only"),
  );
  await run(p);
  record("Blocked storage: usable in-memory analysis");
  await c.close();
  // Corrupt row isolation.
  [c, p] = await pageFor();
  await p.evaluate(async () => {
    const { storeWorkspace } = await import("./storage.js");
    await storeWorkspace({
      schemaVersion: 1,
      workflow: { schemaVersion: 9 },
      forecast: { schemaVersion: 9 },
      saved: [{ schemaVersion: 9 }],
      datasets: [{ schemaVersion: 9 }],
      scenarios: [{ schemaVersion: 9 }],
    });
  });
  await p.reload();
  await p.getByText("Workspace recovery:", { exact: false }).waitFor();
  await run(p);
  record("Corrupt saved records isolated");
  await c.close();
  // Actual CORS/live endpoint smoke test; if blocked it is explicitly reported.
  [c, p] = await pageFor();
  await p.locator('[data-action="live"]').click();
  await p.waitForFunction(
    () =>
      document
        .querySelector("#notice")
        .textContent.includes("Live GB loaded.") ||
      document
        .querySelector("#notice")
        .textContent.includes("Live fetch failed:"),
    {},
    { timeout: 15000 },
  );
  const text = await p.locator("#notice").textContent();
  record("Actual browser NESO live smoke", text);
  assert.ok(
    text.includes("Live GB loaded."),
    "Actual provider smoke failed: " + text,
  );
  await run(p);
  const actualDownload = p.waitForEvent("download");
  await p.locator('[data-action="export-evidence"]').click();
  await (await actualDownload).saveAs("tests/actual-live-evidence.json");
  const actualPacket = JSON.parse(
    await readFile("tests/actual-live-evidence.json", "utf8"),
  );
  assert.equal(actualPacket.forecast.slots.length, 48);
  assert.ok(actualPacket.result.verification.valid);
  assert.ok(actualPacket.forecast.sourceUrl.endsWith("/fw48h"));
  await c.close();
  // Real service-worker update lifecycle with a controlled local test version.
  [c, p] = await pageFor({ serviceWorkers: "allow" });
  await p.evaluate(async () => await navigator.serviceWorker.ready);
  await p.reload();
  await p.locator("h1").waitFor();
  await p.locator("#workflow-name").fill("Survives update");
  await p.locator("#workflow-name").dispatchEvent("change");
  await p.waitForTimeout(500);
  swOriginal = await readFile("dist/sw.js", "utf8");
  await writeFile(
    "dist/sw.js",
    swOriginal.replace(
      /carbonqueue-1\.0\.\d+-[a-f0-9]+/,
      "carbonqueue-update-test",
    ),
  );
  await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
  });
  await p.locator("#update").waitFor({ timeout: 15000 });
  await p.locator("#apply-update").click();
  await p.locator('#confirm-dialog button[value="confirm"]').click();
  await p.waitForTimeout(1000);
  await p.locator("h1").waitFor();
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Survives update",
  );
  record("Service-worker update activation preserves editor");
  await writeFile("dist/sw.js", swOriginal);
  swOriginal = null;
  await c.close();
  assert.deepEqual(exceptions, []);
  record("No uncaught release-browser errors");
  await writeFile(
    "tests/release-browser-results.json",
    JSON.stringify({ results, exceptions }, null, 2),
  );
} catch (e) {
  console.error(e);
  await writeFile(
    "tests/release-browser-failure.json",
    JSON.stringify({ error: e.message, results, exceptions }, null, 2),
  );
  if (swOriginal) await writeFile("dist/sw.js", swOriginal);
  await browser.close();
  process.exit(1);
}
await browser.close();
process.exit(0);
