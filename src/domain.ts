export const VERSION = "1.0.1",
  SCHEMA = 1,
  SLOT_MINUTES = 30;
export type Resource = { id: string; name: string };
export type Task = {
  id: string;
  name: string;
  notes: string;
  resourceId: string;
  duration: number;
  energyKWh: number;
  release: number;
  deadline: number;
  dependsOn: string[];
};
export type Workflow = {
  schemaVersion: 1;
  id: string;
  name: string;
  horizon: number;
  resources: Resource[];
  tasks: Task[];
};
export type Slot = { from: string; to: string; value: number };
export type Forecast = {
  schemaVersion: 1;
  id: string;
  name: string;
  mode: "LIVE" | "REPLAY" | "CUSTOM";
  kind: "forecast" | "measurement" | "synthetic";
  geography: string;
  units: "gCO2/kWh";
  sourceUrl: string;
  license: string;
  retrievedAt: string;
  raw: unknown;
  slots: Slot[];
};
export type Assignment = { taskId: string; resourceId: string; start: number };
export type Verification = {
  valid: boolean;
  errors: string[];
  grams: number;
  energyKWh: number;
  finish: number;
  perTask: Record<string, number>;
};
export type Config = { maxNodes: number; maxMs: number };
export type Certificate = {
  type: "CYCLE" | "WINDOW" | "PATH" | "OVERLOAD";
  taskIds: string[];
  resourceId?: string;
  from?: number;
  to?: number;
  required?: number;
  allowed?: number;
  message: string;
};
export type Result = {
  status: "OPTIMAL" | "FEASIBLE_BEST_FOUND" | "UNKNOWN" | "INFEASIBLE";
  schedule: Assignment[] | null;
  baseline: Assignment[] | null;
  verification: Verification | null;
  baselineVerification: Verification | null;
  certificate: Certificate | null;
  nodes: number;
  elapsedMs: number;
  config: Config;
};
export type Packet = {
  schemaVersion: 1;
  appVersion: string;
  id: string;
  name: string;
  createdAt: string;
  runId: string;
  fingerprint: string;
  workflow: Workflow;
  forecast: Forecast;
  result: Result;
  assumptions: string[];
  timeContext?: TimeContext;
};
export type ForecastInterval = Slot;
export type ForecastSnapshot = Forecast;
export type SolverConfiguration = Config;
export type ScheduleAssignment = Assignment;
export type VerificationResult = Verification;
export type ExplanationCertificate = Certificate;
export type AnalysisResult = Result;
export type EvidencePacket = Packet;
export type Scenario = Packet;
export type WorkspaceBackup = {
  schemaVersion: 1;
  workflow: Workflow;
  forecast: Forecast;
  saved: Workflow[];
  datasets: Forecast[];
  scenarios: Scenario[];
};
export type TimeContext = {
  originUTC: string;
  slotMinutes: 30;
  displayTimeZone: string;
  legacyDerived: boolean;
  tasks: {
    taskId: string;
    releaseUTC: string;
    deadlineUTC: string;
    releaseLocal: string;
    deadlineLocal: string;
    startUTC: string | null;
    finishUTC: string | null;
  }[];
};
export function timeContext(
  w: Workflow,
  f: Forecast,
  a: Assignment[] | null,
  zone = "UTC",
  legacyDerived = false,
): TimeContext {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "long",
  });
  const date = (slot: number) =>
    new Date(Date.parse(f.slots[0].from) + slot * 1800000);
  return {
    originUTC: new Date(f.slots[0].from).toISOString(),
    slotMinutes: 30,
    displayTimeZone: zone,
    legacyDerived,
    tasks: w.tasks.map((t) => {
      const p = a?.find((p) => p.taskId === t.id);
      return {
        taskId: t.id,
        releaseUTC: date(t.release).toISOString(),
        deadlineUTC: date(t.deadline).toISOString(),
        releaseLocal: formatter.format(date(t.release)),
        deadlineLocal: formatter.format(date(t.deadline)),
        startUTC: p ? date(p.start).toISOString() : null,
        finishUTC: p ? date(p.start + t.duration).toISOString() : null,
      };
    }),
  };
}
export const assumptions = [
  "Whole-task kWh is user-supplied; uniform energy over active slots.",
  "Same workload shifting does not reduce kWh.",
  "Forecast-weighted gCO2 is not measured avoided emissions or marginal emissions.",
  "Idle, facility, network and embodied effects excluded.",
  "Planning only: no workload execution, metering or certification.",
];
const integer = (x: unknown) => typeof x === "number" && Number.isInteger(x),
  finite = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const str = (x: unknown, max = 300) =>
  typeof x === "string" && x.trim().length > 0 && x.length <= max;
export function validateWorkflow(w: Workflow): string[] {
  const e: string[] = [];
  if (
    !w ||
    w.schemaVersion !== 1 ||
    !str(w.id) ||
    !str(w.name) ||
    !integer(w.horizon) ||
    w.horizon < 1 ||
    w.horizon > 48
  )
    return [
      "workflow: unsupported schema or invalid name/horizon (1–48 slots).",
    ];
  if (
    !Array.isArray(w.resources) ||
    w.resources.length < 1 ||
    w.resources.length > 2 ||
    !Array.isArray(w.tasks) ||
    w.tasks.length < 1 ||
    w.tasks.length > 6
  )
    return ["workflow: require 1–2 resources and 1–6 tasks."];
  const rs = new Set<string>(),
    ts = new Set<string>();
  for (const r of w.resources) {
    if (!r || !str(r.id) || !str(r.name) || rs.has(r.id))
      e.push("resources: invalid/duplicate ID or name.");
    else rs.add(r.id);
  }
  for (const t of w.tasks) {
    if (!t || !str(t.id) || ts.has(t.id)) {
      e.push("tasks: invalid/duplicate ID.");
      continue;
    }
    ts.add(t.id);
  }
  for (const t of w.tasks) {
    if (!t) continue;
    const p = t.id || "task";
    if (!str(t.name) || typeof t.notes !== "string" || t.notes.length > 2000)
      e.push(`${p}: invalid name/notes.`);
    if (!rs.has(t.resourceId)) e.push(`${p}: missing resource.`);
    if (!integer(t.duration) || t.duration < 1 || t.duration > 48)
      e.push(`${p}: duration must be 1–48 whole slots.`);
    if (!finite(t.energyKWh) || t.energyKWh < 0 || t.energyKWh > 1e6)
      e.push(`${p}: energy must be finite, 0–1,000,000 kWh.`);
    if (
      !integer(t.release) ||
      !integer(t.deadline) ||
      t.release < 0 ||
      t.deadline > w.horizon ||
      t.deadline <= t.release
    )
      e.push(`${p}: invalid release/deadline.`);
    if (
      !Array.isArray(t.dependsOn) ||
      t.dependsOn.length > 6 ||
      new Set(t.dependsOn).size !== t.dependsOn.length
    )
      e.push(`${p}: invalid dependency list.`);
    else
      for (const d of t.dependsOn)
        if (!ts.has(d)) e.push(`${p}: missing dependency ${d}.`);
  }
  if (!e.length && topological(w) === null) e.push("dependencies: cycle.");
  return e;
}
export function validateForecast(f: Forecast): string[] {
  if (
    !f ||
    f.schemaVersion !== 1 ||
    !str(f.id) ||
    !str(f.name) ||
    !["LIVE", "REPLAY", "CUSTOM"].includes(f.mode) ||
    !["forecast", "measurement", "synthetic"].includes(f.kind) ||
    !str(f.geography) ||
    f.units !== "gCO2/kWh" ||
    !str(f.sourceUrl, 2048) ||
    !str(f.license, 512) ||
    !Number.isFinite(Date.parse(f.retrievedAt)) ||
    !Array.isArray(f.slots) ||
    f.slots.length < 1 ||
    f.slots.length > 48
  )
    return [
      "forecast: invalid schema, provenance, units or slot count (1–48).",
    ];
  const e: string[] = [];
  let end = NaN;
  try {
    if (typeof f.raw === "undefined" || JSON.stringify(f.raw).length > 262144)
      e.push("forecast: raw provenance missing or exceeds 256 KiB.");
    let count = 0;
    const stack: [unknown, number][] = [[f.raw, 0]];
    while (stack.length) {
      const [x, depth] = stack.pop()!;
      if (++count > 20000 || depth > 48) {
        e.push("forecast: raw provenance nesting/count limit.");
        break;
      }
      if (x && typeof x === "object")
        for (const child of Object.values(x)) stack.push([child, depth + 1]);
    }
  } catch {
    e.push("forecast: invalid raw provenance.");
  }
  if (f.sourceUrl.length > 2048 || f.license.length > 512)
    e.push("forecast: provenance text exceeds limits.");
  f.slots.forEach((s, i) => {
    const a = Date.parse(s?.from),
      b = Date.parse(s?.to);
    if (
      !s ||
      !finite(s.value) ||
      s.value < 0 ||
      s.value > 1e6 ||
      !Number.isFinite(a) ||
      typeof s.from !== "string" ||
      typeof s.to !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::00(?:\.000)?)?Z$/.test(s.from) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::00(?:\.000)?)?Z$/.test(s.to) ||
      new Date(a).toISOString().slice(0, 16) !== s.from.slice(0, 16) ||
      b - a !== 1800000 ||
      a % 1800000 !== 0 ||
      (i && a !== end)
    )
      e.push(
        `forecast slot ${i}: require contiguous UTC-aligned 30-minute intervals and finite nonnegative intensity.`,
      );
    end = b;
  });
  if (f.mode === "LIVE" && (f.geography !== "GB" || f.kind !== "forecast"))
    e.push("Live requires GB forecast.");
  return e;
}
export function validateLive(
  f: Forecast,
  w: Workflow,
  now = Date.now(),
): string[] {
  const e = validateForecast(f);
  if (e.length) return e;
  if (f.slots.length < w.horizon) e.push("Forecast does not cover horizon.");
  if (
    f.mode === "LIVE" &&
    (Date.parse(f.slots[0]?.from) < now ||
      now - Date.parse(f.retrievedAt) > 1800000)
  )
    e.push("Live forecast expired/past. Refresh and confirm a new horizon.");
  return e;
}
export function topological(w: Workflow): Task[] | null {
  const out: Task[] = [],
    done = new Set<string>();
  while (out.length < w.tasks.length) {
    const ready = w.tasks
      .filter((t) => !done.has(t.id) && t.dependsOn.every((d) => done.has(d)))
      .sort((a, b) => a.deadline - b.deadline || a.id.localeCompare(b.id));
    if (!ready.length) return null;
    const t = ready[0];
    out.push(t);
    done.add(t.id);
  }
  return out;
}
export function cost(t: Task, start: number, slots: Slot[]): number {
  let sum = 0;
  for (let k = start; k < start + t.duration; k++) sum += slots[k].value;
  return (t.energyKWh / t.duration) * sum;
}
export function verify(
  w: Workflow,
  f: Forecast,
  a: Assignment[],
): Verification {
  const errors = [...validateWorkflow(w), ...validateForecast(f)];
  const perTask: Record<string, number> = Object.create(null);
  let grams = 0,
    energyKWh = 0,
    finish = 0;
  if (!Array.isArray(a)) errors.push("schedule: not an array.");
  if (f.slots?.length < w.horizon)
    errors.push("forecast: insufficient horizon.");
  if (errors.length)
    return { valid: false, errors, grams, energyKWh, finish, perTask };
  const map = new Map<string, Assignment>();
  for (const p of a) {
    if (
      !p ||
      !integer(p.start) ||
      !w.tasks.some((t) => t.id === p.taskId) ||
      map.has(p.taskId)
    ) {
      errors.push("schedule: invalid/duplicate assignment.");
      continue;
    }
    map.set(p.taskId, p);
  }
  for (const t of w.tasks) {
    const p = map.get(t.id);
    if (!p) {
      errors.push(`${t.id}: not scheduled.`);
      continue;
    }
    if (
      p.resourceId !== t.resourceId ||
      p.start < t.release ||
      p.start + t.duration > t.deadline ||
      p.start < 0 ||
      p.start + t.duration > w.horizon
    ) {
      errors.push(`${t.id}: resource/window violation.`);
      continue;
    }
    for (const d of t.dependsOn) {
      const dp = map.get(d),
        dt = w.tasks.find((x) => x.id === d)!;
      if (!dp || dp.start + dt.duration > p.start)
        errors.push(`${t.id}: precedence ${d}.`);
    }
    const g =
      (t.energyKWh / t.duration) *
      f.slots
        .slice(p.start, p.start + t.duration)
        .reduce((total, slot) => total + slot.value, 0);
    perTask[t.id] = g;
    grams += g;
    energyKWh += t.energyKWh;
    finish = Math.max(finish, p.start + t.duration);
  }
  for (let i = 0; i < w.tasks.length; i++)
    for (let j = i + 1; j < w.tasks.length; j++) {
      const x = w.tasks[i],
        y = w.tasks[j],
        a = map.get(x.id),
        b = map.get(y.id);
      if (
        a &&
        b &&
        x.resourceId === y.resourceId &&
        a.start < b.start + y.duration &&
        b.start < a.start + x.duration
      )
        errors.push(`${x.id}/${y.id}: resource overlap.`);
    }
  return { valid: !errors.length, errors, grams, energyKWh, finish, perTask };
}
export function diagnose(w: Workflow): Certificate | null {
  const order = topological(w);
  if (!order)
    return {
      type: "CYCLE",
      taskIds: w.tasks.map((t) => t.id),
      message: "Dependency graph contains a cycle.",
    };
  for (const t of w.tasks)
    if (t.duration > t.deadline - t.release)
      return {
        type: "WINDOW",
        taskIds: [t.id],
        required: t.duration,
        allowed: t.deadline - t.release,
        message: `${t.name} needs ${t.duration} slots but its window offers ${t.deadline - t.release}.`,
      };
  const ends = new Map<string, number>(),
    paths = new Map<string, string[]>();
  for (const t of order) {
    let start = t.release,
      path: string[] = [];
    for (const d of t.dependsOn)
      if (ends.get(d)! > start) {
        start = ends.get(d)!;
        path = paths.get(d)!;
      }
    ends.set(t.id, start + t.duration);
    paths.set(t.id, [...path, t.id]);
    if (start + t.duration > t.deadline)
      return {
        type: "PATH",
        taskIds: paths.get(t.id)!,
        required: start + t.duration,
        allowed: t.deadline,
        message: `${paths.get(t.id)!.join(" → ")} cannot finish before slot ${start + t.duration}; deadline is ${t.deadline}. This lower bound respects parallel branches and release times.`,
      };
  }
  for (const r of w.resources) {
    const jobs = w.tasks.filter((t) => t.resourceId === r.id);
    const points = [
      ...new Set(jobs.flatMap((t) => [t.release, t.deadline])),
    ].sort((a, b) => a - b);
    for (const a of points)
      for (const b of points) {
        if (b <= a) continue;
        const inside = jobs.filter((t) => t.release >= a && t.deadline <= b),
          required = inside.reduce((s, t) => s + t.duration, 0);
        if (required > b - a)
          return {
            type: "OVERLOAD",
            resourceId: r.id,
            taskIds: inside.map((t) => t.id),
            from: a,
            to: b,
            required,
            allowed: b - a,
            message: `${r.name}: ${required} required slots within [${a}, ${b}); only ${b - a} available.`,
          };
      }
  }
  return null;
}
export function checkCertificate(w: Workflow, c: Certificate): boolean {
  try {
    if (
      !c ||
      !Array.isArray(c.taskIds) ||
      !c.taskIds.length ||
      c.taskIds.length > 6 ||
      new Set(c.taskIds).size !== c.taskIds.length
    )
      return false;
    const tasks = c.taskIds.map((id) => w.tasks.find((t) => t.id === id));
    if (tasks.some((t) => !t)) return false;
    if (c.type === "CYCLE") {
      const allowed = new Set(c.taskIds),
        gray = new Set<string>(),
        black = new Set<string>();
      const dfs = (id: string): boolean => {
        if (gray.has(id)) return true;
        if (black.has(id)) return false;
        gray.add(id);
        const t = w.tasks.find((t) => t.id === id)!;
        for (const d of t.dependsOn) if (allowed.has(d) && dfs(d)) return true;
        gray.delete(id);
        black.add(id);
        return false;
      };
      return (
        c.message === "Dependency graph contains a cycle." &&
        c.taskIds.some(dfs)
      );
    }
    if (c.type === "WINDOW") {
      if (tasks.length !== 1) return false;
      const t = tasks[0]!;
      const available = t.deadline - t.release;
      return (
        t.duration > available &&
        c.required === t.duration &&
        c.allowed === available &&
        c.message ===
          `${t.name} needs ${t.duration} slots but its window offers ${available}.`
      );
    }
    if (c.type === "PATH") {
      let end = 0;
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i]!;
        if (i && !t.dependsOn.includes(tasks[i - 1]!.id)) return false;
        end = Math.max(end, t.release) + t.duration;
      }
      const deadline = tasks[tasks.length - 1]!.deadline;
      return (
        end > deadline &&
        c.required === end &&
        c.allowed === deadline &&
        c.message ===
          `${c.taskIds.join(" → ")} cannot finish before slot ${end}; deadline is ${deadline}. This lower bound respects parallel branches and release times.`
      );
    }
    if (c.type === "OVERLOAD") {
      if (
        !integer(c.from) ||
        !integer(c.to) ||
        c.from! < 0 ||
        c.to! > w.horizon ||
        c.to! <= c.from!
      )
        return false;
      const r = w.resources.find((r) => r.id === c.resourceId);
      if (!r) return false;
      if (
        tasks.some(
          (t) =>
            t!.resourceId !== r.id ||
            t!.release < c.from! ||
            t!.deadline > c.to!,
        )
      )
        return false;
      const required = tasks.reduce((sum, t) => sum + t!.duration, 0),
        available = c.to! - c.from!;
      return (
        required > available &&
        c.required === required &&
        c.allowed === available &&
        c.message ===
          `${r.name}: ${required} required slots within [${c.from}, ${c.to}); only ${available} available.`
      );
    }
    return false;
  } catch {
    return false;
  }
}
function canPlace(
  t: Task,
  start: number,
  assigned: Assignment[],
  w: Workflow,
): boolean {
  if (start < t.release || start + t.duration > t.deadline) return false;
  for (const d of t.dependsOn) {
    const p = assigned.find((x) => x.taskId === d),
      dt = w.tasks.find((x) => x.id === d)!;
    if (!p || p.start + dt.duration > start) return false;
  }
  return assigned.every((p) => {
    const x = w.tasks.find((x) => x.id === p.taskId)!;
    return (
      p.resourceId !== t.resourceId ||
      start + t.duration <= p.start ||
      start >= p.start + x.duration
    );
  });
}
export function baseline(w: Workflow, f: Forecast): Assignment[] | null {
  const order = topological(w);
  if (!order) return null;
  const a: Assignment[] = [];
  for (const t of order) {
    let found = false;
    for (let s = t.release; s <= t.deadline - t.duration; s++)
      if (canPlace(t, s, a, w)) {
        a.push({ taskId: t.id, resourceId: t.resourceId, start: s });
        found = true;
        break;
      }
    if (!found) return null;
  }
  return verify(w, f, a).valid ? a : null;
}
export function solve(
  w: Workflow,
  f: Forecast,
  config: Config = { maxNodes: 150000, maxMs: 2000 },
  progress?: (n: number) => void,
): Result {
  const errors = [...validateWorkflow(w), ...validateForecast(f)];
  if (f.slots?.length < w.horizon)
    errors.push("Forecast shorter than horizon.");
  if (errors.length) throw Error(errors.join("\n"));
  if (
    !integer(config.maxNodes) ||
    config.maxNodes < 1 ||
    config.maxNodes > 10000000 ||
    !finite(config.maxMs) ||
    config.maxMs < 1 ||
    config.maxMs > 60000
  )
    throw Error("Invalid search budget.");
  const began = performance.now(),
    base = baseline(w, f),
    bv = base ? verify(w, f, base) : null,
    certificate = diagnose(w);
  let best = base,
    bestCost = bv?.grams ?? Infinity,
    nodes = 0,
    limited = false;
  if (certificate)
    return {
      status: "INFEASIBLE",
      schedule: null,
      baseline: base,
      verification: null,
      baselineVerification: bv,
      certificate,
      nodes,
      elapsedMs: performance.now() - began,
      config,
    };
  const order = topological(w)!,
    assigned: Assignment[] = [];
  const mins = order.map((t) => {
    let m = Infinity;
    for (let s = t.release; s <= t.deadline - t.duration; s++)
      m = Math.min(m, cost(t, s, f.slots));
    return m;
  });
  const suffix = new Array(order.length + 1).fill(0);
  for (let i = order.length - 1; i >= 0; i--)
    suffix[i] = suffix[i + 1] + mins[i];
  function search(i: number, g: number) {
    if (limited) return;
    if (
      nodes >= config.maxNodes ||
      (nodes % 128 === 0 && performance.now() - began >= config.maxMs)
    ) {
      limited = true;
      return;
    }
    nodes++;
    if (nodes % 4096 === 0) progress?.(nodes);
    if (
      g + suffix[i] >
      bestCost +
        Number.EPSILON *
          256 *
          Math.max(1, Math.abs(g + suffix[i]), Math.abs(bestCost))
    )
      return;
    if (i === order.length) {
      const a = assigned.map((x) => ({ ...x }));
      const v = verify(w, f, a);
      if (!v.valid)
        throw Error("Independent verifier rejected solver assignment.");
      const finish = v.finish,
        prev = best ? verify(w, f, best).finish : Infinity;
      const key = a
          .map((x) => `${x.taskId}:${String(x.start).padStart(2, "0")}`)
          .join("|"),
        prevkey =
          best
            ?.map((x) => `${x.taskId}:${String(x.start).padStart(2, "0")}`)
            .join("|") ?? "";
      if (
        v.grams < bestCost ||
        (v.grams === bestCost &&
          (finish < prev || (finish === prev && key < prevkey)))
      ) {
        best = a;
        bestCost = v.grams;
      }
      return;
    }
    const t = order[i];
    const starts = Array.from(
      { length: Math.max(0, t.deadline - t.duration - t.release + 1) },
      (_, k) => k + t.release,
    ).sort((a, b) => cost(t, a, f.slots) - cost(t, b, f.slots) || a - b);
    for (const s of starts)
      if (canPlace(t, s, assigned, w)) {
        assigned.push({ taskId: t.id, resourceId: t.resourceId, start: s });
        search(i + 1, g + cost(t, s, f.slots));
        assigned.pop();
        if (limited) break;
      }
  }
  search(0, 0);
  const schedule = best as Assignment[] | null;
  return {
    status: limited
      ? schedule
        ? "FEASIBLE_BEST_FOUND"
        : "UNKNOWN"
      : schedule
        ? "OPTIMAL"
        : "INFEASIBLE",
    schedule,
    baseline: base,
    verification: schedule ? verify(w, f, schedule) : null,
    baselineVerification: bv,
    certificate: null,
    nodes,
    elapsedMs: performance.now() - began,
    config,
  };
}
export function canonical(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(x)
      .sort()
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonical((x as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}
export async function fingerprint(
  w: Workflow,
  f: Forecast,
  c: Config,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    canonical({ workflow: w, forecast: f, config: c }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function validatePacket(p: Packet): string[] {
  if (
    !p ||
    p.schemaVersion !== 1 ||
    ![VERSION, "1.0.0"].includes(p.appVersion) ||
    !str(p.id) ||
    !str(p.name) ||
    !str(p.runId) ||
    !str(p.fingerprint) ||
    !/^[0-9a-f]{64}$/.test(p.fingerprint) ||
    !Number.isFinite(Date.parse(p.createdAt)) ||
    !Array.isArray(p.assumptions) ||
    p.assumptions.length > 20 ||
    p.assumptions.some((x) => !str(x, 2000)) ||
    !p.result
  )
    return ["Evidence: unsupported version or invalid metadata."];
  const e = [...validateWorkflow(p.workflow), ...validateForecast(p.forecast)];
  if (e.length) return e;
  const r = p.result;
  if (
    !["OPTIMAL", "FEASIBLE_BEST_FOUND", "UNKNOWN", "INFEASIBLE"].includes(
      r.status,
    ) ||
    !r.config ||
    !integer(r.config.maxNodes) ||
    !finite(r.config.maxMs) ||
    r.config.maxNodes < 1 ||
    r.config.maxNodes > 10000000 ||
    r.config.maxMs < 1 ||
    r.config.maxMs > 60000
  )
    e.push("Evidence: invalid solver status/configuration.");
  if (
    !integer(r.nodes) ||
    r.nodes < 0 ||
    !finite(r.elapsedMs) ||
    r.elapsedMs < 0
  )
    e.push("Evidence: invalid search statistics.");
  if (p.appVersion === VERSION && !p.timeContext)
    e.push("Evidence: time conversion metadata missing.");
  if (p.timeContext)
    try {
      if (
        canonical(p.timeContext) !==
        canonical(
          timeContext(
            p.workflow,
            p.forecast,
            r.schedule,
            p.timeContext.displayTimeZone,
            p.timeContext.legacyDerived,
          ),
        )
      )
        e.push("Evidence: time conversion metadata mismatch.");
    } catch {
      e.push("Evidence: invalid time conversion metadata.");
    }
  if (r.schedule) {
    const v = verify(p.workflow, p.forecast, r.schedule);
    if (!v.valid) e.push(...v.errors);
    if (
      !r.verification ||
      !finite(r.verification.grams) ||
      Math.abs(v.grams - r.verification.grams) > 1e-7
    )
      e.push("Evidence: objective mismatch.");
  } else if (["OPTIMAL", "FEASIBLE_BEST_FOUND"].includes(r.status))
    e.push("Evidence: feasible status without plan.");
  if (r.baseline) {
    const v = verify(p.workflow, p.forecast, r.baseline);
    if (
      !v.valid ||
      !r.baselineVerification ||
      !finite(r.baselineVerification.grams) ||
      Math.abs(v.grams - r.baselineVerification.grams) > 1e-7
    )
      e.push("Evidence: invalid baseline.");
  }
  if (r.certificate && !checkCertificate(p.workflow, r.certificate))
    e.push("Evidence: invalid certificate.");
  if (r.status === "UNKNOWN" && r.schedule)
    e.push("Evidence: unknown status with a plan.");
  if (r.status === "INFEASIBLE" && r.schedule)
    e.push("Evidence: infeasible status with plan.");
  return e;
}
export function transform(
  f: Forecast,
  kind: "uniform" | "window",
  magnitude: number,
  from = 0,
  to = f.slots.length,
): Forecast {
  if (
    !finite(magnitude) ||
    magnitude < 0 ||
    magnitude > 2 ||
    !integer(from) ||
    !integer(to) ||
    from < 0 ||
    to > f.slots.length ||
    to <= from
  )
    throw Error("Invalid sensitivity parameters.");
  const x = structuredClone(f);
  x.id = crypto.randomUUID();
  x.mode = "CUSTOM";
  x.kind = "synthetic";
  x.name =
    kind === "uniform"
      ? `Uniform ×${magnitude}`
      : `Window [${from},${to}) ×${magnitude}`;
  x.raw = { parent: f, transformation: { kind, magnitude, from, to } };
  x.slots = x.slots.map((s, i) => ({
    ...s,
    value:
      s.value * (kind === "uniform" || (i >= from && i < to) ? magnitude : 1),
  }));
  return x;
}
export function example(): Workflow {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: "Research batch · GB",
    horizon: 24,
    resources: [
      { id: "cpu", name: "CPU workspace" },
      { id: "gpu", name: "Compute worker" },
    ],
    tasks: [
      {
        id: "prep",
        name: "Prepare data",
        notes: "Synthetic energy estimate",
        resourceId: "cpu",
        duration: 2,
        energyKWh: 0.2,
        release: 0,
        deadline: 24,
        dependsOn: [],
      },
      {
        id: "train",
        name: "Run experiment",
        notes: "Synthetic energy estimate",
        resourceId: "gpu",
        duration: 4,
        energyKWh: 1,
        release: 0,
        deadline: 24,
        dependsOn: ["prep"],
      },
      {
        id: "report",
        name: "Create report",
        notes: "Synthetic energy estimate",
        resourceId: "cpu",
        duration: 2,
        energyKWh: 0.5,
        release: 0,
        deadline: 24,
        dependsOn: ["train"],
      },
      {
        id: "backup",
        name: "Backup artifacts",
        notes: "Synthetic energy estimate",
        resourceId: "cpu",
        duration: 2,
        energyKWh: 0.1,
        release: 0,
        deadline: 8,
        dependsOn: [],
      },
    ],
  };
}
