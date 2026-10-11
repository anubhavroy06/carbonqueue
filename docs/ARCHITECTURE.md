# Architecture and contracts

`src/domain.ts`: strict TypeScript models, validation, DAG order, baseline, cost,
bounded search, verifier, certificates, canonical serialization and fingerprint.
`src/worker.ts`: isolated solver, progress/result/error envelopes with run ID/hash.
`public/app.js`: native DOM interface and analysis lifecycle; all user strings
escaped before templates; network/source URLs allow HTTP(S) only when linked.
`public/storage.js`: IndexedDB workspace stored in one transaction; backup restore
validates every record before changing persistence or in-memory state.
`public/sw.js`: same-origin app-shell cache; never intercepts external API.
`build.mjs`: source asset hashes produce a new SW cache version after asset changes.
`server.mjs`: local static preview with security headers; not a production backend.

## Algorithm

Topologically visit tasks but independently consider all allowed starts; unrelated
jobs may be placed earlier. Prune resource/window/precedence violations. The sum
of each remaining task's minimum unconstrained window cost is an admissible lower
bound. A verified baseline is an incumbent. Equal-cost ties prefer earlier finish
then a deterministic task/start key. Worst-case exponential H^n; default limits
150,000 nodes / 2,000 ms. There is no reported global optimality gap.

An independent verifier reconstructs constraints and objective from inputs and
assignments. The test-only reference separately enumerates Cartesian starts with
separate feasibility/objective code. Certificates cover duration windows, DAG
longest-path earliest finish (not summed parallel ancestors), and jobs fully
confined to an overloaded resource window. A verifier rechecks certificates.

## Timing and provenance

Slots = contiguous UTC-aligned half hours. A task duration counts slots, not hours.
Energy = whole-task kWh. Emissions = E/d \* sum(slot gCO2/kWh). Source raw response
and normalized intervals are kept. Live strips elapsed intervals without silently
changing workflow limits. New Live origin is explicitly announced; relative slot
constraints belong to that selected origin. Local date controls convert to UTC,
reject unaligned values, and never round silently.

Editing invalidates/cancels active analysis. Each run freezes inputs, settings,
source and ID/hash; stale envelopes are ignored. Worker termination actually stops
long CPU loops. Imported records never establish optimality from stored flags.

## Versioned JSON contracts

Workflow: schemaVersion=1,id,name,horizon,resources[{id,name}],tasks[{id,name,notes,
resourceId,duration,energyKWh,release,deadline,dependsOn[]}].
Forecast: schemaVersion=1,id,name,mode(LIVE/REPLAY/CUSTOM),kind(forecast/measurement/
synthetic),geography,units(gCO2/kWh),sourceUrl,license,retrievedAt,raw,slots[{from,to,value}].
Evidence: schemaVersion=1,appVersion=1.0.1,id,name,createdAt,runId,fingerprint,workflow,
forecast,result,assumptions[]. Result contains status,schedule,baseline,verification,
baselineVerification,certificate,nodes,elapsedMs,config(maxNodes,maxMs).
Backup: schemaVersion=1,workflow,forecast,saved[],datasets[],scenarios[]. Use actual
app exports as exact templates. Unsupported versions are rejected rather than
silently migrated. Limits: 30 workflows, 20 snapshots, 30 scenarios; files 2 MiB.

Security: no user code execution, no analytics or credentials. Imported content
is untrusted. CSP protects static application resources; host response headers
are needed for frame-ancestors. SHA-256 fingerprints identify input content only.

## Audited 1.0.1 evidence and lifecycle

Versioned TypeScript aliases explicitly name ForecastInterval, ForecastSnapshot, SolverConfiguration, ScheduleAssignment, VerificationResult, ExplanationCertificate, AnalysisResult, Scenario, WorkspaceBackup and EvidencePacket. Evidence includes an independently recomputed TimeContext: UTC origin, 30-minute units, frozen IANA display zone, release/deadline UTC and local labels, and scheduled start/finish UTC. Version 1.0.0 imports remain compatible but derive UTC conversion metadata with legacyDerived=true; the original local zone is not asserted. Forged conversion metadata, settings and invalid statistics are rejected.

Cancellation also invalidates asynchronous fingerprint validation before a Worker can start. Repeated record saves use unique IDs; replacement backups resolve duplicate IDs transactionally. Scenario restoration restores solver settings. Blank numerical/time fields produce recoverable field errors rather than coercion to zero or rendering crashes. Error navigation opens closed disclosures before focusing their controls.

Live refresh allows at most two physical attempts in one shared ten-second budget (one bounded retry for a transient failure). A 429 instead establishes Retry-After cooldown without automatic retry.
