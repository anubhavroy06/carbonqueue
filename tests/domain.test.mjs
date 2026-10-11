import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  solve,
  verify,
  validateWorkflow,
  validateForecast,
  diagnose,
  checkCertificate,
  baseline,
  example,
  transform,
  fingerprint,
  validatePacket,
  timeContext,
  VERSION,
} from "../dist/domain.js";
const real = JSON.parse(await readFile("dist/forecast.json", "utf8"));
function series(h = 6) {
  return {
    ...structuredClone(real),
    mode: "CUSTOM",
    kind: "synthetic",
    slots: Array.from({ length: h }, (_, i) => ({
      from: new Date(Date.UTC(2026, 9, 11, 0, i * 30)).toISOString(),
      to: new Date(Date.UTC(2026, 9, 11, 0, (i + 1) * 30)).toISOString(),
      value: [100, 300, 80, 20, 250, 50, 10, 40, 80, 100][i % 10],
    })),
  };
}
function task(id, opts = {}) {
  return {
    id,
    name: id,
    notes: "",
    resourceId: "r",
    duration: 1,
    energyKWh: 1,
    release: 0,
    deadline: 6,
    dependsOn: [],
    ...opts,
  };
}
function workflow(tasks, h = 6, resources = [{ id: "r", name: "R" }]) {
  return {
    schemaVersion: 1,
    id: "w",
    name: "Test",
    horizon: h,
    resources,
    tasks,
  };
}
// Independent all-start Cartesian reference: no domain feasibility or objective functions.
function reference(w, f) {
  let minimum = Infinity,
    count = 0;
  const starts = [];
  function rec(i) {
    if (i === w.tasks.length) {
      count++;
      for (let j = 0; j < starts.length; j++) {
        const t = w.tasks[j],
          s = starts[j];
        if (s < t.release || s + t.duration > t.deadline) return;
        for (const d of t.dependsOn) {
          const k = w.tasks.findIndex((x) => x.id === d);
          if (starts[k] + w.tasks[k].duration > s) return;
        }
      }
      for (let j = 0; j < starts.length; j++)
        for (let k = j + 1; k < starts.length; k++) {
          const a = w.tasks[j],
            b = w.tasks[k];
          if (
            a.resourceId === b.resourceId &&
            starts[j] < starts[k] + b.duration &&
            starts[k] < starts[j] + a.duration
          )
            return;
        }
      let g = 0;
      for (let j = 0; j < starts.length; j++) {
        const t = w.tasks[j];
        for (let s = starts[j]; s < starts[j] + t.duration; s++)
          g += (f.slots[s].value * t.energyKWh) / t.duration;
      }
      minimum = Math.min(minimum, g);
      return;
    }
    for (let s = 0; s <= w.horizon - w.tasks[i].duration; s++) {
      starts[i] = s;
      rec(i + 1);
    }
  }
  rec(0);
  return { minimum, count };
}
const exact = { maxNodes: 1000000, maxMs: 60000 };
test("real snapshot continuity and provenance", () =>
  assert.deepEqual(validateForecast(real), []));
test("known optimum and verifier arithmetic", () => {
  const w = workflow([task("a"), task("b", { dependsOn: ["a"] })]),
    f = series();
  const r = solve(w, f, exact);
  assert.equal(r.status, "OPTIMAL");
  assert.equal(r.verification.grams, reference(w, f).minimum);
  assert.ok(verify(w, f, r.schedule).valid);
});
test("100 seeded generated cases independently enumerated", () => {
  let seed = 29011;
  const rand = (n) => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed % n;
  };
  let assignments = 0;
  for (let i = 0; i < 100; i++) {
    const n = 1 + rand(4),
      rs = [
        { id: "r", name: "R" },
        { id: "s", name: "S" },
      ],
      tasks = [];
    for (let j = 0; j < n; j++) {
      const release = rand(3),
        deadline = release + 1 + rand(6 - release);
      tasks.push(
        task("t" + j, {
          resourceId: rs[rand(2)].id,
          release,
          deadline,
          duration: 1 + rand(2),
          energyKWh: rand(8) / 4,
          dependsOn: j && rand(3) === 0 ? ["t" + rand(j)] : [],
        }),
      );
    }
    const w = workflow(tasks, 6, rs),
      f = series(),
      ref = reference(w, f);
    assignments += ref.count;
    const r = solve(w, f, exact);
    if (ref.minimum === Infinity) {
      assert.equal(r.status, "INFEASIBLE", "seed case " + i);
      if (r.certificate) assert.ok(checkCertificate(w, r.certificate));
    } else {
      assert.equal(r.status, "OPTIMAL", "seed case " + i);
      assert.ok(
        Math.abs(r.verification.grams - ref.minimum) < 1e-7,
        "objective case " + i,
      );
      assert.ok(verify(w, f, r.schedule).valid);
    }
  }
  console.log(
    "Generated cases=100; initial seed=29011; Cartesian assignments=" +
      assignments,
  );
});
test("greedy failure is not infeasibility", () => {
  const w = workflow(
      [
        task("a", { deadline: 10 }),
        task("b", { dependsOn: ["a"], deadline: 4 }),
        task("c", { duration: 3, deadline: 5 }),
      ],
      10,
    ),
    f = series(10);
  assert.equal(baseline(w, f), null);
  const r = solve(w, f, exact);
  assert.equal(r.status, "OPTIMAL");
  assert.ok(r.verification.valid);
});
test("critical path certificate respects parallel parents", () => {
  const w = workflow(
    [
      task("a", { resourceId: "r", duration: 2 }),
      task("b", { resourceId: "s", duration: 2 }),
      task("c", { dependsOn: ["a", "b"], deadline: 3 }),
    ],
    6,
    [
      { id: "r", name: "R" },
      { id: "s", name: "S" },
    ],
  );
  assert.equal(diagnose(w), null);
  assert.equal(solve(w, series(), exact).status, "OPTIMAL");
  w.tasks[2].deadline = 2;
  const c = diagnose(w);
  assert.equal(c.required, 3);
  assert.ok(checkCertificate(w, c));
  assert.equal(checkCertificate(w, { ...c, required: 99 }), false);
});
test("window, cycle and resource-overload certificates", () => {
  const w = workflow([task("a", { duration: 3, deadline: 2 })]);
  assert.equal(diagnose(w).type, "WINDOW");
  const x = workflow([
    task("a", { dependsOn: ["b"] }),
    task("b", { dependsOn: ["a"] }),
  ]);
  assert.ok(validateWorkflow(x).some((e) => e.includes("cycle")));
  assert.equal(diagnose(x).type, "CYCLE");
  const z = workflow([
    task("a", { duration: 2, deadline: 3 }),
    task("b", { duration: 2, deadline: 3 }),
  ]);
  assert.equal(diagnose(z).type, "OVERLOAD");
});
test("node limit never claims infeasibility or optimality", () => {
  const w = example(),
    f = real;
  const r = solve(w, f, { maxNodes: 1, maxMs: 1000 });
  assert.equal(r.status, "FEASIBLE_BEST_FOUND");
  assert.ok(r.verification.grams <= r.baselineVerification.grams);
  const x = workflow(
    [
      task("a", { deadline: 10 }),
      task("b", { dependsOn: ["a"], deadline: 4 }),
      task("c", { duration: 3, deadline: 5 }),
    ],
    10,
  );
  assert.equal(
    solve(x, series(10), { maxNodes: 1, maxMs: 1000 }).status,
    "UNKNOWN",
  );
});
test("verifier rejects duplicate, missing, overlap, precedence, duration/window", () => {
  const w = workflow([task("a"), task("b", { dependsOn: ["a"] })]),
    f = series();
  for (const a of [
    [],
    [
      { taskId: "a", resourceId: "r", start: 0 },
      { taskId: "a", resourceId: "r", start: 1 },
    ],
    [
      { taskId: "a", resourceId: "r", start: 0 },
      { taskId: "b", resourceId: "r", start: 0 },
    ],
    [
      { taskId: "a", resourceId: "r", start: 5 },
      { taskId: "b", resourceId: "r", start: 4 },
    ],
    [
      { taskId: "a", resourceId: "r", start: -1 },
      { taskId: "b", resourceId: "r", start: 1 },
    ],
  ])
    assert.equal(verify(w, f, a).valid, false);
});
test("invalid workflows and forecasts are rejected", () => {
  for (const mutate of [
    (w) => (w.tasks[0].energyKWh = -1),
    (w) => (w.tasks[0].duration = 0.5),
    (w) => (w.tasks[0].resourceId = "absent"),
    (w) => (w.tasks[0].dependsOn = ["absent"]),
    (w) => w.tasks.push({ ...w.tasks[0] }),
    (w) => (w.horizon = 49),
  ]) {
    const w = workflow([task("a")]);
    mutate(w);
    assert.ok(validateWorkflow(w).length);
  }
  const f = series();
  f.slots[1].from = f.slots[0].from;
  assert.ok(validateForecast(f).length);
  f.slots[1].value = NaN;
  assert.ok(validateForecast(f).length);
});
test("zero energy and zero intensity are valid", () => {
  const w = workflow([task("a", { energyKWh: 0 })]);
  assert.equal(solve(w, series(), exact).verification.grams, 0);
  const f = series();
  f.slots.forEach((s) => (s.value = 0));
  assert.equal(solve(workflow([task("a")]), f, exact).verification.grams, 0);
});
test("metamorphic scale, renaming, unused resource, relaxation", () => {
  const w = workflow([task("a"), task("b", { dependsOn: ["a"], deadline: 4 })]),
    f = series(),
    r = solve(w, f, exact);
  const scaled = transform(f, "uniform", 1.5);
  assert.ok(
    Math.abs(
      solve(w, scaled, exact).verification.grams - r.verification.grams * 1.5,
    ) < 1e-7,
  );
  const named = structuredClone(w);
  named.tasks[0].id = "z";
  named.tasks[1].dependsOn = ["z"];
  assert.equal(solve(named, f, exact).verification.grams, r.verification.grams);
  const extra = structuredClone(w);
  extra.resources.push({ id: "unused", name: "Unused" });
  assert.equal(solve(extra, f, exact).verification.grams, r.verification.grams);
  const relaxed = structuredClone(w);
  relaxed.tasks[1].dependsOn = [];
  relaxed.tasks[1].deadline = 6;
  assert.ok(
    solve(relaxed, f, exact).verification.grams <= r.verification.grams,
  );
});
test("evidence reimport rejects tampered arithmetic and preserves fingerprint", async () => {
  const w = workflow([task("a")]),
    f = series(),
    c = exact,
    r = solve(w, f, c),
    p = {
      schemaVersion: 1,
      appVersion: VERSION,
      timeContext: timeContext(w, f, r.schedule),
      id: "p",
      name: "Packet",
      createdAt: new Date().toISOString(),
      runId: "run",
      fingerprint: await fingerprint(w, f, c),
      workflow: w,
      forecast: f,
      result: r,
      assumptions: [],
    };
  assert.deepEqual(validatePacket(p), []);
  const q = JSON.parse(JSON.stringify(p));
  assert.equal(
    await fingerprint(q.workflow, q.forecast, q.result.config),
    p.fingerprint,
  );
  q.result.verification.grams += 1;
  assert.ok(validatePacket(q).some((x) => x.includes("objective")));
});
test("six tasks on two resources match exhaustive small-horizon reference", () => {
  const w = workflow(
      Array.from({ length: 6 }, (_, i) =>
        task("six" + i, {
          resourceId: i % 2 ? "r" : "s",
          deadline: 5,
          energyKWh: 0.1 * (i + 1),
          dependsOn: i >= 4 ? ["six" + (i - 4)] : [],
        }),
      ),
      5,
      [
        { id: "r", name: "R" },
        { id: "s", name: "S" },
      ],
    ),
    f = series(5),
    ref = reference(w, f),
    r = solve(w, f, exact);
  assert.equal(r.status, "OPTIMAL");
  assert.ok(Math.abs(ref.minimum - r.verification.grams) < 1e-7);
});
test("live freshness and future coverage fail closed", async () => {
  const { validateLive } = await import("../dist/domain.js");
  const f = series(),
    w = workflow([task("a")]);
  f.mode = "LIVE";
  f.kind = "forecast";
  f.geography = "GB";
  f.retrievedAt = new Date().toISOString();
  assert.ok(validateLive(f, w).some((e) => e.includes("expired/past")));
});
test("unknown schema and tampered baseline metadata are rejected", async () => {
  const w = workflow([task("a")]),
    f = series(),
    r = solve(w, f, exact);
  const p = {
    schemaVersion: 1,
    appVersion: VERSION,
    timeContext: timeContext(w, f, r.schedule),
    id: "p",
    name: "Packet",
    createdAt: new Date().toISOString(),
    runId: "r",
    fingerprint: await fingerprint(w, f, exact),
    workflow: w,
    forecast: f,
    result: r,
    assumptions: [],
  };
  p.result.baselineVerification.grams = NaN;
  assert.ok(validatePacket(p).length);
  p.schemaVersion = 2;
  assert.ok(validatePacket(p).length);
});
test("strict UTC intervals, provenance and nesting are required", () => {
  const f = series();
  f.slots[0].from = f.slots[0].from.replace("Z", "");
  assert.ok(validateForecast(f).length);
  const g = series();
  g.license = "";
  assert.ok(validateForecast(g).length);
  const h = series();
  let raw = {};
  for (let i = 0; i < 55; i++) raw = { nested: raw };
  h.raw = raw;
  assert.ok(validateForecast(h).length);
});
test("proof checker independently rejects forged claims and accepts cycle", () => {
  const w = workflow([task("a", { duration: 3, deadline: 2 })]),
    c = diagnose(w);
  assert.ok(checkCertificate(w, c));
  assert.equal(
    checkCertificate(w, { ...c, message: "unverified false claim" }),
    false,
  );
  const cyclic = workflow([
    task("a", { dependsOn: ["b"] }),
    task("b", { dependsOn: ["a"] }),
  ]);
  assert.ok(checkCertificate(cyclic, diagnose(cyclic)));
});
test("time conversion metadata binds UTC windows and schedule across timezones", async () => {
  const w = workflow([task("a")]),
    f = series(),
    r = solve(w, f, exact),
    tc = timeContext(w, f, r.schedule, "Asia/Kolkata");
  assert.equal(tc.originUTC, new Date(f.slots[0].from).toISOString());
  assert.equal(
    tc.tasks[0].deadlineUTC,
    new Date(Date.parse(f.slots[0].from) + 6 * 1800000).toISOString(),
  );
  assert.match(tc.tasks[0].releaseLocal, /05:30/);
  const p = {
    schemaVersion: 1,
    appVersion: VERSION,
    id: "time",
    name: "Time",
    createdAt: new Date().toISOString(),
    runId: "run",
    fingerprint: await fingerprint(w, f, exact),
    workflow: w,
    forecast: f,
    result: r,
    assumptions: [],
    timeContext: tc,
  };
  assert.deepEqual(validatePacket(p), []);
  p.timeContext.tasks[0].startUTC = "forged";
  assert.ok(validatePacket(p).some((e) => e.includes("time conversion")));
});
test("legacy evidence remains verifiable but new evidence requires time context", async () => {
  const w = workflow([task("a")]),
    f = series(),
    r = solve(w, f, exact),
    p = {
      schemaVersion: 1,
      appVersion: "1.0.0",
      id: "legacy",
      name: "Legacy",
      createdAt: new Date().toISOString(),
      runId: "r",
      fingerprint: await fingerprint(w, f, exact),
      workflow: w,
      forecast: f,
      result: r,
      assumptions: [],
    };
  assert.deepEqual(validatePacket(p), []);
  p.appVersion = VERSION;
  assert.ok(validatePacket(p).some((e) => e.includes("metadata missing")));
});
test("invalid budgets and malformed freshness inputs fail safely", async () => {
  const { validateLive } = await import("../dist/domain.js");
  assert.ok(validateLive(null, workflow([task("a")])).length);
  const w = workflow([task("a")]),
    f = series(),
    r = solve(w, f, exact),
    p = {
      schemaVersion: 1,
      appVersion: VERSION,
      id: "budget",
      name: "Budget",
      createdAt: new Date().toISOString(),
      runId: "r",
      fingerprint: await fingerprint(w, f, exact),
      workflow: w,
      forecast: f,
      result: r,
      assumptions: [],
      timeContext: timeContext(w, f, r.schedule),
    };
  p.result.config = { maxNodes: 0, maxMs: 999999 };
  assert.ok(validatePacket(p).some((e) => e.includes("configuration")));
});
