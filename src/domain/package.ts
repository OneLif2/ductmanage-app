// Project Package (de)serialisation.
// The log is stored as per-device NDJSON shards so two devices never write the same file
// (the cloud drive therefore never produces a conflict-copy). A manifest carries
// schemaVersion + per-device counts for integrity.
import type { DuctEvent } from "./types";

export const SCHEMA_VERSION = 1;

export interface Manifest {
  schemaVersion: number;
  projectId: string;
  name?: string;
  devices: string[];
  counts: Record<string, number>;
}

export interface PackageShards {
  manifest: Manifest;
  shards: Record<string, string>; // deviceId -> NDJSON (one event per line)
}

/** Group events by originating device into NDJSON shards + manifest. */
export function toShards(events: DuctEvent[], project: { id: string; name?: string }): PackageShards {
  const byNode: Record<string, DuctEvent[]> = {};
  for (const e of events) (byNode[e.node] ??= []).push(e);

  const shards: Record<string, string> = {};
  const counts: Record<string, number> = {};
  for (const node of Object.keys(byNode)) {
    shards[node] = byNode[node].map((e) => JSON.stringify(e)).join("\n") + "\n";
    counts[node] = byNode[node].length;
  }

  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      projectId: project.id,
      name: project.name,
      devices: Object.keys(byNode),
      counts,
    },
    shards,
  };
}

/** Parse NDJSON shards back into a flat event list (order is irrelevant — replay re-sorts). */
export function fromShards(shards: Record<string, string>): DuctEvent[] {
  const events: DuctEvent[] = [];
  for (const node of Object.keys(shards)) {
    for (const line of shards[node].split("\n")) {
      const s = line.trim();
      if (s) events.push(JSON.parse(s) as DuctEvent);
    }
  }
  return events;
}
