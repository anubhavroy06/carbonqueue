import { solve, verify, example } from "../dist/domain.js";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
const f = JSON.parse(await readFile("dist/forecast.json", "utf8"));
const w = example(),
  runs = [];
for (let i = 0; i < 10; i++) {
  const r = solve(w, f);
  if (!r.schedule || !verify(w, f, r.schedule).valid)
    throw Error("Benchmark returned invalid schedule");
  runs.push({
    status: r.status,
    nodes: r.nodes,
    elapsedMs: r.elapsedMs,
    grams: r.verification.grams,
  });
}
const stress = example();
stress.horizon = 48;
stress.tasks = Array.from({ length: 6 }, (_, i) => ({
  id: "stress" + i,
  name: "Stress " + i,
  notes: "zero-energy tie stress",
  resourceId: i % 2 ? "cpu" : "gpu",
  duration: 1,
  energyKWh: 0,
  release: 0,
  deadline: 48,
  dependsOn: [],
}));
const stressRun = solve(stress, f);
if (!verify(stress, f, stressRun.schedule).valid)
  throw Error("Invalid stress assignment");
const bytes = {};
for (const name of await readdir("dist"))
  bytes[name] = (await stat("dist/" + name)).size;
const result = {
  measuredAt: new Date().toISOString(),
  platform: os.platform(),
  architecture: os.arch(),
  cpu: os.cpus()[0]?.model,
  node: process.version,
  files: bytes,
  totalBytes: Object.values(bytes).reduce((a, b) => a + b, 0),
  runs,
  stress: {
    status: stressRun.status,
    nodes: stressRun.nodes,
    elapsedMs: stressRun.elapsedMs,
    verification: stressRun.verification.valid,
  },
};
await writeFile("tests/performance.json", JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    bytes: result.totalBytes,
    medianMs: runs.map((x) => x.elapsedMs).sort((a, b) => a - b)[5],
    stress: result.stress,
  }),
);
