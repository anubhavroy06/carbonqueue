# Judge package and submission materials

## 30-second explanation

“Carbon-aware scheduling already exists. CarbonQueue makes the constraints understandable: enter dependent tasks, get an independently checked schedule, see what moved and why, and get a checkable contradiction when a deadline is impossible. It runs locally, saves reproducible evidence, and works offline without paid AI.”

## 60-second live demonstration

- 0–10s: load guided example and show REPLAY, source timestamp, GB scope, synthetic task energy, two resources.
- 10–25s: analyze; show solver status, valid baseline/candidate, same electricity, moved starts/finishes and active intensity windows.
- 25–40s: use Demo impossible chain. Show precedence longest-path lower bound and independently rechecked certificate. Do not sum parallel ancestors.
- 40–50s: restore feasible example. Recompute, save scenario and inspect exact constraint differences; a verified counterfactual is sufficient only for that change.
- 50–60s: disconnect/reload and export evidence from a new real computation. If already offline, say so rather than pretending a Live fetch.

## Two-minute video script

0–10s: “This is our CodeRED: Orion demo.” State participant/team names accurately.
10–30s: actual target user, task/resource/DAG inputs and data/source/energy assumptions.
30–55s: valid baseline vs candidate, per-task movement, zero constraint violations, modeled—not measured—footprint.
55–80s: impossible deadline, certificate, corrected deadline and recomputation.
80–100s: nonuniform stress, saved scenario comparison, no unlike-work savings claim.
100–115s: actual offline reload and evidence export/import recheck.
115–120s: limitations, technical centerpiece, public source/site links **only once real**.

A longer demo may inspect interval tables, workspaces, backup import/rollback and bounded cancellation. Video requirement/applicability and presentation rules should follow event-specific instructions; a precautionary two-minute video is not proof of generic MLH-rule applicability.

## Judge-evidence matrix

| Criterion       | Shipped evidence                                                                                | Limitation                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Originality     | transparent constraint/what-if UX, independent proof checks, reproducible local evidence        | carbon DAG scheduling and its mathematics are established prior art |
| Track relevance | central workflow shifts flexible GB computation under a carbon-intensity model                  | planning, not dispatch or environmental certification               |
| Impact          | defined research/data team, actionable schedule/deadline trade-off, offline privacy             | no customer interviews/adoption or measured avoided emissions       |
| Demo            | edit → real computation → contradiction → verified counterfactual → offline export              | public HTTPS and offline/Live/export checks passed       |
| Implementation  | solver/verifier/Worker race guards, persistence rollback, offline updates, tested failure paths | finite bounded model; no global optimality on timeout               |

Target Best Overall, Best Pitch/Demo and Best Environment conditionally. Eligibility is participant-confirmed. Do not assume award stacking, cash payout availability or official criterion weights. The optional Gemini workflow drafting integration is implemented but actual 3.1 Flash-Lite generation and approved-draft scheduling passed. Demonstrate the real draft/review/verification path; event-specific Gemini entry eligibility must still be checked. No dummy sponsor badges or unrelated APIs are added.

## Ten defensible answers

1. **Is scheduling new?** No. Carbon Aware SDK/CaWoSched are prior art. Differentiate this diagnostic/evidence workflow, not first-ever mathematics.
2. **Is AI required?** No. Hard constraints need deterministic verification, not fluent guesses. Optional Gemini drafts task inputs only, with explicit human approval. AI coding assistance is disclosed.
3. **Are these measured savings?** No. Same energy and forecast-average intensity produce a modeled difference, not marginal avoided emissions.
4. **Why GB?** Live NESO coverage is GB. Controller residence differs from compute location; no unsupported country substitution.
5. **Is the plan optimal?** Only when discrete search exhausts. Otherwise verified best-found or unknown.
6. **What proves validity?** Independent task/resource/precedence/window/arithmetic checks; small exact tests use a separate reference.
7. **What if data fails?** Explicit replay, visible timestamps, bounded timeout/cooldown. Never silently turn an old response into Live.
8. **Is infeasibility always explained?** Only sound certificates or exhausted finite search support that status; timeout never does.
9. **Is it zero cost?** Local compute, keyless currently-free API, static deployment path; no mandatory inference, paid domain/database. Optional Gemini tokens require a user-confirmed free-project key; paid-project charges cannot be prevented by CarbonQueue. Existing equipment/network and hosting account access are assumptions.
10. **What does completion mean?** The declared planner features are implemented. Remote release verification is documented in TEST_REPORT.md; it does not prove a submitted hackathon entry.

## Submission description (truthful template)

CarbonQueue is a local-first workflow planner that makes flexible-compute timing constraints visible. Define up to six non-preemptive tasks on two fixed resources, load real GB forecast data or attributed replay, and compare an independently verified carbon-aware schedule with a valid earliest-start baseline. Tighten a deadline to see a checkable structural contradiction, inspect counterfactual/sensitivity scenarios, and export a reproducible evidence packet. Core solving and local backup/recovery run in the browser, including offline. Optional Gemini input drafting uses a bounded Cloudflare proxy with a session-only user key; human review is mandatory and no model result is trusted as a schedule or certificate. Its technical core is bounded discrete search plus separate schedule/proof verification—not a mandatory LLM. Footprints use assumed kWh and average forecast gCO2/kWh; no measured avoided-emission or optimality-on-timeout claim is made. AI assistance was used for code, tests and documentation; the participant must understand and accurately disclose the tools actually used.

## Submission checklist

- [x] Real public source URL (code built within permitted hacking period; private backups excluded).
- [x] Real public HTTPS application, anonymously tested.
- [ ] Event-specific video/live-demo requirement met; source/video public for required period.
- [ ] Actual contributor names and AI-tool disclosure.
- [ ] Required track-specific entry fields and award/stacking rules checked.
- [ ] Submission made only with separate participant authorization; confirmation saved.
- [ ] No public file/API secrets, fake customers/results or unsupported environmental claims.

## Optional copilot demo (only after an actual provider call is verified)
Describe a nonprivate workflow with explicit illustrative kWh → generate one draft with a free-project key → review every assumption and edit → approve replacement → analyze with the real solver/verifier → forget key. If no real provider success was tested, demonstrate the core planner and label copilot success tests mocked rather than faking a live call.
