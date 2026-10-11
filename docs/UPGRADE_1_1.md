# CarbonQueue 1.1.0 — optional workflow copilot

Status: IMPLEMENTED — VERIFICATION INCOMPLETE. Current local and hosted checks passed; successful actual Gemini model/key generation is the remaining integration check. Mocked responses do not satisfy it.

## New shipped scope
- Plain-language brief → Gemini structured task/resource inputs → editable JSON review → explicit approval → normal editor → real solver and verifier.
- Separate Cloudflare Pages advanced-mode backend for `/api/health` and `/api/ai/draft` only. Fixed `gemini-2.5-flash-lite:generateContent`, no tools/search/arbitrary proxy URLs. No database or stored secrets.
- Session-memory BYOK, password input, forget action, clearing on page exit/reload, no local storage/export/URL/log key. Prompt text stays in the copilot UI until explicitly submitted; draft is only persisted as a workflow if approved.
- Explicit privacy/free-project consent, request cancel/timeout, no automatic retries, 10 attempts per page session, 15-second pacing. Backend validates origin/content/body/schema, bounds tokens, sanitizes provider failures, and applies best-effort five requests/minute per hashed key per isolate. This is not durable/global abuse or cost enforcement. Origin checks are not authentication; a non-browser client can forge Origin. No shared server API key is exposed to exploit.
- Clear 3-step review/verify UI, preserved local/offline planning, responsive and accessible form. No ornamental APIs, sponsor badge or unsupported AI correctness claims.

## Cost and privacy
Account dashboard inspected 2026-10-11: Workers Free is Current plan ($0), 100,000 requests/day and 10 ms CPU/request. No plan changes. Only `/api/*` consumes Functions; static core requests do not. Free quotas are shared with other account Workers/Functions.

The Gemini pricing page lists 2.5 Flash-Lite text input/output free; free-tier data can be used to improve products. CarbonQueue cannot check a key's billing status, quotas, region or approval. Paid-project keys can incur provider charges. The user must confirm a free-tier project; the app cannot enforce this provider-side. No billing activation, payment method, purchase, automatic paid fallback, trial or expiring credit is used by our release. Google and Cloudflare can process requests under their own policies; our code does not log/persist keys, prompts or responses server-side. Do not send proprietary data. Inferred durations/electricity remain explicitly unmetered assumptions.

Assumed bounded review: 100 optional users × at most 3 explicit drafts = 300 requests; development/smoke/rehearsals at most 50 = 350, 3× stress = 1,050. Configured output ceiling 2,500 tokens per request, so 875,000 maximum configured output tokens, stress 2,625,000. Prompt max 4,000 characters; input tokens depend on tokenization plus fixed instruction/schema, not a promised exact token quota. User keys have their own limits; no request is guaranteed. Keep the planner usable if the optional API is unavailable. No promise of indefinite unlimited operation.

## Official sources inspected Oct 11, 2026
- https://ai.google.dev/gemini-api/docs/pricing — model/free tier/data use; documentation, not account-specific permission.
- https://ai.google.dev/gemini-api/docs/api-key — never publish keys, backend proxy security guidance.
- https://ai.google.dev/api/generate-content — JSON MIME/schema generation contract; actual successful authenticated model call pending.
- https://ai.google.dev/gemini-api/docs/structured-output — structured generation still requires semantic validation.
- https://developers.cloudflare.com/pages/get-started/direct-upload/ — dashboard ZIP upload supports `_worker.js`.
- https://developers.cloudflare.com/pages/functions/advanced-mode/ — standalone module Worker and ASSETS binding.
- https://developers.cloudflare.com/pages/functions/pricing/ — static vs Functions pricing/quota.

## Rollback and release integrity
Preserve v1.0.1 source tag/release and Cloudflare deployment 1061000e-4271-48b5-b917-07adf44a5380. Do not delete the verified release. Build manifest separately hashes cached frontend assets and server files. `_worker.js`, `_routes.json` and `_headers` are not precached by the offline service worker. API requests are never intercepted as fresh/cached AI results. Direct Upload is manual; GitHub pushes do not redeploy automatically.

## Validation
See current TEST_REPORT and executed `tests/copilot.test.mjs` / `tests/copilot-browser.mjs`. Fake keys are explicitly TEST_ONLY and only sent to mocked unit/browser provider handlers; no fake key is represented as real model access. Optional Gemini award claims must wait for a successful actual provider call and event-track confirmation.
