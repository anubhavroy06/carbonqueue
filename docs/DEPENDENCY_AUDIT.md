# Zero-mandatory-cost and rights audit

No purchases, billing activation, payment methods, trials, sponsor credits, hosted database, inference API, telemetry, domain registration, premium template or subscription were used. Existing laptop/browser and internet access are assumptions. Free upstream terms can change; this is not an unlimited or indefinite service guarantee.

| Dependency                                      | Role / access                                                | Rights / billing exposure                                                       | Limits / safeguards                                                                                                        | Tested status                                                               |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Native browser APIs / Web Worker / IndexedDB    | local UI, computation, persistence                           | no vendor billing or secret                                                     | 6 tasks, 2 resources, 48 slots; bounded search; 2 MiB imports; 1.8 MB recovery budget                                      | actually tested                                                             |
| NESO Carbon Intensity API                       | keyless GB forecast; documented fw48h, first 48 future slots | currently free; CC BY 4.0; no API resale or replacement/endorsement implication | numeric quota unpublished; one in-flight fetch, fresh snapshot reuse, shared 10s budget, at most two attempts, Retry-After cooldown, no automatic loop | actual HTTP and real browser request; not stress/SLA tested                 |
| Recorded NESO response                          | offline/replay                                               | CC BY attribution preserved; historical forecast, not measurement               | 48 half-hour slots; no freshness claim                                                                                     | raw response and original retrieval metadata retained                       |
| GitHub public repository | reviewed source, tests and documentation                    | public source under MIT; no paid account upgrade or billing added   | reviewed main branch; no paid CI runners/add-ons                                                        | public repository created and anonymously cloned/rebuilt                  |
| Cloudflare Pages static-only (production)      | provider HTTPS subdomain + static upload                     | no Functions/Workers Paid/R2/paid domain                                        | prior same-day documentation: 500 builds/month, 20k files, 25 MiB/asset; static requests free                              | actual Direct Upload production deployed; anonymous UI/header/asset verification passed |
| TypeScript 5.9.3                                | free development compiler                                    | Apache-2.0                                                                      | pinned dev dependency; no runtime vendor call                                                                              | npm installed, type checking run                                            |
| Playwright 1.56.1 / axe Playwright 4.11.0       | free local QA                                                | Apache-2.0 / MPL-2.0; see installed package licenses, axe-core MPL-2.0          | development only; no production browser service                                                                            | suites executed                                                             |
| Prettier 3.6.2                                  | free formatting                                              | MIT                                                                             | development only                                                                                                           | executed                                                                    |
| App code / original CSS/icons                   | authored for this build                                      | MIT; no NESO logo/trademark artwork used                                        | bundle local fonts/assets only                                                                                             | assets loaded/decoded                                                       |

## Bounded review workload

Assumed seven-day review, not indefinite scale: development 30 Live refreshes + API smoke 4 + rehearsals 10 + presentation 2 + judge/public sessions 100 = **146 logical refreshes / normally 146 physical calls**. With every refresh requiring its single bounded retry, the maximum is **292 physical calls**. A 3× case is **438 normal calls / 876 all-retried calls**. Retry delay is 350 ms within a shared ten-second budget; 429 responses do not automatically retry. Automated correctness and fault tests use local/mock data except explicitly labelled live smoke tests. No request occurs for a slider/task edit. Data fetch size is bounded by the provider's response; the normalization chooses at most 48 slots. Raw provenance and import nesting/count are bounded locally.

These are planning counts, not a claimed vendor allowance. Numeric provider rate limits are not published in the inspected terms. A concurrent judge burst may receive 429; its proper behavior is explicit replay/cooldown, not quota circumvention. No paid fallback exists.

With a conservative 2 MiB asset budget: 146 uncached visits = 292 MiB; 3× = 876 MiB. Actual bundle measurement is in tests/performance.json. Suggested 20 deployments / 60 under stress would fit the previously inspected 500-build allowance, and the actual static deployment is now verified; this remains a workload assumption, not a capacity guarantee. There are zero runtime AI tokens, SMS messages or server/database calls.

## Hard no-spend publication configuration

Use an existing authorized free account; free HTTPS provider subdomain only. Do not add a payment method or upgrade. Upload only dist/ static files. Do not enable Functions, Workers Paid, R2, paid Actions runners, Packages or inference services. If provisioning requires payment, stop and use another verified free route. Source/site publication was explicitly authorized. No user backups/workflows belong in that repository.

## Source evidence

Current official API documentation: https://api.carbonintensity.org.uk/ (fw48h explicitly listed and actually called).
Terms: https://github.com/carbon-intensity/terms (raw official README retrieved; fee section states currently free, not a guaranteed perpetual SLA).
GitHub: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits and https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
Cloudflare: https://developers.cloudflare.com/pages/platform/limits/ and https://developers.cloudflare.com/pages/functions/pricing/

See source-ledger.json for current inspection successes and 403 failures, plus research-ledger.json for relevant same-day earlier first-party inspection. Account access and this deployment are now verified. We did not test every new-account signup/card path, and future terms remain unknown.

## Account and production inspection

The participant authorized publication. Authenticated browser fallback created the public GitHub repository and deployed to the existing Cloudflare Pages project after MCP write/upload authorization errors. No payment methods, billing activation, API keys, database, Functions or paid domain were added. Actual hosting access is now verified, not merely inferred from pricing documentation.

Website: https://carbonqueue.pages.dev
Source: https://github.com/anubhavroy06/carbonqueue

This is Direct Upload; no automatic source-to-Pages integration is claimed. Terms/limits can still change; no SLA or unlimited-scale promise.
