# CarbonQueue 1.0.1

**Verified release:** [Open CarbonQueue](https://carbonqueue.pages.dev) · [Source](https://github.com/anubhavroy06/carbonqueue)

20 domain groups, 100 independent-reference cases, 75 local browser checks and 35 additional hosted checks passed. See [executed verification](docs/TEST_REPORT.md). This is a planning tool—not measured carbon savings or workload dispatch.

An explainable, local-first carbon-aware **workflow planning** application.
Define dependent tasks, assign fixed resources, compare feasible schedules,
inspect sound constraint contradictions, save scenarios, and export evidence.
No workload execution, paid AI, metering, or carbon certification.

## Run from a clean checkout

Requires Node 22+ and npm. Runtime assets have no third-party CDN dependencies.

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run serve
```

Open **http://127.0.0.1:4173/**. Do not open index.html using file://: module
Workers and offline service workers require an HTTP(S) origin. localhost is a
secure context for service workers. `npm run build` writes the deployment files
to `dist/`; the build prints a content hash and writes `release.json`.

Browser tests use an existing Chromium when found, or Playwright’s browser.
Set `CARBONQUEUE_BROWSER` to an installed Chromium executable when needed.
If none is installed, run `npx playwright install chromium` (free browser download).

```sh
npm run test:browser
node tests/release-browser.mjs
```

Tests launch sandbox-local Chromium only. The actual-live smoke test makes one
read-only NESO request; other API failure tests use explicitly mocked responses.
The update test temporarily changes dist/sw.js and restores it afterwards.

## Complete release features

- 1–6 tasks, 1–2 fixed resources, cross-resource dependencies, 30-minute slots,
  up to 48 slots/24 hours; editor with undo/redo and absolute local-time inputs.
- Live GB forecast, timestamped real recorded replay, validated custom dataset.
- Deterministic baseline, bounded optimization, independent verification and
  OPTIMAL / FEASIBLE_BEST_FOUND / UNKNOWN / INFEASIBLE statuses.
- Checkable window/path/resource-overload contradictions and cycle validation.
- Deadline counterfactual, uniform and nonuniform sensitivity, saved scenarios.
- Local named workflows/snapshots, autosave, validated transactional merge/replace
  backup, deletion, record recovery and memory-only fallback.
- Evidence JSON with input SHA-256, independent reimport verification,
  human-readable report and dataset/workflow exports.
- Offline shell/reload, versioned content-addressed caches, safe update activation.
- Responsive interface, keyboard controls, field error navigation, chart tables,
  privacy/methodology/licenses/help integrated in the app.

## Guided demonstration

Analyze the recorded example → save scenario → demo impossible chain → explain
its lower-bound certificate → restore feasible example → change intensity window
and recompute → save/compare → export evidence → reload offline and repeat.
Recorded task energies are **synthetic** and the data is **historical replay**.
No realized emissions reduction is claimed.

## Deployment

Public source: https://github.com/anubhavroy06/carbonqueue

Cloudflare Pages project: `carbonqueue`; production is deployed and anonymously verified at https://carbonqueue.pages.dev. This is a static **Direct Upload** project, not an automatic Git-connected deployment. Repository pushes alone do not redeploy the site.

Build with `npm ci && npm run build`, then upload the contents of `dist/` to the existing Pages project. Use a free provider HTTPS subdomain and static hosting only; no Functions, paid Workers, billing-enabled integrations or purchased domain are required. The `_headers` file supplies CSP, nosniff, Referrer-Policy and Permissions-Policy on Cloudflare Pages.

Root/project-subpath assets are relative. Verify the actual HTTPS origin anonymously, including Worker, service worker, Live refresh, offline reload, mobile and evidence export. Deployment is not hackathon submission.

## Cost/privacy

No mandatory runtime package, paid model, database, account, telemetry, purchased
font or domain. Existing hardware/internet are assumed. The only remote runtime
request is explicit NESO forecast refresh, which sends UTC time—not task data.
No interval sliders trigger API calls. Fresh Live snapshots are reused; rate
limits obey Retry-After/cooldown with no automatic loops. Actual numeric API quota
is unpublished. Local browser storage is fallible: export backups regularly.

## Limits and evidence honesty

Energy is whole-task kWh uniformly distributed across task slots. Average forecast
intensity is gCO2/kWh, not marginal carbon or measured avoided emissions. Fixed
energy shifting does not reduce kWh. Idle/facility/network/embodied effects are
excluded. All resources share one data region; Live applies to GB only. Custom
provenance is user-provided and not independently verified.

Optimality is only proven when the declared finite-model search exhausts. Time
or node limits can produce best-found or unknown. A failed greedy baseline is
not infeasibility. Imported plans are independently checked and any claimed
optimality is downgraded unless recomputed; input hashes do not certify origin.
Wall-clock-limited searches may produce different incumbents across devices.

## Attribution and AI disclosure

Data: National Energy System Operator, CC BY 4.0.
https://api.carbonintensity.org.uk/ · https://github.com/carbon-intensity/terms ·
https://creativecommons.org/licenses/by/4.0/
Raw fixture and retrieval metadata are preserved; sensitivity transformations are
identified. No endorsement implied. App icon/CSS/code created for this build.

This application, tests and documentation were produced with AI coding assistance
by the assistant in this session and tested with actual tools. Participants must
review/understand the code, accurately disclose assistance, and follow event rules.
Carbon scheduling is known prior art, including CaWoSched and Carbon Aware SDK;
this app claims a transparent diagnostic/reproducibility product slice, not a
new optimization problem.

See docs for schemas, architecture, evidence, cost audit and judge preparation.

## Release evidence and handoff

See `docs/RELEASE_CHECKLIST.md`, `docs/TEST_REPORT.md`, `docs/DEPENDENCY_AUDIT.md`,
`docs/DECISIONS.md`, `docs/REPRODUCIBILITY.md`, and `docs/JUDGE_PACKAGE.md`.
Public deployment/account authorization is the remaining external gate; no
public repository/site URL or hackathon submission is fabricated.

Run the full local release check with `npm run test:release`. It creates/verifies
local preview servers when needed, executes all five browser suites, and stops
only the preview servers it owns. An occupied port serving an unrelated build
is a blocker, not permission to terminate another process. The actual Live smoke
requires network access; mocked tests are explicitly distinguished.
