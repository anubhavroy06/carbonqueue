# CarbonQueue 1.0.1 — verified release

**Status: VERIFIED COMPLETE within the declared planning-application contract.**

- Website: https://carbonqueue.pages.dev
- Public source: https://github.com/anubhavroy06/carbonqueue
- Public verification completed: 2026-10-11T14:52:10.555Z
- Build identity: `ed81c53bfabca2cd5db584afdc66c42afa72fba21b46f3fbfce460e60b3baf93`
- Cloudflare production deployment: `1061000e-4271-48b5-b917-07adf44a5380`; static assets only, uses_functions=false.
- Hackathon entry: not submitted; separate participant authorization required.

## Executed evidence

- **20 domain groups**, no failed/skipped cases. Includes **100 seeded independent-reference cases**, seed 29011, 23,910 assignments, six-task/two-resource reference, known optima/infeasibility, metamorphic and tamper tests.
- **75 local browser checks** across six suites. Real controlled service-worker update activation was tested locally, not fabricated on production.
- **35 additional executed hosted checks**: 20 public user-journey checks and 15 additional editor/recovery/Live checks. One further informational record points to the local controlled-update test and is not counted as a new production update test.
- Anonymous isolated browser contexts opened the actual HTTPS origin without GitHub/Cloudflare login.
- Actual deployed CSP includes worker-src self and frame-ancestors none; nosniff and no-referrer headers were checked.
- All **12 manifest assets** returned 200 and matched SHA-256; version/build identity matches the anonymously cloned and rebuilt public source.
- Hosted journey: baseline/candidate verification, independent certificate, deadline restoration, nonuniform sensitivity, three saved scenarios, evidence import, six-task/two-resource run, backup merge, offline reload and real recomputation/export, mobile and keyboard.
- Additional hosted paths: undo/redo, duplicate/delete, resource reassignment, field errors, cancellation, stale results, malformed imports, unavailable storage and corruption recovery. Provider success/rate-limit fault simulations are explicitly labeled mocks, not live source evidence.
- **Actual NESO browser smoke**: Live GB loaded. Origin moved to 2026-10-11T15:00Z. Slot constraints are relative to this explicit new origin. Export asserts fw48h endpoint, 48 future intervals and independent schedule validity.
- Zero uncaught errors in the hosted suites; **0 axe violations on tested screens**. Desktop/mobile captures were visually reviewed.
- Secret-pattern scan and dependency audit passed at local inspection; 0 known advisories then. Not comprehensive security or accessibility certification.

## Remote-browser export verification

The shared-browser download filesystem is separate from this workspace. Tests assert a real browser download event and inspect the exact Blob constructed by the application, then use that content for real reimport checks. This is instrumentation, not a replacement/fabrication of the exported result. It does not assert a particular user's operating-system download destination.

## Measurements

Production static files: **133,541 bytes**. Hosted cold UI load in the successful main run: 1883 ms; a single browser/network observation, not an SLA. Local ten-run median solver time: 2.58 ms. Six-job/48-slot stress: 2005.8 ms, 10496 nodes, FEASIBLE_BEST_FOUND, independent verifier true. No optimum claim on that bounded stress run.

## Model and verification boundaries

Six non-preemptive tasks, two fixed resources, one selected electricity region, 30-minute slots, at most 24 hours. Energy is assumed whole-task kWh spread uniformly; average forecast gCO2/kWh is not marginal carbon or measured avoided emissions. No execution, metering, certification, cloud synchronization or automatic workload dispatch. Browser storage can be evicted; exports are the recovery path. Timed search may vary by device.

Executed tests cannot prove the absence of every undiscovered defect. There is no cross-browser/assistive-technology certification or uptime guarantee. Ordinary sandbox HTTP fetches encountered early propagation/egress errors; actual public browser checks succeeded and supply the hosted evidence.

## Re-run and deploy

`npm ci && npm run test:release` executes local verification. `npm run serve` starts the local demo. Hosted suites require a browser CDP endpoint provided through AGENT_BROWSER_CDP and connect rather than launch an external hidden browser; they close only their own isolated contexts.

Source is published independently of Pages. This release uses **Direct Upload**, not automatic Git integration; pushes alone do not trigger deployment. Build with `npm ci && npm run build`, then upload dist through the existing project dashboard or an authenticated Wrangler Pages deployment. No account token belongs in source.

## Cost and submission

No purchases, payment methods, billing activation, database/AI calls, paid domain, Pages Functions or tracking integration were added. Existing hardware/network are assumed; future free-tier terms are not guaranteed. Core needs no Gemini key, so none was requested or exposed.

The public app/repository are ready for participant review and demo. Actual submission, contributor names, track selection and required video/live-demo publication remain participant-controlled event actions, not incomplete planner features.
