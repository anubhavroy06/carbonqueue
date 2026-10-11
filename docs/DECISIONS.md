# Implementation decisions

- Complete planning product, not an autonomous execution platform. No account/AI/database/cloud scheduler was added merely to look enterprise-ready.
- Native DOM + TypeScript domain modules: fewer dependencies, no runtime CDN, static local-first architecture. React was recommended, not compulsory; the smaller stack meets the actual contract.
- Six tasks / two resources / 48 half-hour slots. Search remains bounded instead of pretending exponential optimization is always fast. A verified incumbent survives a timeout.
- Independent schedule arithmetic and independent structural proof checks; no LLM-generated correctness claim.
- Live uses the documented 48-hour endpoint and keeps the first 48 future intervals, so one partial current interval does not remove the requested full 24-hour future horizon. Original response is retained. Replay uses a real response retrieved earlier the same day; example energies are synthetic.
- Immutable snapshots and run IDs; Worker termination on edits/cancellation; old messages cannot replace current state. Watchdog failure is not infeasibility.
- Source hashes establish identity, not authenticity. Imported schedules are independently rechecked and imported optimality is downgraded.
- Explicit solver/model limitations, not missing-feature excuses. No separate-resource electricity regions, cloud execution or certified carbon accounting exist in the declared product scope.
- Persistence is browser-local and fallible. Failed saves visibly switch to memory mode; export backup is the recovery path. No cross-device sync is implied.
- Service Worker only caches app assets; remote forecasts never become silently fresh Live data. Safe update waits for persistence and confirmation.
- Security headers are available for Cloudflare/preview; GitHub Pages cannot be made to support arbitrary response headers. Meta CSP does not substitute for frame-ancestors headers; document actual hosted policy when deployed.
- Public deployment is withheld until authorization/account access is supplied. Local successful tests cannot establish the remote release gate.
- During restoration, files were reconstructed from exact recorded build commands after environment reset. All claimed current checks were rerun; a downloaded checkpoint preserves work across another reset.

## 1.0.1 contract audit

The initial release summary was not accepted as proof of complete coverage. The deeper audit repaired validation-stage cancellation, explicit evidence time context, duplicate saved IDs, complete settings restoration, memory-only clear semantics, maximum-name evidence, cycle diagnostics, bounded transient retries, blank numerical/time handling and error focus inside disclosures. Fifteen additional browser contract checks and three additional domain groups execute these paths. No test-only synthetic response is claimed as real Live evidence.

All six browser suites and the complete production release runner were rerun after the final patch. Public source and public-origin verification are still external gates; there is no guaranteed prize claim.
