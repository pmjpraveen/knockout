/** `edge` is the longer side in pixels, so portrait and landscape photos end up the same size. */
export type Attempt = { edge: number; quality: number };

/** Renders each attempt in turn, largest first, and returns the first result within `maxChars`. */
export async function firstWithin(attempts: Attempt[], render: (attempt: Attempt) => Promise<string>, maxChars: number) {
  for (const attempt of attempts) {
    const result = await render(attempt);
    if (result.length <= maxChars) return result;
  }
  throw new Error('This image is too detailed to store.');
}
