# CarbonQueue 1.0.1 — executed release verification

**Status: IMPLEMENTED — VERIFICATION INCOMPLETE**

The complete declared planning application is implemented and the local release runner passes. Public source publication, HTTPS hosting/account authorization and anonymous public-origin smoke checks remain unverified external gates. There is no fabricated public URL or completed hackathon entry.

Local verification completed: 2026-10-11T13:54:06.500Z.
Build identity: `ed81c53bfabca2cd5db584afdc66c42afa72fba21b46f3fbfce460e60b3baf93`.

## Executed results

- **20 domain test groups pass; 0 fail, 0 skipped.** Includes 100 seeded generated cases, initial seed 29011, independently enumerating 23,910 assignments, plus a six-task/two-resource exact reference, known feasible/infeasible cases, scaling/constraint metamorphic checks, forged certificates and tampered evidence. Generated ideas/research are not being counted as executed code tests.
- **75 recorded checks across six browser suites**: browser-results.json: 18, release-browser-results.json: 16, failure-browser-results.json: 14, keyboard-results.json: 7, hardening-results.json: 5, contract-results.json: 15. All suites exited successfully in `npm run test:release`; see full-release-run.log and per-suite JSON.
- Automated axe scans found **zero violations on the tested screens**, including an open confirmation dialog. Keyboard actions, focus wrapping/Escape recovery, 390px mobile and 720px enlarged-text reflow were exercised. Scalable rem typography was checked at 200% root text size; the test explicitly verifies the computed intro text doubles. Desktop and enlarged-text screenshots are captured for inspection. Not a complete cross-browser, assistive-technology or WCAG certification.
- Actual browser Live API smoke: `Live GB loaded. Origin moved to 2026-10-11T14:00Z. Slot constraints are relative to this explicit new origin.`. Exported result asserts fw48h, 48 future intervals and independent plan validity. A separate actual keyless HTTP request returned 200/CORS `*`/96 intervals. These are read-only endpoint checks, not provider stress tests or an SLA.
- Explicitly mocked fault cases: future response, 429/Retry-After, HTTP503, malformed data, ten-second timeout, blocked storage, quota exhaustion and forged/stale Worker messages. Mocked checks are not presented as live measurements.
- Actual service-worker offline **reload**, editing/solving/evidence download and update activation with preserved editor were tested, including project-subpath hosting and CSP. First-ever visit still needs the app download.
- Persistence merge/replace, corrupt-record isolation, invalid backup rollback, deletion, autosave and memory fallback were exercised. An allowed 2 MiB JSON import was parsed and usable as recorded in hardening-results.json (including browser interaction); oversized input was rejected without editor loss.
- Type check, syntax/unsafe-evaluation scan, production clean build and secret-pattern scan pass. Pattern scan: 29 release-source files, zero matches; not a comprehensive security assessment. npm advisory audit: **0 known vulnerabilities** at inspection, including pinned development dependencies.

## Measured performance — not an SLA

Machine: linux/x64, Intel(R) Xeon(R) Processor @ 2.90GHz; Node v24.14.1; Chromium 153.0.8010.12.

- Production files: **133,541 bytes** (130.4 KiB), including PNG icons, replay data, hashes and headers.
- Cold local production page: 296 ms; localhost measurement, not public-network load.
- Ten verified example-solver runs: median 2.58 ms; returned schedules verified.
- Six-task/48-slot/two-resource zero-energy tie stress: 10,496 nodes, 2005.8 ms, FEASIBLE_BEST_FOUND, verifier True. The 2,000 ms limit is checked periodically; slight overshoot is visible. No optimum claim is made on that limited run.
- Responsiveness/cancellation tested with a genuine long search in an isolated Worker. Repeated runs and edit invalidation cannot accept a stale old result.

## Limitations versus incomplete gates

Model limitations: fixed resource mapping, one selected electricity region, six non-preemptive jobs, 30-minute slots, at most 24 hours; assumed whole-task energy distributed uniformly. Average forecast intensity is not marginal carbon, realized avoided emissions or certification. Timed search can vary across devices. Browser storage is not a permanent backup or cross-device sync. These are explicit scope boundaries, not unfinished required features.

External incomplete gates: authorization and access for public source/hosting; actual public-site security/Worker/API/offline/export/mobile verification; separately authorized entry submission. Current first-party API fees are free, but future terms/quotas are not guaranteed. Hosting documentation is not proof of account provisioning.

## Re-run

`npm ci && npm run test:release` from the source folder. The release runner checks/starts only its own local previews and cleans them up. Actual Live smoke requires network; all mocked cases are labelled. Test artifacts use only generated example workflows and public provider data. Publication must exclude personal workflows/backups.

See RELEASE_CHECKLIST.md, DEPENDENCY_AUDIT.md, DECISIONS.md, ARCHITECTURE.md, REPRODUCIBILITY.md, JUDGE_PACKAGE.md and the source ledgers. All declared application features are shipped rather than deferred to a future roadmap.
