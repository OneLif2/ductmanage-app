// Storage-agnostic event repository + two implementations:
//  - DexieEventRepository: IndexedDB (browser, and Node via fake-indexeddb in tests)
//  - MemoryEventRepository: in-memory (tests / ephemeral)
import type { DuctEvent } from "../domain/types";
import type { DuctDb, StoredSnapshot } from "./db";

export type { StoredSnapshot } from "./db";

export interface EventRepository {
  loadAll(): Promise<DuctEvent[]>;
  append(events: DuctEvent[]): Promise<void>;
  count(): Promise<number>;
  loadSnapshot(): Promise<StoredSnapshot | undefined>;
  saveSnapshot(snap: StoredSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export class DexieEventRepository implements EventRepository {
  constructor(private db: DuctDb) {}

  loadAll() {
    return this.db.events.toArray();
  }
  async append(events: DuctEvent[]) {
    if (events.length) await this.db.events.bulkPut(events);
  }
  count() {
    return this.db.events.count();
  }
  loadSnapshot() {
    return this.db.snapshots.get("current");
  }
  async saveSnapshot(snap: StoredSnapshot) {
    await this.db.snapshots.put({ ...snap, id: "current" });
  }
  async clear() {
    await this.db.events.clear();
    await this.db.snapshots.clear();
  }
}

export class MemoryEventRepository implements EventRepository {
  private events = new Map<string, DuctEvent>();
  private snap: StoredSnapshot | undefined;

  async loadAll() {
    return [...this.events.values()];
  }
  async append(events: DuctEvent[]) {
    for (const e of events) this.events.set(e.id, e);
  }
  async count() {
    return this.events.size;
  }
  async loadSnapshot() {
    return this.snap;
  }
  async saveSnapshot(snap: StoredSnapshot) {
    this.snap = { ...snap, id: "current" };
  }
  async clear() {
    this.events.clear();
    this.snap = undefined;
  }
}
