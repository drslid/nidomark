import { EXAMPLE_CATEGORIES, EXAMPLE_SCALES, EXAMPLE_VECTORS } from './data/example-vectors';
import { MODEL_DIMS } from './model';

export interface LabeledVector {
  category: string;
  vector: Float32Array;
}

let cache: LabeledVector[] | null = null;

/** Vectors of the typical bookmarks of each category, computed in advance with the same model. */
export function exampleVectors(): LabeledVector[] {
  if (cache) return cache;
  const raw = Uint8Array.from(atob(EXAMPLE_VECTORS), (ch) => ch.charCodeAt(0));
  cache = EXAMPLE_CATEGORIES.map((category, i) => {
    const v = new Float32Array(MODEL_DIMS);
    const scale = EXAMPLE_SCALES[i] as number;
    let norm = 0;
    for (let k = 0; k < MODEL_DIMS; k++) {
      const q = (raw[i * MODEL_DIMS + k] as number) << 24 >> 24;
      v[k] = (q / 127) * scale;
      norm += (v[k] as number) ** 2;
    }
    norm = Math.sqrt(norm) || 1;
    for (let k = 0; k < MODEL_DIMS; k++) v[k] = (v[k] as number) / norm;
    return { category, vector: v };
  });
  return cache;
}
