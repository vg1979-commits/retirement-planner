/// <reference lib="webworker" />

import { runSimulations, type RunOptions } from "./index";
import type { AppState, SimulationResult } from "../types";

// ─── Wire protocol ────────────────────────────────────────────────────────────

export interface WorkerRunRequest {
  type: "run";
  state: AppState;
  options?: Pick<RunOptions, "numSimulations" | "baseSeed" | "startYear">;
}

export type WorkerOutboundMessage =
  | { type: "progress"; progress: number }
  | { type: "result"; results: SimulationResult[] }
  | { type: "error"; message: string };

// ─── Message handler ──────────────────────────────────────────────────────────

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (e: MessageEvent<WorkerRunRequest>) => {
  const msg = e.data;
  if (msg.type !== "run") return;

  try {
    const results = runSimulations(msg.state, {
      ...msg.options,
      onProgress: (progress) =>
        ctx.postMessage({ type: "progress", progress } satisfies WorkerOutboundMessage),
    });
    ctx.postMessage({ type: "result", results } satisfies WorkerOutboundMessage);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: "error", message } satisfies WorkerOutboundMessage);
  }
});
