import { mountCopilot } from "./copilot.js";
import {
  VERSION,
  example,
  validateWorkflow,
  validateForecast,
  validateLive,
  verify,
  diagnose,
  checkCertificate,
  validatePacket,
  fingerprint,
  transform,
  assumptions,
  canonical,
  timeContext,
} from "./domain.js";
import { loadWorkspace, storeWorkspace } from "./storage.js";
const $ = (s) => document.querySelector(s),
  clone = (x) => structuredClone(x),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const numberValue = (value) => (value.trim() === "" ? NaN : Number(value));
const uid = () => crypto.randomUUID(),
  fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
let recorded = await fetch("./forecast.json").then((r) => r.json());
let forecast = clone(recorded),
  workflow = example(),
  current = null,
  scenarios = [],
  saved = [],
  datasets = [],
  memory = false,
  saveStatus = "Saved locally",
  errors = [],
  undo = [],
  redo = [],
  worker = null,
  active = null,
  state = "IDLE",
  nodes = 0,
  stale = false,
  focusReturn = null;
let sensitivity = { kind: "window", magnitude: 0.7, from: 4, to: 12 },
  config = { maxNodes: 150000, maxMs: 2000 },
  importType = "workflow",
  saveTimer,
  saveChain = Promise.resolve(),
  remoteCooldown = 0,
  fetching = false,
  updateWorker = null;
let watchdog;
const palette = [
  "#275d4b",
  "#506bba",
  "#9a6e2c",
  "#83649b",
  "#4b777b",
  "#785943",
];
function notice(s) {
  $("#notice").textContent = s;
}
async function confirmAction(text) {
  const d = $("#confirm-dialog");
  $("#confirm-message").textContent = text;
  return new Promise((resolve) => {
    d.onclose = () => resolve(d.returnValue === "confirm");
    d.showModal();
  });
}
// Explicit tab wrapping complements native modality and avoids focus leaking
// into browser chrome at either end of the confirmation action list.
$("#confirm-dialog").addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const controls = [
    ...e.currentTarget.querySelectorAll(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
    ),
  ].filter((el) => !el.hidden);
  if (!controls.length) {
    e.preventDefault();
    return;
  }
  const first = controls[0],
    last = controls[controls.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});
function persist() {
  saveStatus = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const snapshot = {
      schemaVersion: 1,
      workflow: clone(workflow),
      forecast: clone(forecast),
      scenarios: clone(scenarios),
      saved: clone(saved),
      datasets: clone(datasets),
    };
    saveChain = saveChain
      .then(() => storeWorkspace(snapshot))
      .then(() => {
        saveStatus = "Saved locally";
        const recovered = memory;
        memory = false;
        if (recovered) render();
        else renderSave();
      })
      .catch((e) => {
        memory = true;
        saveStatus = "Memory only · export backup";
        notice(
          "Local save failed: " +
            e.message +
            ". Export a backup before closing.",
        );
        render();
      });
  }, 250);
  renderSave();
}
function renderSave() {
  const s = $("#save-status");
  if (s) s.textContent = saveStatus;
}
function invalidate() {
  stale = !!current;
  cancel(false);
  errors = [];
}
function change(fn) {
  const before = clone(workflow);
  fn();
  if (canonical(before) === canonical(workflow)) return;
  undo.push(before);
  if (undo.length > 30) undo.shift();
  redo = [];
  invalidate();
  persist();
  render();
}
function time(slot) {
  const t = Date.parse(forecast.slots[0].from) + slot * 1800000;
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}
function datetime(slot) {
  const d = new Date(time(slot));
  if (!Number.isFinite(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function localLabel(slot) {
  if (!time(slot)) return "Invalid slot — enter a finite whole number.";
  return (
    new Date(time(slot)).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) +
    " (slot " +
    slot +
    ")"
  );
}
function safeLink(url, label) {
  try {
    const u = new URL(url);
    if (["https:", "http:"].includes(u.protocol))
      return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  } catch {}
  return esc(label);
}
function download(name, obj, mime = "application/json") {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj),
    url = URL.createObjectURL(new Blob([body], { type: mime })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function errorTarget(e) {
  if (e.startsWith("maxnodes:")) return "maxnodes";
  if (e.startsWith("maxms:")) return "maxms";
  if (e.startsWith("resources:")) {
    const r = workflow.resources.find(
      (r) => typeof r.name !== "string" || !r.name.trim(),
    );
    if (r) return "resource-" + r.id;
  }
  const t = workflow.tasks.find((t) => e.startsWith(t.id + ":"));
  if (t) {
    if (e.includes("release/deadline"))
      return (
        (!Number.isInteger(t.release) || t.release < 0
          ? "release"
          : "deadline") +
        "-" +
        t.id
      );
    const key = e.includes("energy")
      ? "energy"
      : e.includes("duration")
        ? "dur"
        : e.includes("resource")
          ? "res"
          : e.includes("release")
            ? "release"
            : e.includes("deadline")
              ? "deadline"
              : "name";
    return key + "-" + t.id;
  }
  return e.includes("horizon") ? "horizon" : "workflow-name";
}
function field(id, label, value, attrs = "") {
  if (errors.some((e) => errorTarget(e) === id))
    attrs += ' aria-invalid="true" aria-describedby="error-summary"';
  return `<div><label for="${id}">${esc(label)}</label><input id="${id}" value="${esc(value)}" ${attrs}></div>`;
}
function graph() {
  return `<div class="dag" aria-label="Dependencies">${workflow.tasks.map((t) => `<span><b>${esc(t.name)}</b><br>${t.dependsOn.length ? "after " + t.dependsOn.map((d) => esc(workflow.tasks.find((x) => x.id === d)?.name ?? d)).join(", ") : "independent"} · ${esc(workflow.resources.find((r) => r.id === t.resourceId)?.name ?? "missing resource")}</span>`).join("")}</div>`;
}
function taskCard(t, i) {
  const options = workflow.resources
    .map(
      (r) =>
        `<option value="${esc(r.id)}" ${r.id === t.resourceId ? "selected" : ""}>${esc(r.name)}</option>`,
    )
    .join("");
  return `<article class="task-card" data-task="${esc(t.id)}"><div class="task-heading"><span class="task-letter">${String(i + 1).padStart(2, "0")}</span><strong>${esc(t.name)}</strong><div class="actions"><button data-action="duplicate-task" data-id="${esc(t.id)}" aria-label="Duplicate ${esc(t.name)}">Duplicate</button><button data-action="delete-task" data-id="${esc(t.id)}" aria-label="Delete ${esc(t.name)}">Delete</button></div></div><div class="fields">${field("name-" + t.id, "Task name", t.name, `data-field="name" maxlength="300"`)}<div><label for="res-${esc(t.id)}">Fixed resource</label><select id="res-${esc(t.id)}" data-field="resourceId">${options}</select></div></div><div class="fields three">${field("dur-" + t.id, "Duration · 30-minute slots", t.duration, 'data-field="duration" type="number" min="1" max="48" step="1"')}${field("energy-" + t.id, "Whole-task energy · kWh", t.energyKWh, 'data-field="energyKWh" type="number" min="0" max="1000000" step="0.01"')}${field("release-" + t.id, "Release slot", t.release, 'data-field="release" type="number" min="0" max="47" step="1"')}</div><div class="fields">${field("deadline-" + t.id, "Finish deadline · slot", t.deadline, 'data-field="deadline" type="number" min="1" max="48" step="1"')}${field("date-" + t.id, "Finish deadline · local time", datetime(t.deadline), 'data-field="deadlineDate" type="datetime-local" step="1800"')}</div><fieldset><legend>Must follow</legend><div class="deps">${
    workflow.tasks
      .filter((x) => x.id !== t.id)
      .map(
        (x) =>
          `<label><input type="checkbox" data-dep="${esc(x.id)}" ${t.dependsOn.includes(x.id) ? "checked" : ""}>${esc(x.name)}</label>`,
      )
      .join("") || '<span class="caption">No other tasks.</span>'
  }</div></fieldset><details><summary>Task notes and absolute release time</summary><label for="notes-${esc(t.id)}">Notes (stay on this device)</label><textarea id="notes-${esc(t.id)}" data-field="notes" maxlength="2000">${esc(t.notes)}</textarea>${field("relDate-" + t.id, "Release · local time", datetime(t.release), 'data-field="releaseDate" type="datetime-local" step="1800"')}</details><p class="caption">${esc(localLabel(t.release))} → ${esc(localLabel(t.deadline))}</p></article>`;
}
function forecastChart() {
  const slots = forecast.slots.slice(0, workflow.horizon),
    max = Math.max(1, ...slots.map((s) => s.value)),
    pts = slots
      .map(
        (s, i) =>
          `${((i / Math.max(1, slots.length - 1)) * 600).toFixed(2)},${(90 - (s.value / max) * 80).toFixed(2)}`,
      )
      .join(" ");
  return `<svg class="chart" viewBox="0 0 600 100" role="img" aria-label="Carbon intensity forecast; exact values in table below"><polyline points="${pts}" fill="none" stroke="#527b42" stroke-width="3"/><line x1="0" y1="90" x2="600" y2="90" stroke="#c7d5be"/></svg><div class="axis"><span>${esc(localLabel(0))}</span><span>${fmt(max, 0)} gCO2/kWh peak</span><span>slot ${slots.length}</span></div>`;
}
function timeline(a, w = workflow, f = forecast) {
  if (!a) return '<div class="empty">No verified plan available.</div>';
  return (
    w.tasks
      .map((t, i) => {
        const p = a.find((x) => x.taskId === t.id);
        if (!p) return "";
        return `<div class="timeline-row"><span>${esc(t.name)}<br><small>${esc(w.resources.find((r) => r.id === t.resourceId)?.name)}</small></span><svg viewBox="0 0 600 35" role="img" aria-label="${esc(t.name)} start ${p.start}, finish ${p.start + t.duration}, resource ${esc(t.resourceId)}"><rect x="${(p.start / w.horizon) * 600}" y="5" width="${(t.duration / w.horizon) * 600}" height="25" rx="4" fill="${palette[i]}"/><text x="${(p.start / w.horizon) * 600 + 4}" y="22" fill="white" font-size="10">${p.start}–${p.start + t.duration}</text></svg></div>`;
      })
      .join("") +
    `<p class="timeline-note">0 → ${w.horizon} half-hour slots · one job per resource · non-preemptive</p>`
  );
}
function resultView() {
  if (!current)
    return `<div class="empty">Your next clean window starts with a valid plan.<br>Run analysis to compare a baseline and candidate.</div>`;
  const { result: r, workflow: w, forecast: f } = current,
    v = r.verification,
    bv = r.baselineVerification;
  return `${stale ? '<div class="warning">Inputs changed or Live data expired. This result is out of date; refresh/rerun before using it.</div>' : ""}<div class="actions"><span class="tag">${esc(r.status)}</span><span class="tag">${esc(f.mode)}</span></div><p class="subtle">${r.nodes.toLocaleString()} nodes · ${fmt(r.elapsedMs, 0)} ms · ${r.config.maxNodes.toLocaleString()} node / ${r.config.maxMs} ms limits. ${r.status === "OPTIMAL" ? "Optimal only within this discrete model." : r.status === "FEASIBLE_BEST_FOUND" ? "Verified feasible plan; optimality not proven." : r.status === "UNKNOWN" ? "Search limit reached; no feasibility conclusion." : "Proven infeasible within the declared model."}</p>${r.certificate ? `<div class="cert"><h3>Checkable constraint contradiction</h3><p>${esc(r.certificate.message)}</p><p>Certificate recheck: ${checkCertificate(w, r.certificate) ? "PASS" : "FAIL"}</p></div>` : ""}${r.status === "INFEASIBLE" && !r.certificate ? '<div class="warning">Exhaustive finite search found no feasible assignment. No compact structural certificate is available.</div>' : ""}<h3>Carbon-aware candidate</h3>${timeline(r.schedule, w, f)}<details><summary>Earliest-start baseline</summary>${timeline(r.baseline, w, f)}${!r.baseline ? '<p class="warning">The greedy baseline found no plan. That alone does not prove infeasibility.</p>' : ""}</details>${
    v
      ? `<div class="success">Independent verification PASS · ${fmt(v.grams)} gCO2 · ${fmt(v.energyKWh)} kWh · finish slot ${v.finish}</div><div class="table-wrap"><table><caption class="sr">Task movement and footprint comparison</caption><thead><tr><th>Task</th><th>Baseline → candidate · start/finish</th><th>Candidate gCO2 / intensity</th><th>Change gCO2</th><th>Binding constraints in this plan</th></tr></thead><tbody>${w.tasks
          .map((t) => {
            const p = r.schedule.find((x) => x.taskId === t.id),
              b = r.baseline?.find((x) => x.taskId === t.id),
              binding = [];
            if (p.start === t.release) binding.push("release");
            if (p.start + t.duration === t.deadline) binding.push("deadline");
            for (const d of t.dependsOn) {
              const dt = w.tasks.find((x) => x.id === d),
                dp = r.schedule.find((x) => x.taskId === d);
              if (dp.start + dt.duration === p.start)
                binding.push("after " + dt.name);
            }
            return `<tr><td>${esc(t.name)}</td><td>${b ? `${b.start}–${b.start + t.duration}` : "—"} → ${p.start}–${p.start + t.duration}<br>${b ? `${(p.start - b.start) * 30} min shift` : "no baseline"}</td><td>${fmt(v.perTask[t.id])}<br><small>Slots ${p.start}–${p.start + t.duration}; avg ${fmt(f.slots.slice(p.start, p.start + t.duration).reduce((sum, s) => sum + s.value, 0) / t.duration)} gCO2/kWh</small></td><td>${bv ? fmt(v.perTask[t.id] - bv.perTask[t.id]) : "—"}</td><td>${esc(binding.join(", ") || "none; not a proven global blocker")}</td></tr>`;
          })
          .join(
            "",
          )}</tbody></table></div><p class="caption">Each task uses its displayed intensity windows. Equal assumed work/energy; no claim of measured avoided emissions.</p>`
      : ""
  }<div class="actions"><button data-action="save-scenario">Save scenario</button><button data-action="export-evidence">Export evidence JSON</button><button data-action="export-report">Human-readable report</button></div>`;
}
function metricValues() {
  const r = !stale ? current?.result : null,
    v = r?.verification,
    b = r?.baselineVerification,
    delta = v && b ? b.grams - v.grams : null;
  return `<div class="metrics"><div class="metric"><small>Valid baseline</small><strong>${b ? fmt(b.grams) : "—"} <span>gCO2</span></strong><span>Deterministic earliest start</span></div><div class="metric"><small>Verified candidate</small><strong>${v ? fmt(v.grams) : "—"} <span>gCO2</span></strong><span>${r ? esc(r.status) : "Ready for analysis"}</span></div><div class="metric highlight"><small>Modeled difference</small><strong>${delta !== null ? fmt(delta) : "—"} <span>gCO2</span></strong><span>${b?.grams > 0 && delta !== null ? fmt((delta / b.grams) * 100, 1) + "% lower · same workload" : "Not measured avoided emissions"}</span></div><div class="metric"><small>Assumed electricity</small><strong>${fmt(workflow.tasks.reduce((s, t) => s + (Number.isFinite(t.energyKWh) ? t.energyKWh : 0), 0))} <span>kWh</span></strong><span>User-supplied task estimates</span></div></div>`;
}
function workflowDifferences(a, b) {
  const changes = [];
  if (a.horizon !== b.horizon)
    changes.push(`horizon ${a.horizon} → ${b.horizon}`);
  const ids = new Set([
    ...a.tasks.map((t) => t.id),
    ...b.tasks.map((t) => t.id),
  ]);
  for (const id of ids) {
    const x = a.tasks.find((t) => t.id === id),
      y = b.tasks.find((t) => t.id === id);
    if (!x || !y) {
      changes.push(`${(x || y).name}: ${x ? "removed" : "added"}`);
      continue;
    }
    for (const key of [
      "duration",
      "energyKWh",
      "release",
      "deadline",
      "resourceId",
      "dependsOn",
    ])
      if (canonical(x[key]) !== canonical(y[key]))
        changes.push(
          `${y.name}: ${key} ${Array.isArray(x[key]) ? x[key].join(",") : x[key]} → ${Array.isArray(y[key]) ? y[key].join(",") : y[key]}`,
        );
  }
  return changes;
}
function comparison() {
  if (!scenarios.length)
    return '<div class="empty">Save analyses to compare decisions, constraints and provenance.</div>';
  return `<div class="table-wrap"><table><caption class="sr">Saved scenario comparison against the current editor and selected series</caption><thead><tr><th>Scenario / data</th><th>Status / validity</th><th>Footprint</th><th>Finish</th><th>Problem / settings</th><th>Comparison conditions</th><th>Actions</th></tr></thead><tbody>${scenarios
    .map((p, i) => {
      const changes = workflowDifferences(p.workflow, workflow);
      const sameW =
        canonical({ ...p.workflow, id: "", name: "" }) ===
        canonical({ ...workflow, id: "", name: "" });
      const sameF = canonical(p.forecast.slots) === canonical(forecast.slots);
      const sameGrid =
        canonical(p.forecast.slots.map((s) => [s.from, s.to])) ===
        canonical(forecast.slots.map((s) => [s.from, s.to]));
      const v = p.result.verification;
      const evaluated =
        sameW && sameGrid && p.result.schedule
          ? verify(p.workflow, forecast, p.result.schedule)
          : null;
      const comparability = !sameW
        ? "Workload/horizon or constraints differ; no savings claim."
        : !sameF
          ? "Same work; different intensity series. Compare under one series."
          : "Same work and series.";
      return `<tr><td>${esc(p.name)}<br>${esc(p.forecast.mode)} · ${esc(p.forecast.name)}<br>${safeLink(p.forecast.sourceUrl, "Source")} · ${esc(p.forecast.geography)}<br><small>${esc(p.forecast.slots[0].from)}; retrieved ${esc(p.forecast.retrievedAt)}</small></td><td>${esc(p.result.status)}<br>${v?.valid ? "verified plan" : "no valid plan"}${p.result.certificate ? "<br>certificate rechecked" : ""}</td><td>${v ? fmt(v.grams) + " gCO2" : "—"}<br>${v ? fmt(v.energyKWh) + " kWh" : ""}${evaluated?.valid && !sameF ? `<br><strong>Current-series counterfactual: ${fmt(evaluated.grams)} gCO2</strong>` : ""}</td><td>${v ? v.finish : "—"}<br><small>half-hour slot</small></td><td>${p.workflow.tasks.length} tasks / ${p.workflow.resources.length} resources<br>${p.workflow.horizon} slots · ${p.result.config.maxNodes.toLocaleString()} nodes / ${p.result.config.maxMs} ms</td><td>${comparability}${changes.length ? `<details><summary>Exact changes to current editor (${changes.length})</summary><ul>${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></details>` : ""}</td><td><div class="actions"><button data-action="restore-scenario" data-index="${i}">Restore</button><button data-action="delete-scenario" data-index="${i}">Delete</button></div></td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function render() {
  const focused = document.activeElement?.id;
  const fe = document.activeElement;
  const focusedAction = fe?.dataset?.action
    ? { action: fe.dataset.action, id: fe.dataset.id, index: fe.dataset.index }
    : null;
  const openDetails = [...document.querySelectorAll("#app details[open]")].map(
    (d) =>
      d
        .querySelector("summary")
        ?.textContent?.replace(/Resources \(\d\/2\)/, "Resources"),
  );
  const app = $("#app");
  const copilotHost = $("#copilot");
  copilotHost?.remove(); // Preserve session-only key and draft DOM across planner renders.
  app.innerHTML = `<section class="hero"><div><span class="eyebrow">LESS CARBON. SAME WORK. NO GUESSWORK.</span><h1>Make your workflow’s<br><em>flexibility visible.</em></h1><p class="intro">Find cleaner time windows without breaking dependencies or deadlines. A verified plan when possible. A checkable contradiction when not.</p><div class="actions"><button id="analyze-hero" class="primary" data-action="analyze">${state === "RUNNING" ? "Restart analysis" : "Analyze workflow ↗"}</button><button data-action="guided">Load guided example</button><span class="tag">${esc(forecast.mode)}</span></div></div><div class="hero-side"><span class="tag dark">${navigator.onLine ? "LOCAL-FIRST · CONNECTED" : "OFFLINE · LOCAL COMPUTE"}</span><strong>Evidence over optimistic claims.</strong><p>Planning only. Every accepted schedule is independently checked. No AI required, no account required, and no workload dispatch. Optional Gemini drafts always need your review.</p><span class="eyebrow">${esc(forecast.geography)} ${esc(forecast.kind.toUpperCase())} / ${workflow.tasks.length} TASKS / ${workflow.resources.length} RESOURCES</span></div></section>${metricValues()}<div class="grid"><div><section class="panel longsection" id="planner"><div class="panel-head"><div><span class="eyebrow">01 / DEFINE THE WORK</span><h2>Your workflow</h2></div><span id="save-status" class="tag">${esc(saveStatus)}</span></div><div class="fields">${field("workflow-name", "Workflow name", workflow.name, 'maxlength="300"')}${field("horizon", "Horizon · 30-minute slots", workflow.horizon, `type="number" min="1" max="${Math.min(48, forecast.slots.length)}" step="1"`)}</div><p class="caption">Origin ${esc(forecast.slots[0].from)} UTC. Absolute inputs display your local timezone. Live requires future-only coverage.</p><div class="actions"><button data-action="undo">Undo</button><button data-action="redo">Redo</button><button data-action="duplicate-workflow">Duplicate workflow</button><button data-action="import-workflow">Import workflow</button><button data-action="export-workflow">Export workflow</button></div><details><summary>Resources (${workflow.resources.length}/2)</summary>${workflow.resources.map((r) => `<div class="resource-row"><label for="resource-${esc(r.id)}">Resource ${esc(r.id)}<input id="resource-${esc(r.id)}" data-resource="${esc(r.id)}" value="${esc(r.name)}" maxlength="300" ${errors.some((e) => errorTarget(e) === "resource-" + r.id) ? 'aria-invalid="true" aria-describedby="error-summary"' : ""}></label><button data-action="delete-resource" data-id="${esc(r.id)}">Delete</button></div>`).join("")}<button data-action="add-resource">Add resource</button><p class="caption">Fixed mapping. Resources share this dataset's electricity region.</p></details>${errors.length ? `<div class="error" role="alert" tabindex="-1" id="error-summary"><strong>Resolve these issues</strong><ul>${errors.map((e) => `<li><a href="#${esc(errorTarget(e))}" data-error-target="${esc(errorTarget(e))}">${esc(e)}</a></li>`).join("")}</ul></div>` : ""}${errors.includes("dependencies: cycle.") ? `<div class="cert"><strong>Cycle certificate</strong><p>${esc(diagnose(workflow).message)} Independent recheck: ${checkCertificate(workflow, diagnose(workflow)) ? "PASS" : "FAIL"}</p></div>` : ""}${workflow.tasks.map(taskCard).join("")}<div class="actions"><button data-action="add-task">+ Add task (${workflow.tasks.length}/6)</button><button data-action="save-workflow">Save named workflow</button><button data-action="reset">Reset example</button></div><details><summary>Dependency and resource view</summary>${graph()}</details></section></div><div><section class="panel"><span class="eyebrow">02 / SELECT THE EVIDENCE</span><h2>Carbon intensity</h2><div class="modebar"><button data-action="replay" aria-pressed="${forecast.mode === "REPLAY"}">Recorded replay</button><button data-action="live" aria-pressed="${forecast.mode === "LIVE"}">${fetching ? "Fetching…" : "Refresh Live GB"}</button><button data-action="import-forecast" aria-pressed="${forecast.mode === "CUSTOM"}">Import custom dataset</button></div><p class="subtle"><strong>${esc(forecast.name)}</strong> · ${esc(forecast.geography)} · ${esc(forecast.kind)}<br>Retrieved ${esc(forecast.retrievedAt)}<br>${safeLink(forecast.sourceUrl, "Source/provenance")} · ${esc(forecast.license)}</p>${forecast.mode === "REPLAY" ? '<div class="warning">Historical recorded forecast. Synthetic example task energies. This is not a currently executable Live plan.</div>' : forecast.mode === "CUSTOM" ? '<div class="warning">User-provided or transformed scenario; not independently verified. No calibrated uncertainty probability.</div>' : '<div class="success">GB-only forecast. Refresh if the origin slot expires; no future recommendation from past slots.</div>'}${forecastChart()}<details><summary>Inspect exact interval values and dataset</summary><div class="table-wrap"><table><caption>UTC intervals · gCO2/kWh</caption><thead><tr><th>Slot</th><th>From → to UTC</th><th>Intensity</th></tr></thead><tbody>${forecast.slots.map((s, i) => `<tr><td>${i}</td><td>${esc(s.from)} → ${esc(s.to)}</td><td>${fmt(s.value)}</td></tr>`).join("")}</tbody></table></div><div class="actions"><button data-action="download-data">Download dataset</button><button data-action="save-dataset">Save snapshot locally</button></div></details></section><section class="panel" id="results"><div class="panel-head"><div><span class="eyebrow">03 / VERIFY THE DECISION</span><h2>Schedule intelligence</h2></div><span class="tag">${state}</span></div><div class="actions"><button id="analyze-results" class="primary" data-action="analyze">Analyze workflow</button><button data-action="cancel">Cancel analysis</button></div>${state === "RUNNING" ? `<p role="status">Searching · ${nodes.toLocaleString()} nodes…</p><progress aria-label="Search progress" max="${config.maxNodes}" value="${nodes}"></progress>` : ""}<details><summary>Search budget</summary><div class="fields">${field("maxnodes", "Node limit", config.maxNodes, 'type="number" min="1" max="10000000" step="1"')}${field("maxms", "Time limit · ms", config.maxMs, 'type="number" min="1" max="60000" step="1"')}</div><p class="caption">Bounded search may return best-found or unknown. No global optimality claim on timeout.</p></details><div class="divider"></div>${resultView()}</section><section class="panel" id="whatif"><span class="eyebrow">04 / TEST THE FLEXIBILITY</span><h2>What if the deadline changes?</h2><div class="fields"><div><label for="what-task">Selected task</label><select id="what-task">${workflow.tasks.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></div>${field("what-deadline", "New finish deadline · slot", workflow.horizon, 'type="number" min="1" max="48" step="1"')}</div><div class="actions"><button data-action="whatif">Apply and recompute</button><button data-action="contradiction">Demo impossible chain</button><button data-action="restore-deadline">Restore feasible example</button></div><p class="caption">A feasible counterfactual demonstrates sufficiency for that specific change, not minimum relaxation.</p><details><summary>Intensity sensitivity · deterministic stress scenarios</summary><div class="fields"><div><label for="sens-kind">Transformation</label><select id="sens-kind"><option value="window" ${sensitivity.kind === "window" ? "selected" : ""}>Selected window</option><option value="uniform" ${sensitivity.kind === "uniform" ? "selected" : ""}>Uniform scaling sanity check</option></select></div>${field("sens-mag", "Intensity multiplier · 0–2", sensitivity.magnitude, 'type="number" min="0" max="2" step="0.1"')}</div><div class="fields">${field("sens-from", "Window start slot", sensitivity.from, 'type="number" min="0" max="47" step="1"')}${field("sens-to", "Window end slot", sensitivity.to, 'type="number" min="1" max="48" step="1"')}</div><button data-action="sensitivity">Transform and recompute</button><p class="caption">Not a confidence interval. Uniform positive scaling need not change an optimum. Baseline and candidate are both evaluated under the selected transformed series.</p></details></section></div></div><section class="panel longsection" id="comparison"><div class="panel-head"><div><span class="eyebrow">05 / KEEP THE CONTEXT</span><h2>Scenario comparison</h2></div><button data-action="import-evidence">Import and independently recheck evidence</button></div>${comparison()}</section><section class="panel longsection" id="workspace"><h2>Your local workspace</h2><p class="subtle">${memory ? "Storage unavailable: memory-only operation. Export before closing." : "Saved only in this browser. Storage may be cleared or evicted; exported backup is your recovery path."} No sync, account or private cloud.</p><div class="actions"><button data-action="export-backup">Export all backup</button><button data-action="import-backup">Import backup</button><button data-action="clear-all" class="danger">Delete all local data</button></div><div class="fields"><div><h3>Named workflows (${saved.length}/30)</h3>${saved.map((w, i) => `<div class="resource-row"><span>${esc(w.name)}</span><button data-action="load-workflow" data-index="${i}">Load</button><button data-action="delete-workflow" data-index="${i}">Delete</button></div>`).join("") || '<p class="subtle">Use “Save named workflow” in the editor.</p>'}</div><div><h3>Forecast snapshots (${datasets.length}/20)</h3>${datasets.map((f, i) => `<div class="resource-row"><span>${esc(f.name)} · ${esc(f.mode)}</span><button data-action="load-dataset" data-index="${i}">Load</button><button data-action="delete-dataset" data-index="${i}">Delete</button></div>`).join("") || '<p class="subtle">Save a dataset from its inspection panel.</p>'}</div></div><details><summary>Custom data and evidence formats</summary><p class="subtle">Use downloaded files as exact schema templates. schemaVersion=1; 1–48 contiguous, UTC-aligned half-hour intervals; units=gCO2/kWh. Custom data requires geography, kind, sourceUrl and license text. Workflow imports allow 1–6 jobs and 1–2 resources. Max file size 2 MiB. Imported optimality claims are not accepted merely from file flags.</p></details></section><section class="panel longsection" id="methodology"><h2>Transparent by design.</h2><div class="fields"><div><h3>How the estimate works</h3><p class="subtle">For each job: (whole-task kWh ÷ duration in slots) × the sum of active-slot intensity in gCO2/kWh. Sum over jobs. All resources share the dataset region. Zero modeled baseline produces no percentage.</p><ul class="help-list">${assumptions.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><h3>Verification, not certification</h3><p class="subtle">A separate verifier checks releases, deadlines, dependencies, resource occupancy and arithmetic. Hashes identify content, not authentic sources. Imported plans are rechecked; optimality is never trusted from an imported flag. Timing-limited search may differ across machines.</p></div><div><h3>Who this helps</h3><p class="subtle">Small GB research-computing and data-engineering teams with flexible batch jobs. Compared with an earliest-start spreadsheet, this makes timing constraints and footprint trade-offs visible. Adoption is a hypothesis, not measured customer demand.</p><h3>Prior art and attribution</h3><p class="subtle">Carbon-aware scheduling is established. This application’s product slice is transparent diagnostic interaction and reproducible local evidence—not a new optimization problem.</p><p class="subtle"><a href="https://github.com/KIT-EAE/CaWoSched" target="_blank" rel="noopener noreferrer">CaWoSched</a> · <a href="https://carbon-aware-sdk.greensoftware.foundation/" target="_blank" rel="noopener noreferrer">Carbon Aware SDK</a><br>Data: National Energy System Operator, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. <a href="https://github.com/carbon-intensity/terms" target="_blank" rel="noopener noreferrer">API terms</a>. Transformations are identified in scenario metadata. No endorsement implied. Application code: <a href="./LICENSE.txt">MIT license</a>.</p><h3>Privacy & offline</h3><p class="subtle">No analytics, accounts or third-party fonts. The core needs no paid runtime services. Optional Gemini sends only your explicit description and session-only key through Cloudflare to Google; no key or prompt is saved by our code. Provider policies apply, including free-tier data use. Live requests send a UTC timestamp to NESO, not your jobs. Workspace stays in IndexedDB. Offline reload works after the app shell downloads. Installation depends on browser support. Export before deleting or updating.</p></div></div></section>`;
  if (copilotHost) app.querySelector(".grid").before(copilotHost);
  for (const d of document.querySelectorAll("#app details"))
    if (
      openDetails.includes(
        d
          .querySelector("summary")
          ?.textContent?.replace(/Resources \(\d\/2\)/, "Resources"),
      )
    )
      d.open = true;
  if (focused) {
    const el = document.getElementById(focused);
    if (el) el.focus({ preventScroll: true });
  } else if (focusedAction) {
    const target = [
      ...document.querySelectorAll("#app button[data-action]"),
    ].find(
      (b) =>
        b.dataset.action === focusedAction.action &&
        b.dataset.id === focusedAction.id &&
        b.dataset.index === focusedAction.index,
    );
    const fallback = focusedAction.action.includes("task")
      ? document.querySelector('[data-action="add-task"]')
      : document.getElementById("main");
    (target || fallback)?.focus({ preventScroll: true });
  }
}
function cancel(announce = true) {
  clearTimeout(watchdog);
  if (worker) worker.terminate();
  worker = null;
  active = null;
  if (state === "RUNNING" || state === "VALIDATING") {
    state = "CANCELLED";
    if (announce) notice("Analysis cancelled. No infeasibility conclusion.");
  }
}
async function run() {
  notice("Validating and starting a new analysis…");
  cancel(false);
  state = "VALIDATING";
  render();
  errors = [...validateWorkflow(workflow), ...validateLive(forecast, workflow)];
  if (
    !Number.isInteger(config.maxNodes) ||
    config.maxNodes < 1 ||
    config.maxNodes > 10000000
  )
    errors.push("maxnodes: enter a whole node limit from 1 to 10,000,000.");
  if (
    !Number.isFinite(config.maxMs) ||
    config.maxMs < 1 ||
    config.maxMs > 60000
  )
    errors.push("maxms: enter a finite time budget from 1 to 60,000 ms.");
  if (errors.length) {
    state = "FAILED";
    render();
    $("#error-summary")?.focus();
    return;
  }
  state = "VALIDATING";
  render();
  const w = clone(workflow),
    f = clone(forecast),
    c = clone(config),
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    id = uid();
  active = { id };
  try {
    const fp = await fingerprint(w, f, c);
    if (active?.id !== id) return;
    active = { id, fp };
    state = "RUNNING";
    nodes = 0;
    render();
    worker = new Worker("./worker.js", { type: "module" });
    worker.onerror = (e) => {
      if (active?.id !== id) return;
      state = "FAILED";
      cancel(false);
      errors = ["Worker failed: " + e.message];
      render();
      notice("Worker failed. See validation errors.");
    };
    const failWorker = (message) => {
      state = "FAILED";
      cancel(false);
      errors = [String(message)];
      render();
      notice("Analysis failed safely: " + message);
    };
    watchdog = setTimeout(() => {
      if (active?.id === id)
        failWorker(
          "Worker exceeded its response budget; no infeasibility conclusion.",
        );
    }, c.maxMs + 3000);
    worker.onmessage = (e) => {
      const m = e.data;
      if (
        !m ||
        typeof m !== "object" ||
        m.runId !== active?.id ||
        m.fingerprint !== active?.fp
      )
        return;
      try {
        if (m.type === "progress") {
          if (!Number.isInteger(m.nodes) || m.nodes < 0)
            throw Error("Invalid Worker progress.");
          nodes = m.nodes;
          const p = $("progress");
          if (p) p.value = nodes;
          return;
        }
        if (m.type === "error") {
          failWorker(m.error || "Worker reported an error.");
          return;
        }
        if (m.type !== "result") throw Error("Invalid Worker message type.");
        const result = m.result;
        if (!result || canonical(result.config) !== canonical(c))
          throw Error("Worker configuration mismatch.");
        const packet = {
          schemaVersion: 1,
          appVersion: VERSION,
          id: uid(),
          name: w.name.slice(0, 240) + " · " + new Date().toLocaleTimeString(),
          createdAt: new Date().toISOString(),
          runId: id,
          fingerprint: fp,
          workflow: w,
          forecast: f,
          result,
          assumptions,
          timeContext: timeContext(w, f, result.schedule, zone),
        };
        const problems = validatePacket(packet);
        if (problems.length) throw Error(problems.join(" "));
        if (result.schedule)
          result.verification = verify(w, f, result.schedule);
        if (result.baseline)
          result.baselineVerification = verify(w, f, result.baseline);
        current = packet;
        state = "COMPLETED";
        stale = f.mode === "LIVE" && validateLive(f, w).length > 0;
        cancel(false);
        render();
        notice(
          "Analysis complete: " +
            result.status +
            ". " +
            (result.verification
              ? "Independent schedule verification passed."
              : "No plan asserted."),
        );
      } catch (error) {
        failWorker(error.message);
      }
    };
    worker.postMessage({
      runId: id,
      fingerprint: fp,
      workflow: w,
      forecast: f,
      config: c,
    });
  } catch (e) {
    state = "FAILED";
    errors = [e.message];
    cancel(false);
    render();
  }
}
async function fetchLive() {
  if (fetching) return notice("A forecast request is already in flight.");
  if (Date.now() < remoteCooldown)
    return notice("Provider cooldown active. Use explicitly labeled replay.");
  if (
    forecast.mode === "LIVE" &&
    Date.now() - Date.parse(forecast.retrievedAt) < 1800000 &&
    Date.parse(forecast.slots[0]?.from) >= Date.now()
  )
    return notice(
      "Fresh snapshot cached. Reusing it without another API request.",
    );
  fetching = true;
  notice(
    "Fetching Live GB forecast. At most one retry for transient failures; overall timeout 10 seconds.",
  );
  render();
  const now = new Date(),
    url =
      "https://api.carbonintensity.org.uk/intensity/" +
      now.toISOString().slice(0, 16) +
      "Z/fw48h";
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 10000);
  try {
    let r;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        r = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (r.status >= 500 && attempt === 0) {
          notice(
            "Temporary provider error. Retrying once within the original 10-second budget.",
          );
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        break;
      } catch (error) {
        if (controller.signal.aborted || attempt === 1) throw error;
        notice(
          "Temporary network error. Retrying once within the original 10-second budget.",
        );
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
    if (!r)
      throw Error("Provider returned no response within the request budget.");
    if (r.status === 429) {
      const retry = r.headers.get("Retry-After");
      remoteCooldown =
        Date.now() +
        (retry && /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Math.max(60000, Date.parse(retry || "") - Date.now() || 60000));
      throw Error("Rate limited. No automatic retry; choose replay.");
    }
    if (!r.ok) throw Error("Provider HTTP " + r.status);
    const raw = await r.json();
    if (!Array.isArray(raw.data)) throw Error("Unexpected provider response.");
    const slots = raw.data
      .filter((x) => Date.parse(x.from) >= Date.now())
      .slice(0, 48)
      .map((x) => ({ from: x.from, to: x.to, value: x.intensity.forecast }));
    const f = {
      schemaVersion: 1,
      id: uid(),
      name: "NESO national · live",
      mode: "LIVE",
      kind: "forecast",
      geography: "GB",
      units: "gCO2/kWh",
      sourceUrl: url,
      license: "CC BY 4.0",
      retrievedAt: new Date().toISOString(),
      raw,
      slots,
    };
    const e = validateForecast(f);
    if (e.length) throw Error(e.join("\n"));
    if (f.slots.length < workflow.horizon)
      throw Error(
        "Fresh future coverage is shorter than selected horizon. Reduce it explicitly and retry.",
      );
    forecast = f;
    invalidate();
    persist();
    notice(
      "Live GB loaded. Origin moved to " +
        f.slots[0].from +
        ". Slot constraints are relative to this explicit new origin.",
    );
  } catch (e) {
    notice(
      "Live fetch failed: " +
        e.message +
        " Current data remains " +
        forecast.mode +
        ". Choose recorded replay explicitly.",
    );
  } finally {
    clearTimeout(timer);
    fetching = false;
    render();
  }
}
function assertWorkspaceSize(next) {
  if (new TextEncoder().encode(JSON.stringify(next)).length > 1800000)
    throw Error(
      "Workspace exceeds 1.8 MB recovery budget. Export/delete older records before adding more.",
    );
}
function workspaceWith(key, value) {
  const next = {
    schemaVersion: 1,
    workflow,
    forecast,
    scenarios,
    saved,
    datasets,
    [key]: value,
  };
  assertWorkspaceSize(next);
  return next;
}
function uniqueRecords(records) {
  const seen = new Set();
  return records.map((item) => {
    const x = clone(item);
    if (seen.has(x.id)) x.id = uid();
    seen.add(x.id);
    return x;
  });
}
function appendRecord(key, array, item) {
  workspaceWith(key, [...array, item]);
  array.push(item);
}
function saveScenario() {
  if (!current || stale)
    return notice("Analyze current inputs before saving a scenario.");
  if (scenarios.length >= 30)
    return notice(
      "30-scenario limit: delete an older record or export a backup.",
    );
  appendRecord("scenarios", scenarios, { ...clone(current), id: uid() });
  persist();
  render();
  notice("Scenario saved with workflow, source and verifier evidence.");
}
function report(p) {
  return `CarbonQueue ${VERSION} — analysis report\n${p.name}\n${p.createdAt}\nMode: ${p.forecast.mode} / ${p.forecast.kind} / ${p.forecast.geography}\nSource: ${p.forecast.sourceUrl}\nLicense: ${p.forecast.license}\nRetrieved: ${p.forecast.retrievedAt}\nStatus: ${p.result.status}\nCandidate: ${p.result.verification?.grams ?? "none"} gCO2\nBaseline: ${p.result.baselineVerification?.grams ?? "none"} gCO2\nFingerprint: ${p.fingerprint} (content identity, not authenticity)\n${p.timeContext ? "Time conversions: " + JSON.stringify(p.timeContext) : "Legacy time zone not recorded"}\n${p.result.certificate?.message ?? ""}\n${p.result.schedule?.map((x) => `${x.taskId} @ ${x.resourceId}: slot ${x.start}`).join("\n") ?? ""}\n\n${assumptions.join("\n")}\n\nImported flags do not prove optimality. Timed reruns may differ.\n`;
}
async function checkImportedPacket(p) {
  const e = validatePacket(p);
  if (e.length) throw Error(e.join("\n"));
  const fp = await fingerprint(p.workflow, p.forecast, p.result.config);
  if (fp !== p.fingerprint) throw Error("Evidence input fingerprint mismatch.");
  const x = clone(p);
  if (x.result.schedule) {
    x.result.verification = verify(x.workflow, x.forecast, x.result.schedule);
    x.result.status = "FEASIBLE_BEST_FOUND";
  }
  if (x.result.baseline)
    x.result.baselineVerification = verify(
      x.workflow,
      x.forecast,
      x.result.baseline,
    );
  if (!x.result.schedule)
    x.result.status = x.result.certificate ? "INFEASIBLE" : "UNKNOWN";
  if (!x.timeContext)
    x.timeContext = timeContext(
      x.workflow,
      x.forecast,
      x.result.schedule,
      "UTC",
      true,
    );
  x.name = x.name.slice(0, 260) + " · imported/rechecked";
  x.id = uid();
  return x;
}
async function checkedBackup(x) {
  if (
    !x ||
    x.schemaVersion !== 1 ||
    !Array.isArray(x.saved) ||
    x.saved.length > 30 ||
    !Array.isArray(x.datasets) ||
    x.datasets.length > 20 ||
    !Array.isArray(x.scenarios) ||
    x.scenarios.length > 30
  )
    throw Error("Backup schema/count invalid.");
  const e = [...validateWorkflow(x.workflow), ...validateForecast(x.forecast)];
  for (const w of x.saved) e.push(...validateWorkflow(w));
  for (const f of x.datasets) e.push(...validateForecast(f));
  if (e.length) throw Error(e.join("\n"));
  const sc = [];
  for (const p of x.scenarios) sc.push(await checkImportedPacket(p));
  return {
    ...x,
    saved: uniqueRecords(x.saved),
    datasets: uniqueRecords(x.datasets),
    scenarios: sc,
  };
}
async function importFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return notice("Import exceeds 2 MiB limit.");
  try {
    const x = JSON.parse(await file.text());
    if (importType === "workflow") {
      const e = validateWorkflow(x);
      if (e.length) throw Error(e.join("\n"));
      change(() => {
        workflow = clone(x);
      });
    } else if (importType === "forecast") {
      const e = validateForecast(x);
      if (e.length) throw Error(e.join("\n"));
      const incoming = clone(x);
      incoming.mode = "CUSTOM";
      workspaceWith("forecast", incoming);
      forecast = incoming;
      invalidate();
      persist();
      render();
      notice("Imported dataset is user-provided, not independently verified.");
    } else if (importType === "evidence") {
      const p = await checkImportedPacket(x);
      if (scenarios.length >= 30) throw Error("Scenario limit reached.");
      appendRecord("scenarios", scenarios, p);
      persist();
      render();
      notice(
        "Imported schedule and arithmetic rechecked. Optimality claims were not trusted.",
      );
    } else if (importType === "backup") {
      const b = await checkedBackup(x);
      assertWorkspaceSize(b);
      const merge = await confirmAction(
        `Backup preview: ${b.saved.length} workflows, ${b.datasets.length} snapshots, ${b.scenarios.length} scenarios. Confirm to MERGE with new IDs. Cancel to choose replacement next.`,
      );
      let next;
      if (merge) {
        if (
          saved.length + b.saved.length > 30 ||
          datasets.length + b.datasets.length > 20 ||
          scenarios.length + b.scenarios.length > 30
        )
          throw Error("Merged backup exceeds limits.");
        next = {
          schemaVersion: 1,
          workflow,
          forecast,
          saved: [...saved, ...b.saved.map((w) => ({ ...w, id: uid() }))],
          datasets: [
            ...datasets,
            ...b.datasets.map((f) => ({ ...f, id: uid() })),
          ],
          scenarios: [...scenarios, ...b.scenarios],
        };
      } else {
        if (
          !(await confirmAction(
            "Replace workspace with this validated backup? Current records will be replaced atomically. Export a backup first if needed.",
          ))
        )
          return;
        next = b;
      }
      assertWorkspaceSize(next);
      clearTimeout(saveTimer);
      await saveChain;
      if (!memory) await storeWorkspace(next);
      cancel(false);
      workflow = clone(next.workflow);
      forecast = clone(next.forecast);
      saved = clone(next.saved);
      datasets = clone(next.datasets);
      scenarios = clone(next.scenarios);
      current = null;
      stale = false;
      undo = [];
      redo = [];
      render();
      notice(
        memory
          ? "Validated backup restored in memory; persistence unavailable."
          : "Validated backup restored transactionally.",
      );
    }
  } catch (e) {
    notice("Import rejected; working data preserved: " + e.message);
  }
}
$("#import-file").addEventListener("change", (e) => {
  importFile(e.target.files[0]);
  e.target.value = "";
});
$("#app").addEventListener("change", (e) => {
  const el = e.target,
    card = el.closest("[data-task]");
  if (card) {
    const id = card.dataset.task;
    if (el.dataset.dep) {
      change(() => {
        const t = workflow.tasks.find((x) => x.id === id);
        t.dependsOn = el.checked
          ? [...t.dependsOn, el.dataset.dep]
          : t.dependsOn.filter((x) => x !== el.dataset.dep);
      });
      return;
    }
    if (el.dataset.field) {
      const key = el.dataset.field;
      let value = el.value;
      if (key.endsWith("Date")) {
        const ms = new Date(value).getTime(),
          slot = (ms - Date.parse(forecast.slots[0].from)) / 1800000;
        if (!Number.isFinite(slot) || !Number.isInteger(slot)) {
          notice(
            "Time must align exactly to 30-minute slots. No rounding performed.",
          );
          render();
          return;
        }
        change(
          () =>
            (workflow.tasks.find((x) => x.id === id)[
              key === "deadlineDate" ? "deadline" : "release"
            ] = slot),
        );
      } else
        change(
          () =>
            (workflow.tasks.find((x) => x.id === id)[key] = [
              "duration",
              "energyKWh",
              "release",
              "deadline",
            ].includes(key)
              ? numberValue(value)
              : value),
        );
      return;
    }
  }
  if (el.dataset.resource) {
    change(
      () =>
        (workflow.resources.find((r) => r.id === el.dataset.resource).name =
          el.value),
    );
    return;
  }
  if (el.id === "workflow-name") change(() => (workflow.name = el.value));
  else if (el.id === "horizon")
    change(() => (workflow.horizon = numberValue(el.value)));
  else if (el.id === "maxnodes" || el.id === "maxms") {
    config[el.id === "maxnodes" ? "maxNodes" : "maxMs"] = numberValue(el.value);
    invalidate();
    render();
  } else if (el.id.startsWith("sens-")) {
    sensitivity = {
      kind: $("#sens-kind").value,
      magnitude: numberValue($("#sens-mag").value),
      from: numberValue($("#sens-from").value),
      to: numberValue($("#sens-to").value),
    };
  }
});
$("#app").addEventListener("click", async (e) => {
  const link = e.target.closest("[data-error-target]");
  if (link) {
    e.preventDefault();
    const target = document.getElementById(link.dataset.errorTarget);
    for (
      let parent = target?.parentElement;
      parent;
      parent = parent.parentElement
    )
      if (parent.tagName === "DETAILS") parent.open = true;
    target?.focus();
    return;
  }
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    id = b.dataset.id,
    i = Number(b.dataset.index);
  try {
    if (a === "analyze") await run();
    else if (a === "cancel") {
      const wasActive = state === "RUNNING" || state === "VALIDATING";
      cancel();
      render();
      if (!wasActive) notice("No active analysis to cancel.");
    } else if (a === "add-task") {
      if (workflow.tasks.length >= 6) return notice("Six-task limit reached.");
      change(() =>
        workflow.tasks.push({
          id: uid(),
          name: "New task",
          notes: "",
          resourceId: workflow.resources[0].id,
          duration: 1,
          energyKWh: 0.1,
          release: 0,
          deadline: workflow.horizon,
          dependsOn: [],
        }),
      );
    } else if (a === "duplicate-task") {
      if (workflow.tasks.length >= 6) return notice("Six-task limit reached.");
      change(() => {
        const t = clone(workflow.tasks.find((x) => x.id === id));
        t.id = uid();
        t.name += " copy";
        workflow.tasks.push(t);
      });
    } else if (a === "delete-task") {
      if (workflow.tasks.length === 1)
        return notice("At least one task is required.");
      if (
        await confirmAction(
          "Delete this task and remove its references from dependent tasks?",
        )
      )
        change(() => {
          workflow.tasks = workflow.tasks.filter((t) => t.id !== id);
          workflow.tasks.forEach(
            (t) => (t.dependsOn = t.dependsOn.filter((d) => d !== id)),
          );
        });
    } else if (a === "add-resource") {
      if (workflow.resources.length >= 2)
        return notice("Two-resource limit reached.");
      change(() =>
        workflow.resources.push({ id: uid(), name: "Second resource" }),
      );
    } else if (a === "delete-resource") {
      if (workflow.resources.length === 1)
        return notice("At least one resource is required.");
      const target = workflow.resources.find((r) => r.id !== id);
      if (
        await confirmAction(
          `Delete resource and reassign its tasks to ${target.name}?`,
        )
      )
        change(() => {
          workflow.resources = workflow.resources.filter((r) => r.id !== id);
          workflow.tasks.forEach((t) => {
            if (t.resourceId === id) t.resourceId = target.id;
          });
        });
    } else if (a === "undo") {
      if (!undo.length) return notice("Nothing to undo.");
      redo.push(clone(workflow));
      workflow = undo.pop();
      invalidate();
      persist();
      render();
    } else if (a === "redo") {
      if (!redo.length) return notice("Nothing to redo.");
      undo.push(clone(workflow));
      workflow = redo.pop();
      invalidate();
      persist();
      render();
    } else if (a === "duplicate-workflow")
      change(() => {
        workflow.id = uid();
        workflow.name += " copy";
      });
    else if (a === "reset" || a === "guided") {
      if (
        await confirmAction(
          "Replace editor inputs with the guided recorded example? Saved records remain.",
        )
      ) {
        forecast = clone(recorded);
        change(() => (workflow = example()));
        current = null;
        stale = false;
        render();
        notice(
          "Guided example: analyze → impossible chain → restore feasible → save/compare → offline → export.",
        );
      }
    } else if (a === "replay") {
      forecast = clone(recorded);
      invalidate();
      persist();
      render();
      notice("Recorded replay explicitly selected.");
    } else if (a === "live") await fetchLive();
    else if (a === "whatif") {
      const task = $("#what-task").value,
        deadline = numberValue($("#what-deadline").value);
      if (current && !stale && scenarios.length < 30)
        appendRecord("scenarios", scenarios, { ...clone(current), id: uid() });
      change(
        () => (workflow.tasks.find((t) => t.id === task).deadline = deadline),
      );
      await run();
    } else if (a === "contradiction") {
      forecast = clone(recorded);
      change(() => {
        workflow = example();
        workflow.tasks.find((t) => t.id === "report").deadline = 4;
      });
      await run();
    } else if (a === "restore-deadline") {
      forecast = clone(recorded);
      change(() => (workflow = example()));
      await run();
    } else if (a === "sensitivity") {
      if (current && !stale && scenarios.length < 30)
        appendRecord("scenarios", scenarios, { ...clone(current), id: uid() });
      const transformed = transform(
        forecast,
        sensitivity.kind,
        sensitivity.magnitude,
        sensitivity.from,
        sensitivity.to,
      );
      const ferr = validateForecast(transformed);
      if (ferr.length) throw Error(ferr.join(" "));
      workspaceWith("forecast", transformed);
      forecast = transformed;
      invalidate();
      persist();
      render();
      await run();
    } else if (a === "save-scenario") saveScenario();
    else if (a === "restore-scenario") {
      const p = scenarios[i];
      workflow = clone(p.workflow);
      forecast = clone(p.forecast);
      current = clone(p);
      config = clone(p.result.config);
      state = "COMPLETED";
      stale = false;
      undo = [];
      redo = [];
      persist();
      render();
      notice("Saved analysis restored. Refresh and rerun before any Live use.");
    } else if (a === "delete-scenario") {
      if (await confirmAction("Delete this saved scenario?")) {
        scenarios.splice(i, 1);
        persist();
        render();
      }
    } else if (a === "save-workflow") {
      const e = validateWorkflow(workflow);
      if (e.length) throw Error(e.join("\n"));
      const idx = saved.findIndex((w) => w.id === workflow.id);
      if (idx < 0 && saved.length >= 30) throw Error("30-workflow limit.");
      const nextSaved = clone(saved);
      if (idx >= 0) nextSaved[idx] = clone(workflow);
      else nextSaved.push(clone(workflow));
      workspaceWith("saved", nextSaved);
      saved = nextSaved;
      persist();
      render();
      notice("Named workflow saved.");
    } else if (a === "load-workflow") {
      if (await confirmAction("Replace editor with this named workflow?"))
        change(() => (workflow = clone(saved[i])));
    } else if (a === "delete-workflow") {
      if (await confirmAction("Delete named workflow?")) {
        saved.splice(i, 1);
        persist();
        render();
      }
    } else if (a === "save-dataset") {
      if (datasets.length >= 20) throw Error("20-snapshot limit.");
      appendRecord("datasets", datasets, { ...clone(forecast), id: uid() });
      persist();
      render();
      notice("Snapshot saved locally.");
    } else if (a === "load-dataset") {
      forecast = clone(datasets[i]);
      if (forecast.mode === "LIVE") forecast.mode = "REPLAY";
      invalidate();
      persist();
      render();
      notice("Saved snapshot loaded; any historical Live source is replay.");
    } else if (a === "delete-dataset") {
      if (await confirmAction("Delete snapshot?")) {
        datasets.splice(i, 1);
        persist();
        render();
      }
    } else if (a === "export-workflow")
      download("carbonqueue-workflow.json", workflow);
    else if (a === "download-data")
      download("carbonqueue-dataset.json", forecast);
    else if (a === "export-evidence" || a === "export-report") {
      if (!current || stale) throw Error("Run current inputs before export.");
      if (a === "export-evidence")
        download("carbonqueue-evidence.json", current);
      else download("carbonqueue-report.txt", report(current), "text/plain");
    } else if (a === "export-backup")
      download("carbonqueue-backup.json", {
        schemaVersion: 1,
        workflow,
        forecast,
        scenarios,
        saved,
        datasets,
      });
    else if (a.startsWith("import-")) {
      importType = a.slice(7);
      $("#import-file").click();
    } else if (a === "clear-all") {
      if (
        await confirmAction(
          "Delete all locally stored workflows, snapshots, scenarios and editor data? Export a backup first.",
        )
      ) {
        const next = {
          schemaVersion: 1,
          workflow: example(),
          forecast: clone(recorded),
          saved: [],
          datasets: [],
          scenarios: [],
        };
        clearTimeout(saveTimer);
        await saveChain;
        let clearWarning = "";
        try {
          await storeWorkspace(next);
          memory = false;
          saveStatus = "Saved locally";
        } catch (err) {
          memory = true;
          saveStatus = "Memory only · export backup";
          clearWarning =
            " Memory cleared; durable storage could not be updated: " +
            err.message +
            ". Old durable records may reappear after reload.";
        }
        workflow = next.workflow;
        forecast = next.forecast;
        saved = [];
        datasets = [];
        scenarios = [];
        current = null;
        undo = [];
        redo = [];
        stale = false;
        cancel(false);
        render();
        notice(
          "All local records reset/deleted from the active workspace. Cached public app assets remain for offline use." +
            clearWarning,
        );
      }
    }
  } catch (err) {
    notice(err.message);
  }
});
$("#apply-update").onclick = async () => {
  if (
    await confirmAction(
      "Apply update and reload? Export any memory-only or unsaved work first.",
    )
  ) {
    clearTimeout(saveTimer);
    await saveChain;
    try {
      await storeWorkspace({
        schemaVersion: 1,
        workflow,
        forecast,
        saved,
        datasets,
        scenarios,
      });
    } catch (e) {
      return notice("Save failed; export backup before updating.");
    }
    updateWorker?.postMessage("ACTIVATE_UPDATE");
  }
};
let recovery = [];
try {
  const x = await loadWorkspace();
  if (x) {
    if (x.schemaVersion !== 1)
      throw Error("Unsupported saved workspace version.");
    if (!validateWorkflow(x.workflow).length) workflow = x.workflow;
    else recovery.push("Invalid editor isolated.");
    if (!validateForecast(x.forecast).length) {
      forecast = x.forecast;
      if (
        forecast.mode === "LIVE" &&
        Date.parse(forecast.slots[0]?.from) < Date.now()
      )
        forecast.mode = "REPLAY";
    } else recovery.push("Invalid forecast isolated.");
    saved = (Array.isArray(x.saved) ? x.saved : [])
      .filter((w) => !validateWorkflow(w).length)
      .slice(0, 30);
    saved = uniqueRecords(saved);
    datasets = (Array.isArray(x.datasets) ? x.datasets : [])
      .filter((f) => !validateForecast(f).length)
      .slice(0, 20);
    datasets = uniqueRecords(datasets);
    for (const p of (Array.isArray(x.scenarios) ? x.scenarios : []).slice(
      0,
      30,
    )) {
      try {
        const checked = await checkImportedPacket(p);
        checked.name = p.name;
        checked.id = scenarios.some((s) => s.id === p.id) ? uid() : p.id;
        scenarios.push(checked);
      } catch {
        recovery.push("Invalid scenario isolated.");
      }
    }
  }
} catch (e) {
  memory = true;
  saveStatus = "Memory only · export backup";
  recovery.push(e.message);
}
render();
if (recovery.length) notice("Workspace recovery: " + recovery.join(" "));
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      if (reg.waiting) {
        updateWorker = reg.waiting;
        $("#update").hidden = false;
      }
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            updateWorker = nw;
            $("#update").hidden = false;
          }
        });
      });
    })
    .catch((e) =>
      notice(
        $("#notice").textContent +
          " Offline shell registration failed: " +
          e.message,
      ),
    );
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateWorker) location.reload();
  });
}
window.addEventListener("online", render);
window.addEventListener("offline", () => {
  render();
  notice(
    "Offline: use recorded/custom data. Editing, solving and exports stay local.",
  );
});
window.addEventListener("beforeunload", (e) => {
  if (saveStatus === "Saving…" || memory) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("pagehide", () => cancel(false));

setInterval(() => {
  if (
    forecast.mode === "LIVE" &&
    validateLive(forecast, workflow).length &&
    state !== "RUNNING" &&
    current &&
    !stale
  ) {
    stale = true;
    render();
    notice(
      "Live origin or freshness expired. Refresh; past slots cannot be recommended.",
    );
  }
}, 30000);

mountCopilot(
  document.getElementById("copilot"),
  () => ({
    horizon: workflow.horizon,
    datasetId: forecast.id,
    origin: forecast.slots[0]?.from,
  }),
  async (w) => {
    if (
      !(await confirmAction(
        "Replace the workflow with your reviewed AI-assisted draft? Undo can restore the previous workflow.",
      ))
    )
      return false;
    change(() => {
      workflow = { ...clone(w), id: uid() };
    });
    notice(
      "Reviewed AI-assisted inputs applied; no schedule or carbon benefit is claimed until analysis.",
    );
    document.getElementById("planner")?.scrollIntoView({ behavior: "auto" });
    return true;
  },
);
