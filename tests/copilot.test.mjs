import test from "node:test";
import assert from "node:assert/strict";
import { handle, validateDraft } from "../public/_worker.js";
const key = "TEST_ONLY_NOT_A_REAL_PROVIDER_KEY_1234567890";
const draft = {
  schemaVersion: 1,
  id: "draft",
  name: "Test research",
  horizon: 8,
  resources: [{ id: "cpu", name: "CPU" }],
  tasks: [
    {
      id: "a",
      name: "Prepare",
      notes: "ASSUMPTION: electricity",
      resourceId: "cpu",
      duration: 1,
      energyKWh: 0.1,
      release: 0,
      deadline: 8,
      dependsOn: [],
    },
    {
      id: "b",
      name: "Run",
      notes: "ASSUMPTION: electricity",
      resourceId: "cpu",
      duration: 2,
      energyKWh: 0.3,
      release: 0,
      deadline: 8,
      dependsOn: ["a"],
    },
  ],
};
function req(opts = {}) {
  return new Request("https://carbonqueue.pages.dev/api/ai/draft", {
    method: "POST",
    headers: {
      Origin: "https://carbonqueue.pages.dev",
      "Content-Type": "application/json",
      "X-Gemini-Key": key,
      ...opts.headers,
    },
    body: JSON.stringify({
      prompt: "Prepare then run",
      horizon: 8,
      consent: true,
      ...opts.body,
    }),
  });
}
const responseFor = (w = draft, finishReason = "STOP") =>
  new Response(
    JSON.stringify({
      candidates: [
        { finishReason, content: { parts: [{ text: JSON.stringify(w) }] } },
      ],
    }),
  );
test("Gateway health discloses optionality, no secrets", async () => {
  const r = await handle(
    new Request("https://carbonqueue.pages.dev/api/health"),
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).coreRequiresAI, false);
});
test("Cross-origin blocked before any provider call", async () => {
  const r = await handle(
    req({ headers: { Origin: "https://untrusted.example" } }),
    {},
    () => {
      throw Error("should not fetch");
    },
  );
  assert.equal(r.status, 403);
});
test("Missing key, consent, excessive prompt and horizon rejected", async () => {
  for (const opts of [
    { headers: { "X-Gemini-Key": "" } },
    { body: { consent: false } },
    { body: { prompt: "x".repeat(4001) } },
    { body: { horizon: 49 } },
  ])
    assert.equal((await handle(req(opts))).status, 400);
});
test("Wrong method and content type rejected", async () => {
  assert.equal(
    (await handle(new Request("https://carbonqueue.pages.dev/api/ai/draft")))
      .status,
    405,
  );
  assert.equal(
    (await handle(req({ headers: { "Content-Type": "text/plain" } }))).status,
    415,
  );
});
test("Stream size bounded even without Content-Length", async () => {
  assert.equal(
    (await handle(req({ body: { padding: "x".repeat(17000) } }))).status,
    413,
  );
});
test("Valid schema forwarded to fixed provider with header key and no query secret", async () => {
  let captured;
  const r = await handle(req(), {}, async (u, o) => {
    captured = { u, o };
    const long = structuredClone(draft);
    long.tasks[0].notes = "x".repeat(1500);
    return responseFor(long);
  });
  assert.equal(r.status, 200);
  assert(!captured.u.includes(key));
  assert.equal(captured.o.headers["x-goog-api-key"], key);
  const b = JSON.parse(captured.o.body);
  assert.equal(b.generationConfig.maxOutputTokens, 2500);
  assert.equal(b.generationConfig.responseMimeType, "application/json");
  assert(!("tools" in b));
  const text = await r.text();
  assert(!text.includes(key));
  assert(text.includes("confirmation required"));
  const parsed = JSON.parse(text);
  assert(
    parsed.draft.tasks.every(
      (t) => t.notes.length <= 1500 && t.notes.includes("AI-assisted draft:"),
    ),
  );
});
test("Draft validator rejects cycle, bad references, nonfinite, impossible windows, counts", () => {
  assert(validateDraft(draft, 8));
  for (const fn of [
    (w) => (w.tasks[0].dependsOn = ["b"]),
    (w) => (w.tasks[1].resourceId = "missing"),
    (w) => (w.tasks[0].energyKWh = NaN),
    (w) => (w.tasks[0].deadline = 0),
    (w) => w.tasks.push(...Array(5).fill(w.tasks[0])),
    (w) => (w.tasks[0].dependsOn = ["missing"]),
    (w) => (w.horizon = 7),
  ]) {
    const w = structuredClone(draft);
    fn(w);
    assert(!validateDraft(w, 8));
  }
});
test("Provider malformed or invalid draft never applied, secrets never echoed", async () => {
  const w = structuredClone(draft);
  w.tasks[0].duration = 0;
  const r = await handle(
    req({ headers: { "X-Gemini-Key": key + "a" } }),
    {},
    async () => responseFor(w),
  );
  assert.equal(r.status, 502);
  assert(!(await r.text()).includes(key));
});
test("Provider truncation refused", async () => {
  const r = await handle(
    req({ headers: { "X-Gemini-Key": key + "b" } }),
    {},
    async () => responseFor(draft, "MAX_TOKENS"),
  );
  assert.equal(r.status, 502);
});
test("Provider auth/429/500 sanitized, no upstream error leakage", async () => {
  for (const status of [403, 429, 500]) {
    const r = await handle(
      req({ headers: { "X-Gemini-Key": key + status } }),
      {},
      async () => new Response(key, { status }),
    );
    assert.equal(r.status, status === 403 ? 401 : status === 429 ? 429 : 502);
    assert(!(await r.text()).includes(key));
  }
});
test("Provider thrown error sanitized", async () => {
  const r = await handle(
    req({ headers: { "X-Gemini-Key": key + "c" } }),
    {},
    async () => {
      throw Error(key);
    },
  );
  assert.equal(r.status, 502);
  assert(!(await r.text()).includes(key));
});
test("Oversized provider response refused", async () => {
  const r = await handle(
    req({ headers: { "X-Gemini-Key": key + "d" } }),
    {},
    async () => new Response("x".repeat(60001)),
  );
  assert.equal(r.status, 502);
});
test("Gateway best-effort pacing capped at five/minute per key/isolate", async () => {
  const k = key + "rate";
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await handle(req({ headers: { "X-Gemini-Key": k } }), {}, async () =>
          responseFor(),
        )
      ).status,
      200,
    );
  const r = await handle(
    req({ headers: { "X-Gemini-Key": k } }),
    {},
    async () => responseFor(),
  );
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("Retry-After"), "60");
});
test("Non-API delegated to static binding without calling provider", async () => {
  const r = await handle(new Request("https://carbonqueue.pages.dev/"), {
    ASSETS: { fetch: async () => new Response("static") },
  });
  assert.equal(await r.text(), "static");
});

test("Explicit model allowlist and safe diagnostic distinguish provider errors without leaking key", async () => {
  const invalid = await handle(
    req({ body: { model: "https://arbitrary.example/proxy" } }),
    {},
    () => {
      throw Error("must not call");
    },
  );
  assert.equal(invalid.status, 400);
  const k = key + "diagnostics";
  const r = await handle(
    req({
      headers: { "X-Gemini-Key": k },
      body: { model: "gemini-3.1-flash-lite" },
    }),
    {},
    async (url) => {
      assert(url.endsWith("/gemini-3.1-flash-lite:generateContent"));
      return new Response(
        JSON.stringify({
          error: {
            message: "API key not valid " + key,
            status: "INVALID_ARGUMENT",
            details: [{ reason: "API_KEY_INVALID" }],
          },
        }),
        { status: 400 },
      );
    },
  );
  assert.equal(r.status, 401);
  const text = await r.text();
  assert(!text.includes(key));
  const d = JSON.parse(text);
  assert.equal(d.providerCode, "API_KEY_INVALID");
  assert.equal(d.providerStatus, 400);
  const missing = await handle(
    req({
      headers: { "X-Gemini-Key": k + "b" },
      body: { model: "gemini-3.5-flash-lite" },
    }),
    {},
    async () =>
      new Response(
        JSON.stringify({ error: { message: key, status: "NOT_FOUND" } }),
        { status: 404 },
      ),
  );
  assert.equal(missing.status, 502);
  assert(!(await missing.text()).includes(key));
});
