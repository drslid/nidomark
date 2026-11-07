/** The packaged embedding model (see scripts/fetch-model.mjs). */
export const MODEL_ID = 'Xenova/multilingual-e5-small';
export const MODEL_REVISION = '761b726';
export const MODEL_DIMS = 384;

/** Text actually given to the model: multilingual-e5 expects "query: " for symmetric tasks such as clustering (model card). */
export function modelInput(text: string): string {
  return `query: ${text.slice(0, 400)}`;
}
