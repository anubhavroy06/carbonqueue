import { validateWorkflow } from "./domain.js";
export function mountCopilot(host, getContext, apply) {
  let key = "",
    draft = null,
    context = null,
    controller = null,
    attempts = 0,
    lastCall = 0;
  host.innerHTML = `<section class="copilot-panel" aria-labelledby="copilot-title"><div class="copilot-lead"><span class="eyebrow">OPTIONAL GEMINI COPILOT / YOUR KEY. YOUR CHOICE.</span><h2 id="copilot-title">Describe the work.<br><em>Verify the decision.</em></h2><p>Turn a plain-language brief into editable jobs and dependencies. AI drafts the inputs; CarbonQueue proves whether a returned schedule satisfies the constraints.</p><div class="journey"><span><b>01</b> Describe</span><span><b>02</b> Review assumptions</span><span><b>03</b> Solve & verify</span></div><p class="caption">No key? The complete local planner below needs none. No paid AI or account required for core functionality.</p></div><div class="copilot-form"><details id="copilot-details"><summary>Open workflow copilot</summary><label for="gemini-key">Gemini API key · session only</label><div class="key-row"><input id="gemini-key" type="password" autocomplete="off" spellcheck="false" maxlength="200" placeholder="Enter your own Gemini API key"><button id="forget-key" type="button">Forget key</button></div><label for="ai-model">Gemini text model · explicit choice, no automatic fallback</label><select id="ai-model"><option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option><option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option><option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option></select><label for="ai-prompt">Describe jobs, dependencies, durations and deadlines</label><textarea id="ai-prompt" rows="4" maxlength="4000" placeholder="Prepare data, run a two-hour experiment after preparation, and generate a report. Use one compute resource. Include known whole-task kWh if available."></textarea><p class="caption">Do not include secrets or proprietary data. The description and key pass through Cloudflare to Google; our code does not store or log them. Google’s free tier may use inputs to improve products. Cloudflare/Google process requests under their own policies.</p><label class="consent"><input id="ai-consent" type="checkbox"> I authorize sending this description to Gemini and confirm I am using a free-tier project. I understand paid-project keys can incur charges and AI estimates need review.</label><div class="actions"><button id="generate-draft" class="primary" type="button">Generate reviewable draft ↗</button><button id="cancel-draft" type="button">Cancel request</button><button id="use-ai-example" type="button">Use example description</button></div><p id="copilot-status" role="status" aria-live="polite">Explicit requests only · maximum 10 attempts per page session · 15-second pacing · no automatic retries.</p><div id="ai-review" hidden><h3>Review before replacing your workflow</h3><p class="warning">AI-assisted, unverified input. Confirm all durations, energy estimates, deadlines and dependencies. This draft has not been scheduled. All values remain editable in the planner after approval.</p><label for="ai-draft-json">Editable draft JSON</label><textarea id="ai-draft-json" rows="12" spellcheck="false"></textarea><p id="ai-draft-summary" class="caption"></p><label class="consent"><input id="ai-review-consent" type="checkbox"> I reviewed the values and want to replace the current workflow (Undo remains available).</label><button id="apply-ai-draft" type="button">Apply reviewed draft to planner</button></div><p class="caption"><a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener noreferrer">Gemini pricing & data use</a> · <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Manage your key</a>. CarbonQueue cannot inspect or guarantee your provider billing configuration. Never use a shared key or commit it to source.</p></details></div></section>`;
  const q = (s) => host.querySelector(s),
    status = (text) => {
      q("#copilot-status").textContent = text;
    };
  q("#gemini-key").addEventListener("input", (e) => {
    key = e.target.value.trim();
  });
  q("#forget-key").addEventListener("click", () => {
    controller?.abort();
    key = "";
    q("#gemini-key").value = "";
    status("Key forgotten. No key was saved to local storage.");
  });
  q("#cancel-draft").addEventListener("click", () => {
    if (controller) {
      controller.abort();
      status(
        "Request cancelled. No draft applied. Provider may already have processed the request.",
      );
    } else status("No active provider request.");
  });
  q("#use-ai-example").addEventListener("click", () => {
    q("#ai-prompt").value =
      "Prepare data for 30 minutes (0.10 kWh), run a 2-hour experiment after preparation (0.8 kWh), then produce a 30-minute report (0.05 kWh). Back up artifacts independently for 30 minutes (0.02 kWh). Use one CPU resource. All jobs must finish inside the selected horizon. These are illustrative energy assumptions, not measurements.";
    q("#ai-prompt").focus();
  });
  q("#generate-draft").addEventListener("click", async () => {
    if (controller)
      return status(
        "A request is already running. Cancel it before starting another.",
      );
    if (!navigator.onLine)
      return status(
        "Offline: use the local editor and recorded replay. Gemini requires a connection.",
      );
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(key))
      return status("Enter your own valid Gemini key in the password field.");
    if (!q("#ai-consent").checked)
      return status(
        "Confirm privacy and free-project consent before making a provider request.",
      );
    const prompt = q("#ai-prompt").value.trim();
    if (!prompt || prompt.length > 4000)
      return status("Enter a description between 1 and 4,000 characters.");
    if (attempts >= 10)
      return status(
        "Session attempt limit reached. Use the local editor; no automatic extra calls.",
      );
    if (Date.now() - lastCall < 15000)
      return status("Wait 15 seconds between attempts to protect your quota.");
    context = getContext();
    const requestedContext = JSON.stringify(context);
    attempts++;
    lastCall = Date.now();
    const own = new AbortController();
    controller = own;
    const timer = setTimeout(() => own.abort(), 25000);
    q("#generate-draft").disabled = true;
    status("Drafting inputs with Gemini… No scheduling or execution occurs.");
    try {
      const response = await fetch(new URL("./api/ai/draft", location.href), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gemini-Key": key },
        body: JSON.stringify({
          prompt,
          horizon: context.horizon,
          model: q("#ai-model").value,
          consent: true,
        }),
        signal: own.signal,
        cache: "no-store",
        credentials: "omit",
      });
      const text = await response.text();
      if (text.length > 60000) throw Error("Oversized gateway response.");
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw Error("AI gateway unavailable. The local planner still works.");
      }
      if (!response.ok)
        throw Error(
          typeof data.error === "string"
            ? data.error
            : "Provider request rejected.",
        );
      if (requestedContext !== JSON.stringify(getContext()))
        throw Error(
          "Dataset or horizon changed while drafting. Nothing was applied; request a new draft.",
        );
      const errors = validateWorkflow(data.draft);
      if (errors.length || data.draft.horizon !== context.horizon)
        throw Error("Draft failed local validation. Nothing was applied.");
      draft = data.draft;
      q("#ai-draft-json").value = JSON.stringify(draft, null, 2);
      q("#ai-review-consent").checked = false;
      q("#ai-review").hidden = false;
      q("#ai-draft-summary").textContent =
        `${draft.tasks.length} tasks · ${draft.resources.length} resources · ${draft.horizon} half-hour slots · ${data.model}. Independent input validation passed; schedule still uncomputed.`;
      status("Draft ready. Review every assumption and approve explicitly.");
      q("#ai-draft-json").focus();
    } catch (e) {
      status(
        own.signal.aborted
          ? "Request cancelled or timed out. No draft applied. Provider may already have processed the request."
          : e.message,
      );
    } finally {
      clearTimeout(timer);
      if (controller === own) controller = null;
      q("#generate-draft").disabled = false;
    }
  });
  q("#apply-ai-draft").addEventListener("click", async () => {
    if (!q("#ai-review-consent").checked)
      return status("Review the draft and check approval before applying.");
    try {
      if (JSON.stringify(context) !== JSON.stringify(getContext()))
        throw Error(
          "Dataset or horizon changed. Request a new draft for this context.",
        );
      const text = q("#ai-draft-json").value;
      if (text.length > 20000) throw Error("Draft is too large.");
      const w = JSON.parse(text),
        errors = validateWorkflow(w);
      if (errors.length || w.horizon !== context.horizon)
        throw Error(
          "Draft rejected: " + (errors.join(" ") || "horizon changed."),
        );
      for (const t of w.tasks)
        if (!t.notes.includes("AI-assisted draft:"))
          t.notes =
            t.notes.slice(0, 1200) +
            "\nAI-assisted draft: human-reviewed input; electricity is not metered.";
      if (await apply(w)) {
        draft = null;
        q("#ai-review").hidden = true;
        status(
          "Reviewed draft applied. Edit values below, then analyze for an independently verified plan.",
        );
      }
    } catch (e) {
      status(e.message);
    }
  });
  addEventListener("pagehide", () => {
    controller?.abort();
    key = "";
    q("#gemini-key").value = "";
  });
}
