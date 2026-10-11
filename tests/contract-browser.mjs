import { launchBrowser } from "./support/browser.mjs";
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
const b = await launchBrowser(),
  checks = [];
const add = (n) => {
  checks.push(n);
  console.log(n + ": PASS");
};
async function open(init) {
  const c = await b.newContext({ serviceWorkers: "block" });
  if (init) await c.addInitScript(init);
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4173");
  await p.locator("h1").waitFor();
  return [c, p];
}
async function run(p) {
  await p.locator("#analyze-hero").click();
  await p.getByText("Analysis complete:", { exact: false }).waitFor();
}
async function download(p, action, name) {
  const ready = p.waitForEvent("download");
  await p.locator(`[data-action="${action}"]`).click();
  const d = await ready;
  await d.saveAs("tests/" + name);
  return JSON.parse(await readFile("tests/" + name, "utf8"));
}
async function confirm(p) {
  await p.locator('#confirm-dialog button[value="confirm"]').click();
}
try {
  let [c, p] = await open();
  await run(p);
  const packet = await download(
    p,
    "export-evidence",
    "audit-time-evidence.json",
  );
  assert.equal(packet.appVersion, "1.1.0");
  assert.equal(packet.timeContext.slotMinutes, 30);
  assert.ok(packet.timeContext.displayTimeZone);
  for (const task of packet.workflow.tasks) {
    const t = packet.timeContext.tasks.find((t) => t.taskId === task.id),
      a = packet.result.schedule.find((a) => a.taskId === task.id),
      origin = Date.parse(packet.forecast.slots[0].from);
    assert.equal(Date.parse(t.releaseUTC), origin + task.release * 1800000);
    assert.equal(Date.parse(t.startUTC), origin + a.start * 1800000);
  }
  add(
    "Evidence includes independently checkable UTC/local conversion metadata",
  );
  for (let i = 0; i < 3; i++)
    await p.locator('[data-action="save-scenario"]').click();
  await p
    .getByText("Inspect exact interval values and dataset", { exact: true })
    .click();
  for (let i = 0; i < 2; i++)
    await p.locator('[data-action="save-dataset"]').click();
  const backup = await download(
    p,
    "export-backup",
    "audit-records-backup.json",
  );
  assert.equal(new Set(backup.scenarios.map((s) => s.id)).size, 3);
  assert.equal(new Set(backup.datasets.map((f) => f.id)).size, 2);
  add("Repeated saves produce unique snapshot and scenario IDs");
  await p.locator("#results details").first().locator("summary").click();
  await p.locator("#maxnodes").fill("1");
  await p.locator("#maxnodes").dispatchEvent("change");
  await p.locator('[data-action="restore-scenario"]').first().click();
  assert.equal(
    await p.locator("#maxnodes").inputValue(),
    String(packet.result.config.maxNodes),
  );
  add("Restoring a scenario also restores its solver settings");

  const duplicates = {
    ...backup,
    saved: [
      { ...backup.workflow, id: "duplicate", name: "First" },
      { ...backup.workflow, id: "duplicate", name: "Second" },
    ],
    datasets: [backup.datasets[0], backup.datasets[0]],
    scenarios: [],
  };
  await p.locator('[data-action="import-backup"]').click();
  await p.locator("#import-file").setInputFiles({
    name: "duplicates.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(duplicates)),
  });
  await p.locator('#confirm-dialog button[value="cancel"]').click();
  await confirm(p);
  await p
    .getByText("Validated backup restored transactionally.", { exact: true })
    .waitFor();
  const restored = await download(
    p,
    "export-backup",
    "audit-resolved-backup.json",
  );
  assert.equal(new Set(restored.saved.map((w) => w.id)).size, 2);
  assert.equal(new Set(restored.datasets.map((f) => f.id)).size, 2);
  add(
    "Replacement backup resolves duplicate record IDs without losing records",
  );
  const forged = structuredClone(packet);
  forged.timeContext.tasks[0].startUTC = "2026-01-01T00:00:00.000Z";
  await p.locator('[data-action="import-evidence"]').click();
  await p.locator("#import-file").setInputFiles({
    name: "forged-time.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(forged)),
  });
  await p
    .getByText("Import rejected; working data preserved:", { exact: false })
    .waitFor();
  assert.match(
    await p.locator("#notice").textContent(),
    /time conversion metadata/,
  );
  add("Forged time conversion evidence is rejected");
  await c.close();
  [c, p] = await open(() => {
    const native = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (...args) =>
      new Promise((resolve, reject) =>
        setTimeout(() => native(...args).then(resolve, reject), 1500),
      );
  });
  await p.locator("#analyze-hero").click();
  await p.locator("#results .tag").filter({ hasText: "VALIDATING" }).waitFor();
  await p.locator('[data-action="cancel"]').click();
  await p.getByText("Analysis cancelled.", { exact: false }).waitFor();
  await p.waitForTimeout(1800);
  assert.match(
    await p.locator("#results .tag").first().textContent(),
    /CANCELLED/,
  );
  assert.ok(
    !(await p.locator("#results").textContent()).includes(
      "Independent verification PASS",
    ),
  );
  add("Cancellation during asynchronous validation prevents a later run");
  await c.close();
  [c, p] = await open(() => {
    window.Worker = class {
      constructor() {
        throw Error("Simulated Worker initialization failure");
      }
    };
  });
  await p.locator("#analyze-hero").click();
  await p.locator("#error-summary").waitFor();
  assert.match(
    await p.locator("#error-summary").textContent(),
    /initialization failure/,
  );
  assert.match(
    await p.locator("#results .tag").first().textContent(),
    /FAILED/,
  );
  add("Worker initialization failure yields explicit FAILED recovery state");
  await c.close();
  [c, p] = await open(() => {
    window.Worker = class {
      terminate() {}
      postMessage() {
        setTimeout(
          () => this.onerror?.({ message: "Simulated Worker crash" }),
          15,
        );
      }
    };
  });
  await p.locator("#analyze-hero").click();
  await p
    .getByText("Worker failed. See validation errors.", { exact: true })
    .waitFor();
  assert.match(await p.locator("#error-summary").textContent(), /Worker crash/);
  add("Worker crash is reported without feasibility or validity claim");
  await c.close();
  [c, p] = await open(() => {
    Object.defineProperty(window, "indexedDB", { value: undefined });
  });
  await p.locator("#workflow-name").fill("Memory clear test");
  await p.locator("#workflow-name").dispatchEvent("change");
  await p.locator('[data-action="clear-all"]').click();
  await confirm(p);
  await p
    .getByText("Memory cleared; durable storage could not be updated:", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Research batch · GB",
  );
  assert.equal(await p.locator('[data-action="load-workflow"]').count(), 0);
  add(
    "Memory-only clear resets active records without falsely claiming durable deletion",
  );
  await c.close();
  [c, p] = await open();
  await p.locator("#workflow-name").fill("X".repeat(300));
  await p.locator("#workflow-name").dispatchEvent("change");
  await run(p);
  assert.ok(
    (await p.locator("#results").textContent()).includes(
      "Independent verification PASS",
    ),
  );
  add("Maximum-length workflow name still produces valid analysis");
  await p.locator('.task-card[data-task="prep"] [data-dep="report"]').check();
  await p.locator("#analyze-hero").click();
  await p.getByText("Cycle certificate", { exact: true }).waitFor();
  assert.match(
    await p.locator(".cert").textContent(),
    /Independent recheck: PASS/,
  );
  add("Invalid dependency cycle produces a checked structural explanation");
  await c.close();
  [c, p] = await open();
  let attempts = 0;
  const base = JSON.parse(await readFile("dist/forecast.json", "utf8"));
  const origin = Math.ceil(Date.now() / 1800000) * 1800000;
  const response = {
    data: Array.from({ length: 96 }, (_, i) => ({
      from: new Date(origin + i * 1800000).toISOString(),
      to: new Date(origin + (i + 1) * 1800000).toISOString(),
      intensity: { forecast: base.slots[i % base.slots.length].value },
    })),
  };
  await c.route("https://api.carbonintensity.org.uk/**", (route) => {
    attempts++;
    return attempts === 1
      ? route.fulfill({
          status: 503,
          headers: { "access-control-allow-origin": "*" },
        })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify(response),
        });
  });
  await p.locator('[data-action="live"]').click();
  await p.getByText("Live GB loaded.", { exact: false }).waitFor();
  assert.equal(attempts, 2);
  add(
    "Transient server failure retries once and succeeds within a bounded request",
  );
  await c.close();
  [c, p] = await open();
  await p.locator("#energy-prep").fill("");
  await p.locator("#energy-prep").dispatchEvent("change");
  await p.locator("#analyze-hero").click();
  await p.locator("#error-summary").waitFor();
  assert.match(
    await p.locator("#error-summary").textContent(),
    /energy must be finite/,
  );
  assert.equal(
    await p.locator("#energy-prep").getAttribute("aria-invalid"),
    "true",
  );
  add("Blank numerical input is rejected rather than silently treated as zero");
  await c.close();
  [c, p] = await open();
  const pageErrors = [];
  p.on("pageerror", (e) => pageErrors.push(e.message));
  await p.locator("#deadline-prep").fill("");
  await p.locator("#deadline-prep").dispatchEvent("change");
  await p.locator("#analyze-hero").click();
  await p.locator("#error-summary").waitFor();
  await p.locator("#error-summary a").first().click();
  assert.equal(
    await p.evaluate(() => document.activeElement.id),
    "deadline-prep",
  );
  assert.deepEqual(pageErrors, []);
  add(
    "Blank time inputs render safely and navigate to the actual invalid deadline",
  );
  await p.locator('[data-action="restore-deadline"]').click();
  await p.getByText("Analysis complete:", { exact: false }).waitFor();
  await p.locator("#results details").first().locator("summary").click();
  await p.locator("#maxnodes").fill("");
  await p.locator("#maxnodes").dispatchEvent("change");
  await p.locator("#analyze-hero").click();
  await p.locator("#error-summary").waitFor();
  await p
    .locator("#results details")
    .first()
    .evaluate((el) => (el.open = false));
  await p.locator("#error-summary a").first().click();
  assert.equal(await p.evaluate(() => document.activeElement.id), "maxnodes");
  assert.equal(
    await p.locator("#maxnodes").getAttribute("aria-invalid"),
    "true",
  );
  add(
    "Solver budget errors expose and focus their field even inside a closed disclosure",
  );
  await c.close();
  await writeFile(
    "tests/contract-results.json",
    JSON.stringify({ checks }, null, 2),
  );
} catch (e) {
  console.error(e);
  await b.close();
  process.exit(1);
}
await b.close();
process.exit(0);
