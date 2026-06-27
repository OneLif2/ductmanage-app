// ProjectSession ties the in-memory EventStore to a persistent repository.
// Every dispatched event is appended to the log AND persisted immediately (auto-save).
// State is derived from snapshot + tail when a snapshot exists, else a full replay.
import { EventStore } from "../domain/store";
import { replayOnto } from "../domain/reduce";
import { hlcCompare } from "../domain/hlc";
import type { DuctEvent, EventType, ProjectState } from "../domain/types";
import type { EventRepository, StoredSnapshot } from "./repository";

const clone = <T>(x: T): T => structuredClone(x);

export class ProjectSession {
  private constructor(
    public readonly store: EventStore,
    private readonly repo: EventRepository,
    private snap: StoredSnapshot | undefined,
  ) {}

  /** Open (or resume) a session: hydrate the store from persisted events + snapshot. */
  static async open(repo: EventRepository, node: string, by = "user"): Promise<ProjectSession> {
    const [snap, events] = await Promise.all([repo.loadSnapshot(), repo.loadAll()]);
    const store = new EventStore(node, by);
    store.merge(events);
    return new ProjectSession(store, repo, snap);
  }

  /** Append an event and persist it (auto-save). */
  async dispatch(type: EventType, entityId: string, payload: Record<string, unknown> = {}): Promise<DuctEvent> {
    const e = this.store.append(type, entityId, payload);
    await this.repo.append([e]);
    return e;
  }

  /** Undo this device's last action (compensating event) and persist it. */
  async undoLast(): Promise<DuctEvent | null> {
    const before = this.store.events.length;
    const e = this.store.undoLast();
    if (e && this.store.events.length > before) await this.repo.append([e]);
    return e;
  }

  /** Optimised state: snapshot + tail when available, else full replay. */
  state(): ProjectState {
    if (!this.snap) return this.store.state();
    const covered = this.snap.coveredHlc;
    const tail = this.store.events.filter((e) => hlcCompare(e.hlc, covered) > 0);
    return replayOnto(clone(this.snap.state), tail);
  }

  /** Ground-truth full replay (used to validate the snapshot path). */
  stateFull(): ProjectState {
    return this.store.state();
  }

  /** Checkpoint current state so future loads replay fewer events. */
  async compact(): Promise<void> {
    const events = this.store.events;
    if (!events.length) return;
    let max = events[0].hlc;
    for (const e of events) if (hlcCompare(e.hlc, max) > 0) max = e.hlc;
    const snap: StoredSnapshot = { id: "current", coveredHlc: max, state: this.stateFull(), at: new Date().toISOString() };
    await this.repo.saveSnapshot(snap);
    this.snap = snap;
  }
}
