// IndexedDB schema (Dexie). Stores the append-only event log + a single rolling snapshot.
import Dexie, { type Table } from "dexie";
import type { DuctEvent, Hlc, ProjectState } from "../domain/types";

export interface StoredSnapshot {
  id: string;          // always "current" (single rolling snapshot)
  coveredHlc: Hlc;     // highest HLC included in `state`
  state: ProjectState; // derived read-model up to coveredHlc
  at: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class DuctDb extends Dexie {
  events!: Table<DuctEvent, string>;
  snapshots!: Table<StoredSnapshot, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = "ductmanage") {
    super(name);
    this.version(1).stores({
      events: "id, node, entityId, type",
      snapshots: "id",
      meta: "key",
    });
  }
}
