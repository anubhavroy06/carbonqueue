# CarbonQueue 1.1.0 — executed release evidence

**Status: VERIFIED COMPLETE.** Core application, deployed backend and mocked copilot review flow passed the checks below. Actual Gemini 3.1 Flash-Lite generation and approved-draft scheduling passed; the final current public-source rebuild passed and matches deployment. No prize guarantee is made.

- Website: https://carbonqueue.pages.dev
- Source: https://github.com/anubhavroy06/carbonqueue
- Build identity: `f82c8b6b6e3d6c545531188088aea6f7ffc176ac9c31e460a7f07e8c52f2ddb5`
- Cloudflare production: `8bb5e8c6-c599-4b6f-ab3d-ac7f1a25b4e1`; uses_functions=true for `/api/*` only, static core assets.
- Report assembled: 2026-10-11T15:25:46.629734+00:00. Individual JSON logs retain actual execution timestamps.
- Hackathon entry not submitted; separate authorization needed.

## Executed checks
- **35 Node test groups**, all passed; 20 domain groups plus 15 gateway groups. Includes **100 seeded independent-reference cases**, seed 29011, 23,910 start assignments; six-task/two-resource exact small horizon, known optima/infeasibility, metamorphic, tamper and UTC context checks.
- **89 local browser checks**: prior 75 core checks across six suites plus 14 copilot checks. Current production build tested: input approval, tampered draft rejection, real solver after approved draft, Undo, no key in local persistence, forget/reload, explicit consent/no automatic inference, mobile and zero automated axe violations.
- **51 hosted browser checks**: prior 35 core checks (20 main +15 release checks), plus 16 copilot checks including actual gateway health/version and missing-key rejection. One separate informative record refers to the controlled LOCAL SW-update test; do not count it as a forced hosted update.
- Actual hosted NESO request supplied future GB intervals; modeled result independently verified. Separate mocked provider failure tests are labeled mocked.
- Actual hosted offline reload → solve → evidence export; evidence reimport, backup, three scenarios, contradiction/counterfactual, mobile/keyboard and no uncaught exceptions.
- **13 served frontend asset SHA256 values match** `release.json`. Backend files are separately hashed in build metadata, deployed via ZIP, and health/input validation actually exercised; no claim that unpublished server bytecode was downloaded from the edge.
- Typecheck, production build, syntax/unsafe-eval checks and source secret-pattern scan passed. Pattern scanning is not a comprehensive security audit. Dependency versions pinned with lockfile.

## Measured performance
See `tests/performance.json` for actual machine/time/results. Current measured whole deployment payload: 160,236 bytes (includes backend files); median tiny solver 2.84 ms in that run. Six-job/two-resource 48-slot stress: FEASIBLE_BEST_FOUND, 10,624 nodes, ~2,009.94 ms, accepted assignment verified. Timed results vary; no stress optimum claim. Accessibility checks are not WCAG certification or exhaustive screen-reader coverage.

## Provider and test boundary
`tests/copilot.test.mjs` stubs upstream fetch explicitly. Copilot browser successful draft uses a Playwright-intercepted gateway response with a clearly fake TEST_ONLY key. Actual hosted gateway health/invalid-key rejection are not mocked; actual successful Gemini 3.1 Flash-Lite request separately verified. Keys are never embedded in release files; no private workflows/exports are published. Provider project billing/quotas cannot be established from pricing alone.

Browser downloads were triggered and exact generated Blob text inspected for import verification. Shared-browser filesystem download paths are inaccessible to the sandbox, so this is not verification of a particular user's OS Downloads folder.

Public publication and anonymous clean-checkout rebuild are checked separately from local compilation. Direct Upload is manual, not Git-connected CI. Preserve v1.0.1 rollback; no paid changes made.

## Real Gemini integration (separate from mocked/automated counts)
User supplied a free-project key via secure form; the agent did not read it. An actual Gemini 3.1 Flash-Lite response produced four tasks/one resource. Human review corrected an extra backup dependency/release to honor the independent-backup brief. Explicit approval applied the draft; genuine solver output passed independent verification; Undo restored and reverified the original workflow. Key cleared. First 2.5 attempt failed with an initially generic safe error; exact cause remains unresolved. No automatic inference retry/fallback. See `tests/gemini-live-verification.json`. Gemini 2.5/3.5 alternatives are allowlisted and failure/selection tested, not all successful-live tested. No model is assumed correct, reliable or free for every key/project.

## Final public-source verification
Anonymous checkout `a600804acfb96a961c6222744954e228261d981a` rebuilt 2026-10-11T15:45:01.111Z:35 groups/typecheck/syntax checks PASS; runtime build SHA256 matches `f82c8b6b6e3d6c545531188088aea6f7ffc176ac9c31e460a7f07e8c52f2ddb5`. Subsequent handoff commit changes documentation/evidence only, not runtime bytes. Final release status assembled 2026-10-11T15:46:02.312116+00:00: **VERIFIED COMPLETE within the bounded application contract and tested Gemini 3.1 Flash-Lite path**. No claim that every account/model/network can always succeed.
