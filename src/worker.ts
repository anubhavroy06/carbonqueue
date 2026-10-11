import { solve } from "./domain.js";
self.onmessage = (e: MessageEvent) => {
  const { runId, fingerprint, workflow, forecast, config } = e.data;
  try {
    const result = solve(workflow, forecast, config, (n) =>
      self.postMessage({ runId, fingerprint, type: "progress", nodes: n }),
    );
    self.postMessage({ runId, fingerprint, type: "result", result });
  } catch (error) {
    self.postMessage({
      runId,
      fingerprint,
      type: "error",
      error: String(error),
    });
  }
};
