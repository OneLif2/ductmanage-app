// Hybrid Logical Clock (HLC).
// Combines physical time with a logical counter so events from many offline devices
// have a single deterministic order — no server clock required.
import type { Hlc } from "./types";

/** Stable, lexicographically sortable string form (handy for ids and indexes). */
export function hlcString(h: Hlc): string {
  return `${String(h.wallClock).padStart(15, "0")}:${String(h.counter).padStart(5, "0")}:${h.node}`;
}

/** Total order: wallClock, then counter, then node id. */
export function hlcCompare(a: Hlc, b: Hlc): number {
  if (a.wallClock !== b.wallClock) return a.wallClock - b.wallClock;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.node < b.node ? -1 : a.node > b.node ? 1 : 0;
}

/** Tick the local clock for a new locally-generated event. */
export function hlcLocal(prev: Hlc | null, node: string, physical: number = Date.now()): Hlc {
  const prevWall = prev?.wallClock ?? 0;
  const wall = Math.max(prevWall, physical);
  const counter = wall === prevWall ? (prev!.counter + 1) : 0;
  return { wallClock: wall, counter, node };
}

/** Advance the local clock after observing a remote event (keeps causality). */
export function hlcReceive(prev: Hlc | null, remote: Hlc, node: string, physical: number = Date.now()): Hlc {
  const prevWall = prev?.wallClock ?? 0;
  const wall = Math.max(prevWall, remote.wallClock, physical);
  let counter: number;
  if (wall === prevWall && wall === remote.wallClock) counter = Math.max(prev!.counter, remote.counter) + 1;
  else if (wall === prevWall) counter = prev!.counter + 1;
  else if (wall === remote.wallClock) counter = remote.counter + 1;
  else counter = 0;
  return { wallClock: wall, counter, node };
}
