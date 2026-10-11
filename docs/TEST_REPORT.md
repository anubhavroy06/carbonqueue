# CarbonQueue 1.1.0 — executed release evidence

**Status: IMPLEMENTED — VERIFICATION INCOMPLETE.** Core application, deployed backend and mocked copilot review flow passed the checks below. A successful actual Gemini model request still requires a user-provided free-project key; it has NOT been verified. No provider-success or Gemini-prize claim is made.

- Website: https://carbonqueue.pages.dev
- Source: https://github.com/anubhavroy06/carbonqueue
- Build identity: `45ea64fb53ab44c69b6b46d22f9e826b93247a8870c9ce9b529ce3f4621caa88`
- Cloudflare production: `3dcccd80-7b1f-48d4-a5bc-cf334996210e`; uses_functions=true for `/api/*` only, static core assets.
- Report assembled: 2026-10-11T15:25:46.629734+00:00. Individual JSON logs retain actual execution timestamps.
- Hackathon entry not submitted; separate authorization needed.

## Executed checks
- **34 Node test groups**, all passed; 20 domain groups plus 14 gateway groups. Includes **100 seeded independent-reference cases**, seed 29011, 23,910 start assignments; six-task/two-resource exact small horizon, known optima/infeasibility, metamorphic, tamper and UTC context checks.
- **89 local browser checks**: prior 75 core checks across six suites plus 14 copilot checks. Current production build tested: input approval, tampered draft rejection, real solver after approved draft, Undo, no key in local persistence, forget/reload, explicit consent/no automatic inference, mobile and zero automated axe violations.
- **51 hosted browser checks**: prior 35 core checks (20 main +15 release checks), plus 16 copilot checks including actual gateway health/version and missing-key rejection. One separate informative record refers to the controlled LOCAL SW-update test; do not count it as a forced hosted update.
- Actual hosted NESO request supplied future GB intervals; modeled result independently verified. Separate mocked provider failure tests are labeled mocked.
- Actual hosted offline reload → solve → evidence export; evidence reimport, backup, three scenarios, contradiction/counterfactual, mobile/keyboard and no uncaught exceptions.
- **13 served frontend asset SHA256 values match** `release.json`. Backend files are separately hashed in build metadata, deployed via ZIP, and health/input validation actually exercised; no claim that unpublished server bytecode was downloaded from the edge.
- Typecheck, production build, syntax/unsafe-eval checks and source secret-pattern scan passed. Pattern scanning is not a comprehensive security audit. Dependency versions pinned with lockfile.

## Measured performance
See `tests/performance.json` for actual machine/time/results. Current measured whole deployment payload: 157,696 bytes (includes backend files); median tiny solver 2.46 ms in that run. Six-job/two-resource 48-slot stress: FEASIBLE_BEST_FOUND, 10,752 nodes, ~2,002.68 ms, accepted assignment verified. Timed results vary; no stress optimum claim. Accessibility checks are not WCAG certification or exhaustive screen-reader coverage.

## Provider and test boundary
`tests/copilot.test.mjs` stubs upstream fetch explicitly. Copilot browser successful draft uses a Playwright-intercepted gateway response with a clearly fake TEST_ONLY key. Actual hosted gateway health/invalid-key rejection are not mocked; no actual successful Gemini request yet. Keys are never embedded in release files; no private workflows/exports are published. Provider project billing/quotas cannot be established from pricing alone.

Browser downloads were triggered and exact generated Blob text inspected for import verification. Shared-browser filesystem download paths are inaccessible to the sandbox, so this is not verification of a particular user's OS Downloads folder.

Public publication and anonymous clean-checkout rebuild are checked separately from local compilation. Direct Upload is manual, not Git-connected CI. Preserve v1.0.1 rollback; no paid changes made.
