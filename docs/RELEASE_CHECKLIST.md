# Release checklist and feature/test traceability

Status: **IMPLEMENTED — VERIFICATION INCOMPLETE**. No public repository or hosted URL has been created. Publication authorization/account access and anonymous hosted smoke testing remain external release gates. This is not a hackathon submission. Eligibility was confirmed by the participant; it is not being reopened.

Domain tests execute in Node; browser tests execute against the production static build in local Chromium. JSON logs identify actual checks, not promises. No remaining application requirement is relegated to a roadmap.

| Contract                                              | Implemented evidence                                         | Verification                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Six tasks / two fixed resources / DAG / slots         | domain.ts, task/resource editor                              | domain generated-reference tests; browser six-task analysis      |
| CRUD / duplication / safe reassignment / undo / reset | app.js editor handlers                                       | release-browser; keyboard deletion                               |
| UTC/local inputs / unaligned rejection                | datetime conversion; strict interval validator               | domain time tests; editor error navigation                       |
| Live GB / recorded replay / custom import             | frozen raw + normalized snapshots                            | actual browser Live check; failure + hardening suites            |
| Forecast inspection / download / cache / throttling   | table/chart; explicit refresh; timeout and cooldown          | browser success, 429, malformed response, timeout                |
| Baseline / bounded optimizer / honest statuses        | domain.ts and isolated Worker                                | independent exhaustive reference + 100 seeded cases              |
| Independent schedule and proof checking               | verify and checkCertificate                                  | forged proof/status/unit tests                                   |
| Cancellation / stale result / lifecycle               | terminate + run ID/fingerprint + watchdog                    | real long-search cancellation; forged Worker hardening           |
| Carbon formula / units / equal work                   | objective + per-task table + methodology                     | zero-value, metamorphic, independent arithmetic tests            |
| Start/finish/intensity explanations                   | movement table, constraints and avg active intensity         | visual review and browser workflow                               |
| Deadline counterfactual                               | saved prior scenario; exact editor differences               | browser what-if, infeasible certificate, restored plan           |
| Uniform + nonuniform sensitivity                      | transform; same-series counterfactual evaluation             | domain scaling and browser window scenarios                      |
| Three+ scenarios and settings/source comparison       | comparison with exact changes and restored state             | browser save/import/restore + no unlike-work savings claims      |
| Autosave / local records / backup merge/replace       | IndexedDB transaction and queued writes                      | main + failure suites                                            |
| Bad records / blocked storage / quota / rollback      | recovery isolation and memory mode                           | release + hardening suites                                       |
| Evidence JSON / report / independent reimport         | version + fingerprint + independent verifier                 | browser exports, domain tamper tests                             |
| Offline shell / update / caches / subpaths            | hashed SW cache, update-confirmation/save                    | actual offline reload + update + subpath tests                   |
| Accessible keyboard / mobile / charts                 | semantics, tables, labelled dialog, tab wrapping             | axe + keyboard + 390/640 pixel reflow                            |
| Security / privacy / licenses                         | CSP, limits, escaped text, local-only workflows, MIT + CC BY | dependency audit, injection test, production CSP checks          |
| Cost / release / demo documentation                   | docs, static-only build                                      | dependency audit; bounded workload estimates                     |
| Actual public release                                 | **NOT VERIFIED**                                             | needs authorized hosting account and anonymous public smoke test |

## Remaining release gate

- [x] Application features implemented and locally exercised.
- [x] Required 100 generated correctness cases executed.
- [x] Type checking, syntax/unsafe-evaluation checks, production build.
- [x] Browser, accessibility, offline, recovery and security checks.
- [x] Documentation, versioned static files and source package.
- [ ] Authorized public source repository.
- [ ] Authorized free HTTPS hosting.
- [ ] Actual public-domain CSP/assets/Worker/Live/offline/export/mobile smoke test.
- [ ] Repository + website links entered in the submission (only separately authorized).

A deployment ZIP or local server is not a deployed application. A hosted release is not an entry submission. Never use VERIFIED COMPLETE before the unchecked mandatory release gates pass.

## Audit regression coverage (1.0.1)

- Explicit UTC/local time context, tamper rejection and legacy packet compatibility.
- Cancellation during validation; Worker startup/crash recovery; stale-result rejection.
- Unique saved record IDs and duplicate-ID backup normalization.
- Scenario settings restoration and honest memory-only clearing.
- Cycle certificates, maximum-name handling, bounded transient API retries.
- Empty numerical/time errors, recoverable rendering and focus into closed disclosures.

See contract-results.json and the executed TEST_REPORT.md.
