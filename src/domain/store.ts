// EventStore — appends local events, merges remote events, derives state.
// This is the single object feature code talks to; it never mutates read-model rows directly.
import type { DuctEvent, EventType, Hlc } from "./types";
import { hlcCompare, hlcLocal, hlcReceive, hlcString } from "./hlc";
import { replay } from "./reduce";

export class EventStore {
  readonly node: string;
  by: string;
  events: DuctEvent[] = [];
  private clock: Hlc | null = null;
  private index = new Set<string>();

  constructor(node: string, by = "user") {
    this.node = node;
    this.by = by;
  }

  /** Append a new locally-generated event and return it. */
  append(type: EventType, entityId: string, payload: Record<string, unknown> = {}): DuctEvent {
    this.clock = hlcLocal(this.clock, this.node);
    const e: DuctEvent = {
      id: `${this.node}-${hlcString(this.clock)}`,
      node: this.node,
      hlc: this.clock,
      at: new Date().toISOString(),
      by: this.by,
      type,
      entityId,
      payload,
    };
    this.events.push(e);
    this.index.add(e.id);
    return e;
  }

  /** Merge events from another device's log. Returns how many were new. Conflict-free. */
  merge(incoming: DuctEvent[]): number {
    let added = 0;
    for (const e of incoming) {
      if (this.index.has(e.id)) continue;
      this.index.add(e.id);
      this.events.push(e);
      this.clock = hlcReceive(this.clock, e.hlc, this.node);
      added++;
    }
    return added;
  }

  /** Current read-model. */
  state() {
    return replay(this.events);
  }

  /**
   * Undo this device's most recent undoable action by appending a compensating event.
   * (Event sourcing makes undo cheap: we never rewrite history, we append the inverse.)
   */
  undoLast(): DuctEvent | null {
    const own = this.events
      .filter((e) => e.node === this.node && !(e.payload as any)?.undo)
      .sort((a, b) => hlcCompare(a.hlc, b.hlc));
    for (let i = own.length - 1; i >= 0; i--) {
      const e = own[i];
      if (e.type === "TAG_CREATED") {
        return this.append("TAG_DELETED", e.entityId, { undo: true, undoOf: e.id });
      }
      if (e.type === "PROGRESS_ADDED" || e.type === "DEFECT_STATUS_SET") {
        return this.append("PROGRESS_CORRECTED", e.entityId, {
          undo: true,
          targetEventId: e.id,
          changes: { reverted: true },
        });
      }
    }
    return null;
  }
}
