// Shared by the server (enforcement) and the app (counter and input guard).
export const MAX_TEXT_BYTES = 100 * 1024;

export function textBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
