# Reproduce and independently check a result

1. `npm ci` then `npm test`. The test-only reference in tests/domain.test.mjs independently enumerates Cartesian start choices and separately checks constraints/arithmetic. It does not call the production feasibility or objective routines. The suite includes 100 generated cases with initial PRNG seed 29011 (23,910 assignments), plus known-optimum, infeasible, parallel-resource and tamper tests.
2. `npm run serve`, open the local URL, load recorded replay and analyze. Save/export evidence. The packet includes raw/normalized source, task/resources, configuration, run/fingerprint, result/status, verification, assumptions and versions.
3. Import the packet. Validation rejects bad schema, intervals, infeasible schedules, forged certificates, mismatched objectives/fingerprints and invalid metadata. Imported feasible status becomes FEASIBLE_BEST_FOUND; imported optimality is not proof.
4. Use a high node/time budget for tiny exact instances only. OPTIMAL means exhaustion under the declared discrete model. Best-found output is still constraint-verified but has no global-optimality claim or unsupported gap.
5. Wall-clock runs may reach different incumbents across machines. Reproducible verification of an exported assignment is distinct from identical timed search output. Deterministic reference/node-bounded tests preserve ordering/tie rules.
6. All unit quantities are explicit: 30-minute slot duration; whole-task kWh; gCO2/kWh input and gCO2 result. No implicit CO2e, marginal carbon, idle/PUE or measured emission benefit.
7. Replay preserves source timestamps. Live excludes past intervals and expires results rather than silently modifying frozen inputs. Custom/sensitivity data is conspicuously user-provided or synthetic.

## Test commands

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run serve
# second terminal while preview stays open
npm run test:browser
node tests/release-browser.mjs
BASE_PATH=/carbonqueue PORT=4174 node scripts/server.mjs
# another terminal (both preview ports running)
node tests/failure-browser.mjs
node tests/keyboard.mjs
node tests/hardening-browser.mjs
node tests/contract-browser.mjs
node scripts/measure.mjs
```

The first main browser suite creates backup artifacts used by the failure suite. The hardening suite explicitly mocks 96 intervals with synthetic future timestamps
and recorded intensity values, so it does not expire after this build date.
The release-browser suite separately performs an actual current keyless API request
and asserts 48 future intervals, correct endpoint and independent plan validity.
These test dependencies are test fixtures, not the application's Live or replay logic.

Local preview CSP tests alone are not public-host evidence; hosted-browser.mjs now independently checks the actual public response headers and Worker behavior. Browser versions/machine and timings are captured in tests/performance.json and TEST_REPORT.md. No full WCAG certification or comprehensive security audit is claimed.

For the complete seven-suite local release, run `npm run test:release`; the runner owns its previews and records build identity. Evidence 1.0.1 includes explicit independently checked UTC/local conversion metadata. Legacy 1.0.0 packets derive UTC metadata and are marked legacyDerived rather than asserting an unknown original timezone.

## Production verification

Use the actual site at https://carbonqueue.pages.dev. Shared-browser suites tests/hosted-browser.mjs and tests/hosted-release-browser.mjs require AGENT_BROWSER_CDP and close only contexts they create; they never close the shared browser. They validate browser download events and the exact export Blob because the remote download filesystem is not the workspace. Provider mocks are explicitly labeled; a separate actual NESO request remains unmocked. Do not run destructive update-version simulations against production.

## Optional Gemini verification
Run `node --test tests/copilot.test.mjs` after build and `node tests/copilot-browser.mjs` against the local preview. Upstream responses are explicitly mocked in these success checks. For hosted checks use `CQ_HOSTED=1 AGENT_BROWSER_CDP=... node tests/copilot-browser.mjs` with an existing shared browser connection; only its own context is closed. Hosted health and missing-key validation are actual. Never use real keys in scripts, test fixtures or logs. To test real inference, enter a free-project key only in the live app's session password field, consent to the public example, request one draft, review and approve, then solve. Forget the key afterward. No provider-success claim until this completes.
