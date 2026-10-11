import { launchBrowser } from "./support/browser.mjs";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const b = await launchBrowser(),
  p = await (await b.newContext()).newPage();
const checks = [];
try {
  await p.goto("http://127.0.0.1:4173");
  await p.locator("h1").waitFor();
  await p.keyboard.press("Tab");
  await p.keyboard.press("Enter");
  assert.equal(await p.evaluate(() => document.activeElement.id), "main");
  checks.push("Keyboard skip link targets main");
  await p.locator('[data-action="analyze"]').first().focus();
  await p.keyboard.press("Enter");
  await p.getByText("Analysis complete:", { exact: false }).waitFor();
  assert.equal(
    await p.evaluate(() => document.activeElement.dataset.action),
    "analyze",
  );
  checks.push("Keyboard analysis activation retains focus");
  await p.locator('[data-action="delete-task"]').last().focus();
  await p.keyboard.press("Enter");
  await p.locator("#confirm-dialog").waitFor();
  const axe = await new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  assert.equal(axe.violations.length, 0);
  checks.push("Open confirmation dialog accessibility scan: zero violations");
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press("Tab");
    assert.ok(
      await p.evaluate(
        () => !!document.activeElement.closest("#confirm-dialog"),
      ),
    );
  }
  checks.push("Native modal keeps keyboard focus inside");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(100);
  assert.equal(
    await p.evaluate(() => document.activeElement.dataset.action),
    "delete-task",
  );
  checks.push("Escape returns focus to trigger");
  await p.keyboard.press("Enter");
  await p.locator("#confirm-dialog").waitFor();
  await p.locator("#confirm-dialog button[value=confirm]").focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(100);
  assert.equal(await p.locator(".task-card").count(), 3);
  assert.equal(
    await p.evaluate(() => document.activeElement.dataset.action),
    "add-task",
  );
  checks.push("Confirmed deletion has logical keyboard focus destination");
  await p.setViewportSize({ width: 640, height: 900 });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  checks.push("640 CSS-pixel reflow checked (not full WCAG certification)");
  await writeFile(
    "tests/keyboard-results.json",
    JSON.stringify({ checks }, null, 2),
  );
  console.log(checks.join("\n"));
} catch (e) {
  console.error(e);
  await b.close();
  process.exit(1);
}
await b.close();
process.exit(0);
