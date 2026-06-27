// App store (Zustand). Owns the ProjectSession and the derived read-model, and exposes
// actions that emit events (which auto-save to IndexedDB via the session).
import { create } from "zustand";
import { DuctDb } from "../persistence/db";
import { DexieEventRepository } from "../persistence/repository";
import { ProjectSession } from "../persistence/session";
import { tagPositionId } from "../domain/ids";
import type { ProjectState, TagState } from "../domain/types";
import { emptyState } from "../domain/reduce";
import { getIdentity } from "./identity";

export type Family = "progress" | "defect" | "tag";
export type GeomType = "point" | "line";

const normRotation = (r: number) => ((Math.round(r / 90) * 90) % 360 + 360) % 360;

interface AppStore {
  session: ProjectSession | null;
  state: ProjectState;
  ready: boolean;

  init: () => Promise<void>;
  ensureDrawing: (id: string, meta: Record<string, unknown>) => Promise<void>;
  setDrawingRotation: (drawingId: string, rotation: number) => Promise<void>;
  place: (
    drawingId: string, revision: string, page: number,
    family: Family, geomType: GeomType, geometry: number[],
    initial: Record<string, unknown>,
  ) => Promise<string>;
  addUpdate: (tagId: string, family: Family, payload: Record<string, unknown>) => Promise<void>;
  correctLast: (tagId: string, changes: Record<string, unknown>) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  undo: () => Promise<void>;
  refresh: () => void;
  tagsFor: (drawingId: string, page: number) => TagState[];
}

const entryType = (family: Family) => (family === "defect" ? "DEFECT_STATUS_SET" : "PROGRESS_ADDED");

export const useApp = create<AppStore>((set, get) => ({
  session: null,
  state: emptyState(),
  ready: false,

  async init() {
    if (get().session) return;
    const repo = new DexieEventRepository(new DuctDb("ductmanage"));
    const { deviceId, displayName } = getIdentity();
    const session = await ProjectSession.open(repo, deviceId, displayName);
    set({ session, state: session.state(), ready: true });
  },

  async ensureDrawing(id, meta) {
    const s = get().session;
    if (!s) return;
    if (!s.state().drawings[id]) {
      await s.dispatch("DRAWING_ADDED", id, meta);
      get().refresh();
    }
  },

  async setDrawingRotation(drawingId, rotation) {
    const s = get().session;
    if (!s) return;
    const next = normRotation(rotation);
    const drawing = get().state.drawings[drawingId];
    if (!drawing) return;
    const current = drawing.rotation;
    if ((typeof current === "number" ? normRotation(current) : 0) === next) return;
    await s.dispatch("DRAWING_REVISED", drawingId, { rotation: next });
    get().refresh();
  },

  async place(drawingId, revision, page, family, geomType, geometry, initial) {
    const s = get().session;
    if (!s) return "";
    const id = tagPositionId(drawingId, page, geometry[0], geometry[1]);
    await s.dispatch("TAG_CREATED", id, { drawingId, revision, page, family, geomType, geometry });
    await s.dispatch(entryType(family), id, initial);
    get().refresh();
    return id;
  },

  async addUpdate(tagId, family, payload) {
    const s = get().session;
    if (!s) return;
    await s.dispatch(entryType(family), tagId, payload);
    get().refresh();
  },

  async correctLast(tagId, changes) {
    const s = get().session;
    if (!s) return;
    const tag = get().state.tags[tagId];
    const last = tag?.timeline[tag.timeline.length - 1];
    if (!last) {
      await s.dispatch(entryType(tag?.family ?? "progress"), tagId, changes);
    } else {
      await s.dispatch("PROGRESS_CORRECTED", tagId, { targetEventId: last.eventId, changes });
    }
    get().refresh();
  },

  async deleteTag(tagId) {
    const s = get().session;
    if (!s) return;
    await s.dispatch("TAG_DELETED", tagId, {});
    get().refresh();
  },

  async undo() {
    const s = get().session;
    if (!s) return;
    await s.undoLast();
    get().refresh();
  },

  refresh() {
    const s = get().session;
    if (s) set({ state: s.state() });
  },

  tagsFor(drawingId, page) {
    const tags = get().state.tags;
    return Object.values(tags).filter((t) => t.drawingId === drawingId && t.page === page && !t.deleted);
  },
}));
