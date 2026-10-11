import { launchBrowser } from "./support/browser.mjs";
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
const b = await launchBrowser(),
  checks = [];
const record = (x) => {
  checks.push(x);
  console.log(x + ": PASS");
};
async function open(init) {
  const c = await b.newContext({ serviceWorkers: "block" });
  if (init) await c.addInitScript(init);
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4173");
  await p.locator("h1").waitFor();
  return [c, p];
}
try {
  let [c, p] = await open(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException(
        "Simulated storage quota exceeded",
        "QuotaExceededError",
      );
    };
  });
  await p.locator("#workflow-name").fill("Quota case");
  await p.locator("#workflow-name").dispatchEvent("change");
  await p.getByText("Local save failed:", { exact: false }).waitFor();
  assert.match(await p.locator("#workspace").textContent(), /memory-only/);
  await p.locator('[data-action="analyze"]').first().click();
  await p.getByText("Analysis complete:", { exact: false }).waitFor();
  record("QuotaExceededError keeps a usable in-memory editor and solver");
  await c.close();
  [c, p] = await open();
  await p.locator('[data-action="import-workflow"]').click();
  await p.locator("#import-file").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 32),
  });
  await p.getByText("Import exceeds 2 MiB limit.", { exact: true }).waitFor();
  assert.equal(
    await p.locator("#workflow-name").inputValue(),
    "Research batch · GB",
  );
  record("Oversized file rejected without editor change");
  const allowedWorkflow = JSON.parse(
    await readFile("tests/actual-live-evidence.json", "utf8"),
  ).workflow;
  allowedWorkflow.name = "Allowed 2 MiB import";
  const body = Buffer.from(JSON.stringify(allowedWorkflow));
  const input = Buffer.concat([
    body,
    Buffer.alloc(2 * 1024 * 1024 - body.length, 32),
  ]);
  const began = Date.now();
  await p.locator('[data-action="import-workflow"]').click();
  await p
    .locator("#import-file")
    .setInputFiles({
      name: "allowed.json",
      mimeType: "application/json",
      buffer: input,
    });
  await p.waitForFunction(
    () =>
      document.querySelector("#workflow-name").value === "Allowed 2 MiB import",
  );
  record(
    `Allowed 2 MiB import parsed and usable in ${Date.now() - began} ms (including browser interaction)`,
  );

  // This is a labelled mock: move recorded intensity values onto synthetic
  // future timestamps so the fault test does not expire after the build day.
  const recorded = JSON.parse(await readFile("dist/forecast.json", "utf8"));
  const origin = Math.ceil(Date.now() / 1800000) * 1800000;
  const future = {
    response: {
      data: Array.from({ length: 96 }, (_, i) => ({
        from: new Date(origin + i * 1800000).toISOString(),
        to: new Date(origin + (i + 1) * 1800000).toISOString(),
        intensity: {
          forecast: recorded.slots[i % recorded.slots.length].value,
        },
      })),
    },
  };
  await c.route("https://api.carbonintensity.org.uk/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(future.response),
    }),
  );
  await p.locator("#horizon").fill("48");
  await p.locator("#horizon").dispatchEvent("change");
  await p.locator('[data-action="live"]').click();
  await p.getByText("Live GB loaded.", { exact: false }).waitFor();
  const dl = p.waitForEvent("download");
  await p
    .getByText("Inspect exact interval values and dataset", { exact: true })
    .click();
  await p.locator('[data-action="download-data"]').click();
  const download = await dl;
  await download.saveAs("tests/full-day-forecast.json");
  const f = JSON.parse(await readFile("tests/full-day-forecast.json", "utf8"));
  assert.equal(f.slots.length, 48);
  assert.equal(
    Date.parse(f.slots[47].to) - Date.parse(f.slots[0].from),
    86400000,
  );
  assert.ok(Date.parse(f.slots[0].from) > Date.now());
  record(
    "48-hour normalization supplies a full future 24-hour horizon (explicitly mocked provider)",
  );
  await c.close();
  [c, p] = await open(() => {
    window.Worker = class {
      constructor() {}
      terminate() {}
      postMessage(m) {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: "error",
              runId: "stale-id",
              fingerprint: m.fingerprint,
              error: "stale failure",
            },
          });
          this.onmessage?.({
            data: {
              type: "result",
              runId: m.runId,
              fingerprint: m.fingerprint,
              result: { config: { maxNodes: -1, maxMs: -1 } },
            },
          });
        }, 15);
      }
    };
  });
  await p.locator('[data-action="analyze"]').first().click();
  await p.getByText("Analysis failed safely:", { exact: false }).waitFor();
  assert.match(
    await p.locator("#notice").textContent(),
    /configuration mismatch/,
  );
  assert.ok(
    !(await p.locator("#results").textContent()).includes(
      "Independent verification PASS",
    ),
  );
  record("Stale Worker error ignored; forged active result rejected safely");
  await c.close();
  await writeFile(
    "tests/hardening-results.json",
    JSON.stringify({ checks }, null, 2),
  );
} catch (e) {
  console.error(e);
  await b.close();
  process.exit(1);
}
await b.close();
process.exit(0);
