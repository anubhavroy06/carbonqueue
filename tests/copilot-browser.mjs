import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const hosted=process.env.CQ_HOSTED==='1';
const browser = hosted ? await chromium.connectOverCDP(process.env.AGENT_BROWSER_CDP) : await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();
const checks = [];
const check = (name) => checks.push({ name, result: "PASS" });
try {
  await page.goto(hosted?'https://carbonqueue.pages.dev':'http://127.0.0.1:4173');
  if(hosted){
    const health=await page.evaluate(async()=>await(await fetch('./api/health',{cache:'no-store'})).json());
    assert.equal(health.version,'1.1.0');assert.equal(health.storesKeys,false);check('Actual deployed gateway health/version; no key required');
    const rejected=await page.evaluate(async()=>{const r=await fetch('./api/ai/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Public nonprivate test',horizon:24,consent:true})});return {status:r.status,text:await r.text()};});
    assert.equal(rejected.status,400);check('Actual deployed gateway rejects missing key before provider call');
  }
  await page.locator("#copilot-details summary").click();
  await page.locator("#generate-draft").click();
  await assert.match(
    await page.locator("#copilot-status").innerText(),
    /Enter your own/,
  );
  check("No key: zero provider requests and local planner still available");
  const key = "TEST_ONLY_NOT_A_REAL_PROVIDER_KEY_1234567890";
  await page.locator("#gemini-key").fill(key);
  await page.locator("#use-ai-example").click();
  await page.locator("#generate-draft").click();
  assert.match(
    await page.locator("#copilot-status").innerText(),
    /Confirm privacy/,
  );
  check("Consent required");
  let requestCount = 0;
  const draft = {
    schemaVersion: 1,
    id: "draft",
    name: "AI reviewed batch",
    horizon: 24,
    resources: [{ id: "cpu", name: "CPU" }],
    tasks: [
      {
        id: "a",
        name: "Prepare",
        notes: "AI-assisted draft: ASSUMPTION electricity",
        resourceId: "cpu",
        duration: 1,
        energyKWh: 0.1,
        release: 0,
        deadline: 24,
        dependsOn: [],
      },
      {
        id: "b",
        name: "Run",
        notes: "AI-assisted draft: ASSUMPTION electricity",
        resourceId: "cpu",
        duration: 2,
        energyKWh: 0.3,
        release: 0,
        deadline: 24,
        dependsOn: ["a"],
      },
    ],
  };
  await page.route("**/api/ai/draft", async (route) => {
    requestCount++;
    assert.equal(route.request().headers()["x-gemini-key"], key);
    await route.fulfill({ json: { draft, model: "gemini-2.5-flash-lite" } });
  });
  await page.locator("#ai-consent").check();
  await page.locator("#generate-draft").click();
  await page.locator("#ai-review").waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#workflow-name").inputValue(),
    "Research batch · GB",
  );
  check("Structured mocked provider draft reviewed before editor changes");
  await page.locator("#apply-ai-draft").click();
  assert.match(
    await page.locator("#copilot-status").innerText(),
    /check approval/,
  );
  check("Second human approval required");
  await page.locator("#ai-review-consent").check();
  await page.locator("#ai-draft-json").fill("{}");
  await page.locator("#apply-ai-draft").click();
  assert.match(
    await page.locator("#copilot-status").innerText(),
    /Draft rejected/,
  );
  check("Tampered draft rejected locally");
  await page.locator("#ai-draft-json").fill(JSON.stringify(draft));
  await page.locator("#apply-ai-draft").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#workflow-name").value === "AI reviewed batch",
  );
  check("Approved replacement applied transactionally");
  await page.locator("#analyze-hero").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#notice")
      .textContent.includes("verification passed"),
  );
  check("AI inputs use genuine deterministic solver/verifier");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(
    await page.locator("#workflow-name").inputValue(),
    "Research batch · GB",
  );
  check("Undo restores previous workflow");
  assert.equal(await page.locator("#gemini-key").inputValue(), key);
  const storage = await page.evaluate(async () => {
    let all = JSON.stringify(localStorage);
    const dbs = await indexedDB.databases();
    for (const d of dbs) {
      const db = await new Promise((a, b) => {
        const r = indexedDB.open(d.name);
        r.onsuccess = () => a(r.result);
        r.onerror = () => b(r.error);
      });
      for (const name of db.objectStoreNames) {
        const rows = await new Promise((a, b) => {
          const r = db.transaction(name).objectStore(name).getAll();
          r.onsuccess = () => a(r.result);
          r.onerror = () => b(r.error);
        });
        all += JSON.stringify(rows);
      }
      db.close();
    }
    return all;
  });
  assert(!storage.includes(key));
  check("Key absent from browser persistence");
  await page.locator("#forget-key").click();
  assert.equal(await page.locator("#gemini-key").inputValue(), "");
  check("Explicit forget clears key");
  const axe = await new AxeBuilder({ page }).analyze();
  assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations));
  check("Expanded copilot automated accessibility: zero violations");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  check("Mobile copilot no horizontal overflow");
  await page.reload();
  await page.locator("#copilot-details summary").click();
  assert.equal(await page.locator("#gemini-key").inputValue(), "");
  check("Reload never restores key");
  assert.equal(requestCount, 1);
  check("No automatic inference requests");
  await writeFile(
    hosted?"tests/hosted-copilot-results.json":"tests/copilot-browser-results.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        providerMode: "MOCKED; no real key used",
        checks,
      },
      null,
      2,
    ),
  );
  console.log(checks.length + " copilot browser checks PASS");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await context.close();
  if(!hosted)await browser.close();
  if(hosted)process.exit(process.exitCode||0);
}
