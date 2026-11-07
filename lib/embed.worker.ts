/// <reference lib="webworker" />
// Runs the embedding model off the main thread. Everything is packaged: no network access.
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { MODEL_DIMS, MODEL_ID, modelInput } from './model';

env.allowRemoteModels = false;
env.allowLocalModels = true;
// Must be origin-relative: an absolute URL makes Transformers.js skip local files (checked with 4.3.2).
env.localModelPath = '/models/';
env.useBrowserCache = false;
env.useWasmCache = false;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/ort/';
  env.backends.onnx.wasm.numThreads = 1;
}

export type WorkerRequest = { type: 'embed'; id: number; texts: string[] };
export type WorkerResponse =
  | { type: 'loaded'; id: number; ms: number }
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'result'; id: number; vectors: Float32Array }
  | { type: 'error'; id: number; message: string };

declare const self: DedicatedWorkerGlobalScope;
let extractor: Promise<FeatureExtractionPipeline> | null = null;

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const { id, texts } = ev.data;
  try {
    if (!extractor) {
      const t0 = performance.now();
      extractor = pipeline('feature-extraction', MODEL_ID, { dtype: 'q8', device: 'wasm' }) as Promise<FeatureExtractionPipeline>;
      await extractor;
      post({ type: 'loaded', id, ms: Math.round(performance.now() - t0) });
    }
    const ext = await extractor;
    const out = new Float32Array(texts.length * MODEL_DIMS);
    for (let i = 0; i < texts.length; i++) {
      const tensor = await ext(modelInput(texts[i] ?? ''), { pooling: 'mean', normalize: true });
      out.set(tensor.data as Float32Array, i * MODEL_DIMS);
      if (i % 8 === 7 || i === texts.length - 1) post({ type: 'progress', id, done: i + 1, total: texts.length });
    }
    post({ type: 'result', id, vectors: out }, [out.buffer]);
  } catch (e) {
    post({ type: 'error', id, message: e instanceof Error ? e.message : String(e) });
  }
};
