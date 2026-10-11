import { launchBrowser } from "../tests/support/browser.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const b = await launchBrowser(),
  c = await b.newContext({ viewport: { width: 1440, height: 1000 } }),
  p = await c.newPage();
try {
  await p.goto("http://127.0.0.1:4173");
  await p.locator("h1").waitFor();
  await p.locator("#analyze-hero").click();
  await p.getByText("Analysis complete:", { exact: false }).waitFor();
  await p.screenshot({ path: "tests/release-desktop.png" });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: "tests/release-mobile.png", fullPage: true });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.setViewportSize({ width: 720, height: 1000 });
  const before = await p
    .locator(".intro")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await p.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const after = await p
    .locator(".intro")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  assert.ok(
    Math.abs(after / before - 2) < 0.01,
    "Text must actually double, not merely change an unused root property.",
  );
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.screenshot({ path: "tests/release-text-zoom.png" });
  await writeFile(
    "tests/visual-results.json",
    JSON.stringify(
      {
        browser: await b.version(),
        viewportDesktop: [1440, 1000],
        mobile: [390, 844],
        textZoom: "200% root font, 720px viewport; measured intro text doubles",
        reflow: "PASS",
        note: "Local Chromium; not a full cross-browser or WCAG certification.",
      },
      null,
      2,
    ),
  );
} finally {
  await b.close();
}
