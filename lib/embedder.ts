import EmbedWorker from './embed.worker?worker';
import type { WorkerRequest, WorkerResponse } from './embed.worker';
import { getVectors, hashText, putVectors } from './idb';
import { MODEL_DIMS, MODEL_ID, MODEL_REVISION } from './model';

export interface EmbedProgress {
  phase: 'loading' | 'embedding';
  done: number;
  total: number;
}

/** Computes embeddings in a dedicated worker, with a persistent cache; terminate it to release memory. */
export class Embedder {
  private worker: Worker | null = null;
  private seq = 0;
  /** Requests in flight, settled with an error when the worker is stopped. */
  private pending = new Set<(e: Error) => void>();
  /** Closed for good: a later request fails instead of starting the model again. */
  private closed = false;

  async embed(texts: string[], onProgress?: (p: EmbedProgress) => void): Promise<Float32Array[]> {
    const keys = texts.map((t) => `${MODEL_ID}@${MODEL_REVISION}|${hashText(t)}`);
    const cached = await getVectors(keys);
    const missing = texts.map((_, i) => i).filter((i) => !cached[i]);
    if (missing.length) {
      const vectors = await this.run(missing.map((i) => texts[i] as string), onProgress);
      const entries: [string, Float32Array][] = [];
      missing.forEach((i, n) => {
        const v = vectors.slice(n * MODEL_DIMS, (n + 1) * MODEL_DIMS);
        cached[i] = v;
        entries.push([keys[i] as string, v]);
      });
      await putVectors(entries);
    }
    onProgress?.({ phase: 'embedding', done: texts.length, total: texts.length });
    return cached as Float32Array[];
  }

  private run(texts: string[], onProgress?: (p: EmbedProgress) => void): Promise<Float32Array> {
    if (this.closed) return Promise.reject(new DOMException('Stopped', 'AbortError'));
    this.worker ??= new EmbedWorker();
    const worker = this.worker;
    const id = ++this.seq;
    onProgress?.({ phase: 'loading', done: 0, total: texts.length });
    return new Promise((resolve, reject) => {
      const done = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        this.pending.delete(fail);
      };
      const fail = (e: Error) => {
        done();
        reject(e);
      };
      const onMessage = (ev: MessageEvent<WorkerResponse>) => {
        const msg = ev.data;
        if (msg.id !== id) return;
        if (msg.type === 'progress') onProgress?.({ phase: 'embedding', done: msg.done, total: msg.total });
        else if (msg.type === 'loaded') onProgress?.({ phase: 'embedding', done: 0, total: texts.length });
        else {
          done();
          if (msg.type === 'result') resolve(msg.vectors);
          else reject(new Error(msg.message));
        }
      };
      const onError = (ev: ErrorEvent) => fail(new Error(ev.message || 'Worker error'));
      this.pending.add(fail);
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ type: 'embed', id, texts } satisfies WorkerRequest);
    });
  }

  /** Stops the worker for good: for a one-off task that may be cancelled. */
  close(): void {
    this.closed = true;
    this.dispose();
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const fail of [...this.pending]) fail(new DOMException('Stopped', 'AbortError'));
  }
}
