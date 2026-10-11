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
- Public deployment was initially withheld pending authorization. After authorization, authenticated browser fallback published source and deployed Pages; anonymous hosted checks now establish the remote gate.
- During restoration, files were reconstructed from exact recorded build commands after environment reset. All claimed current checks were rerun; a downloaded checkpoint preserves work across another reset.

## 1.0.1 contract audit

The initial release summary was not accepted as proof of complete coverage. The deeper audit repaired validation-stage cancellation, explicit evidence time context, duplicate saved IDs, complete settings restoration, memory-only clear semantics, maximum-name evidence, cycle diagnostics, bounded transient retries, blank numerical/time handling and error focus inside disclosures. Fifteen additional browser contract checks and three additional domain groups execute these paths. No test-only synthetic response is claimed as real Live evidence.

All six browser suites and the complete production release runner were rerun after the final patch. Public source and public-origin verification were external gates at the audit checkpoint and are now complete; there is no guaranteed prize claim.

## Production publication

GitHub MCP repository creation and content writes returned 403 even after reconnection. Cloudflare MCP could create the project but its issued upload token was rejected by asset endpoints. Authorized browser interfaces successfully created the public repo, committed reviewed files with preserved paths/binary icons, and deployed 15 static files. No duplicate project or paid service was created.

Anonymous public contexts verified the HTTPS app, security policy, computation, actual Live request, offline reload and recovery; all 12 manifest assets match the build. Shared-browser filesystem separation required asserting download events and inspecting the application's exact Blob for evidence reimport instead of falsely claiming a local saveAs worked. Test captures do not become production features.

## 1.1.0 verified upgrade
Preserve verified 1.0.1 as rollback. Add an OPTIONAL Gemini BYOK structured workflow drafting assistant, not an AI optimizer. Human review and deterministic input validation precede applying any draft; the existing independent schedule verifier remains authoritative. No additional data API/database/voice/blockchain has a justified role. Cloudflare Pages advanced-mode `_worker.js` can ship with dashboard Direct Upload. Route only `/api/*` through Functions; static/offline planner remains independent. Keys are held only in page memory and request headers, never browser storage, exports, URLs or our logs. This is not a guarantee about provider platform logging, deletion, billing, or global rate limiting. Gateway pacing is per isolate; it is not durable abuse protection. Ten explicit attempts/page and five/minute/isolate are safeguards, not payment guarantees.

Actual provider generation required explicit model compatibility handling. Default is now Gemini 3.1 Flash-Lite;2.5/3.5 alternatives are allowlisted, explicitly selected and never automatically retried. Safe provider status/classification helps distinguish quota/key/project/model/schema failures without returning arbitrary upstream bodies. Actual 3.1 generation was human-corrected to preserve independent backup, approved, solved and verified. Key was cleared and original workspace restored. Final source/hosted build identities match; no future feature is needed for the declared release.
