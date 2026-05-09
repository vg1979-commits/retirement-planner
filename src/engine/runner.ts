import type { AppState, SimulationResult } from "../types";
import { runSimulations, type RunOptions } from "./index";
import type { WorkerOutboundMessage, WorkerRunRequest } from "./worker";

// ─── Public surface ───────────────────────────────────────────────────────────

export interface RunHandle {
  /** Resolves with results (or rejects on error). */
  promise: Promise<SimulationResult[]>;
  /** Cancel an in-flight run. Resolves the promise with whatever has been collected (currently always rejects with "cancelled"). */
  cancel: () => void;
}

export interface RunRequest {
  state: AppState;
  options?: Pick<RunOptions, "numSimulations" | "baseSeed" | "startYear">;
  onProgress?: (progress: number) => void;
}

// ─── Worker-backed runner ────────────────────────────────────────────────────

function isWorkerSupported(): boolean {
  return typeof Worker !== "undefined";
}

function runInWorker(req: RunRequest): RunHandle {
  // Vite-specific worker import. The `?worker` suffix tells Vite to bundle
  // worker.ts as a separate chunk and expose a constructor.
  // The `import.meta.url` form is the modern, build-tool-agnostic pattern.
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

  let cancelled = false;

  const promise = new Promise<SimulationResult[]>((resolve, reject) => {
    worker.addEventListener("message", (e: MessageEvent<WorkerOutboundMessage>) => {
      if (cancelled) return;
      const msg = e.data;
      switch (msg.type) {
        case "progress":
          req.onProgress?.(msg.progress);
          break;
        case "result":
          resolve(msg.results);
          worker.terminate();
          break;
        case "error":
          reject(new Error(msg.message));
          worker.terminate();
          break;
      }
    });
    worker.addEventListener("error", (e) => {
      if (cancelled) return;
      reject(new Error(e.message || "Worker error"));
      worker.terminate();
    });

    const request: WorkerRunRequest = {
      type: "run",
      state: req.state,
      options: req.options,
    };
    worker.postMessage(request);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      worker.terminate();
    },
  };
}

// ─── Synchronous fallback (Node tests, no-Worker environments) ───────────────

function runSynchronously(req: RunRequest): RunHandle {
  let cancelled = false;
  const promise = new Promise<SimulationResult[]>((resolve, reject) => {
    // Defer to next tick so callers can attach .then before work runs
    queueMicrotask(() => {
      if (cancelled) {
        reject(new Error("cancelled"));
        return;
      }
      try {
        const results = runSimulations(req.state, {
          ...req.options,
          onProgress: req.onProgress,
        });
        if (cancelled) reject(new Error("cancelled"));
        else resolve(results);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });

  return { promise, cancel: () => { cancelled = true; } };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function runSimulationsAsync(req: RunRequest): RunHandle {
  return isWorkerSupported() ? runInWorker(req) : runSynchronously(req);
}
