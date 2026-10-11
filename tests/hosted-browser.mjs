import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.connectOverCDP(process.env.AGENT_BROWSER_CDP);
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
await context.addInitScript(() => { const original = URL.createObjectURL; URL.createObjectURL = function(blob){ const url=original.call(this,blob); if(blob instanceof Blob)window.__cqLastExport=blob.text(); return url; }; });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [],
  check = (name, detail = "PASS") => {
    results.push({ name, detail });
    console.log(name + ": " + detail);
  };
async function analyze() {
  await page.locator('[data-action="analyze"]').first().click();
  await page
    .getByText("Analysis complete:", { exact: false })
    .waitFor({ timeout: 15000 });
  await page
    .locator("#results .tag")
    .filter({ hasText: /OPTIMAL|FEASIBLE|INFEASIBLE|UNKNOWN/ })
    .first()
    .waitFor();
}
async function confirm() {
  await page.locator('#confirm-dialog button[value="confirm"]').click();
}
async function exportFile(action, name) {
  const promise = page.waitForEvent("download");
  await page.locator(`[data-action="${action}"]`).click();
  const d = await promise;
  assert.ok(d.suggestedFilename());
  const content=await page.evaluate(async()=>await window.__cqLastExport);
  await writeFile("tests/hosted-" + name,content);
  return JSON.parse(await readFile("tests/hosted-" + name, "utf8"));
}
try {
  const began = Date.now();
  const response = await page.goto("https://carbonqueue.pages.dev", {waitUntil: "domcontentloaded"});
  assert.ok(response.ok(), "Public origin did not return success");
  const headers = await response.allHeaders();
  assert.ok(headers["content-security-policy"]?.includes("frame-ancestors 'none'"));
  assert.ok(headers["content-security-policy"]?.includes("worker-src 'self'"));
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "no-referrer");
  check("Anonymous HTTPS and deployed security headers", response.status()+"; CSP/Worker policy/nosniff/referrer passed");
  const release = await page.evaluate(async()=>await (await fetch('./release.json')).json());
  const expectedRelease=JSON.parse(await readFile('dist/release.json','utf8'));
  assert.equal(release.version,expectedRelease.version);
  assert.equal(release.buildHash,expectedRelease.buildHash);
  check("Hosted version and build identity match verified source");
  await page.locator("h1").waitFor();
  check("Cold production load", Date.now() - began + " ms");
  await analyze();
  assert.ok(
    await page
      .locator("#results")
      .getByText("Independent verification PASS", { exact: false })
      .isVisible(),
  );
  check("Initial workflow and independently verified result");
  const packet = await exportFile("export-evidence", "exported-evidence.json");
  assert.ok(packet.result.verification.valid);
  check("Evidence download");
  await page.locator('[data-action="save-scenario"]').click();
  await page.locator('[data-action="save-workflow"]').click();
  await page.locator('[data-action="contradiction"]').click();
  await page
    .getByText("Analysis complete: INFEASIBLE", { exact: false })
    .waitFor();
  assert.ok(await page.getByText("Certificate recheck: PASS").isVisible());
  check("Critical-path infeasibility certificate");
  await page.locator('[data-action="save-scenario"]').click();
  await page.locator('[data-action="restore-deadline"]').click();
  await page.getByText("Analysis complete:", { exact: false }).waitFor();
  assert.ok(
    await page
      .locator("#results")
      .getByText("Independent verification PASS", { exact: false })
      .isVisible(),
  );
  check("Deadline counterfactual restored");
  await page.locator("#whatif details").click();
  await page.locator("#sens-kind").selectOption("window");
  await page.locator("#sens-mag").fill("0.5");
  await page.locator("#sens-mag").dispatchEvent("change");
  await page.locator('[data-action="sensitivity"]').click();
  await page.getByText("Analysis complete:", { exact: false }).waitFor();
  assert.ok((await page.locator("#results").textContent()).includes("CUSTOM"));
  check("Nonuniform sensitivity recomputation");
  await page.locator('[data-action="save-scenario"]').click();
  assert.ok((await page.locator("#comparison tbody tr").count()) >= 3);
  check("Three saved scenarios and comparison conditions");
  await page.locator('[data-action="import-evidence"]').click();
  await page
    .locator("#import-file")
    .setInputFiles("tests/hosted-exported-evidence.json");
  await page
    .getByText("Imported schedule and arithmetic rechecked.", { exact: false })
    .waitFor();
  check("Evidence reimport verification");
  // Add two tasks to the four-job example, preserving two resources.
  await page.locator('[data-action="replay"]').click();
  await page.locator('[data-action="add-task"]').click();
  await page.locator('[data-action="add-task"]').click();
  await analyze();
  assert.equal(await page.locator(".task-card").count(), 6);
  check("Six-task, two-resource analysis");
  const backup = await exportFile("export-backup", "exported-backup.json");
  assert.equal(backup.workflow.tasks.length, 6);
  check("Workspace backup export");
  await page.locator('[data-action="import-backup"]').click();
  await page
    .locator("#import-file")
    .setInputFiles("tests/hosted-exported-backup.json");
  await page.locator("#confirm-dialog").waitFor();
  await confirm();
  await page.getByText("Validated backup restored transactionally.").waitFor();
  check("Transactional backup merge");
  // Autosave and actual offline shell, not only an already loaded page.
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.locator("h1").waitFor();
  await page.waitForTimeout(300);
  await context.setOffline(true);
  await page.reload();
  await page.locator("h1").waitFor();
  await analyze();
  check("Offline reload and real recomputation");
  await exportFile("export-evidence", "offline-evidence.json");
  check("Offline evidence export");
  await context.setOffline(false);
  await page.locator("#workflow-name").fill("<img src=x onerror=alert(1)>");
  await page.locator("#workflow-name").dispatchEvent("change");
  assert.equal(await page.locator('img[src="x"]').count(), 0);
  check("Imported/editor text is escaped");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await writeFile(
    "tests/hosted-accessibility.json",
    JSON.stringify(axe.violations, null, 2),
  );
  check("Automated accessibility scan", axe.violations.length + " violations");
  await page.screenshot({ path: "tests/hosted-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "tests/hosted-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  check("390px mobile no horizontal page overflow");
  await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() => document.activeElement !== document.body),
  );
  check("Keyboard focus reachable");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "tests/hosted-preview.png", fullPage: false });
  assert.deepEqual(errors, []);
  check("No uncaught browser errors");
  await writeFile(
    "tests/hosted-browser-results.json",
    JSON.stringify(
      { verifiedAt:new Date().toISOString(),url:"https://carbonqueue.pages.dev",results, pageErrors: errors, axeViolations: axe.violations.length },
      null,
      2,
    ),
  );
  if (axe.violations.length)
    console.log(
      "ACCESSIBILITY REPAIR REQUIRED:",
      axe.violations.map((x) => x.id).join(","),
    );
} catch (e) {
  await page.screenshot({ path: "tests/hosted-failure.png", fullPage: false });
  console.error(e);
  console.error("Page errors", errors);
  await writeFile(
    "tests/hosted-browser-failure.json",
    JSON.stringify({ message: e.message, errors, results }, null, 2),
  );
  await context.close();
  process.exit(1);
}
await context.close();
process.exit(0);
