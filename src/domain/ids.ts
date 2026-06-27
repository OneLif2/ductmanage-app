// Identifier helpers.

function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

/** Short, stable per-device id (persisted on the device in the real app). */
export function newDeviceId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Clamp a normalised coordinate to [0,1] and scale to a 4-digit integer 0000–9999. */
function norm4(v: number): string {
  return pad(Math.round(Math.min(Math.max(v, 0), 1) * 9999), 4);
}

/**
 * Human-readable, position-embedded, time-stamped tag id.
 * Format: <drawingNo>-P<page>-<x4>-<y4>-<YYYYMMDDHHmmss>-<seq>
 * Example: 207_2-P1-0734-0512-20260627142233-01
 */
export function tagPositionId(
  drawingNo: string,
  page: number,
  xNorm: number,
  yNorm: number,
  when: Date = new Date(),
  seq: number = 1,
): string {
  const ts =
    `${when.getFullYear()}${pad(when.getMonth() + 1, 2)}${pad(when.getDate(), 2)}` +
    `${pad(when.getHours(), 2)}${pad(when.getMinutes(), 2)}${pad(when.getSeconds(), 2)}`;
  return `${drawingNo}-P${page}-${norm4(xNorm)}-${norm4(yNorm)}-${ts}-${pad(seq, 2)}`;
}
