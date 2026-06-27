// DuctManage domain types — the event-sourced core.
// The event log is the source of truth; everything else is a derived read-model.

/** Hybrid Logical Clock: gives a total, deterministic order across devices without a server. */
export interface Hlc {
  wallClock: number; // ms since epoch (physical component)
  counter: number;   // logical tiebreaker within the same wallClock
  node: string;      // originating device id (final tiebreaker)
}

export type EventType =
  | "PROJECT_SET"
  | "DRAWING_ADDED"
  | "DRAWING_REVISED"
  | "TAG_CREATED"
  | "TAG_MOVED"
  | "TAG_DELETED"
  | "PROGRESS_ADDED"
  | "DEFECT_STATUS_SET"
  | "PROGRESS_CORRECTED"
  | "PHOTO_ADDED";

/** An immutable fact. Appended, never mutated. */
export interface DuctEvent {
  id: string;        // `${node}-${hlcString}` — globally unique, the merge/de-dup key
  node: string;      // device id
  hlc: Hlc;          // ordering
  at: string;        // ISO wall-clock timestamp (for display)
  by: string;        // author display name (attribution, not auth)
  type: EventType;
  entityId: string;  // tag id / drawing id / project id the event targets
  payload: Record<string, unknown>;
}

/** One dated entry in a marker's progress timeline. */
export interface ProgressEntry {
  eventId: string;
  hlc: Hlc;
  status?: string;
  progressPercent?: number;
  severity?: string;
  tagKind?: string;
  remark?: string;
  responsibleTeam?: string;
  photoIds?: string[];
  reverted?: boolean;
  corrected?: boolean;
  by: string;
  at: string;
}

export interface TagState {
  id: string;            // position-embedded human-readable id
  drawingId: string;
  revision: string;
  page: number;
  family: "progress" | "defect" | "tag";
  geomType: "point" | "line";
  geometry: number[];    // normalised: [x,y] for point, [x1,y1,x2,y2] for line
  ductRef?: string;
  deleted?: boolean;
  timeline: ProgressEntry[];
  latest?: ProgressEntry; // newest non-reverted entry by HLC
  createdBy: string;
  createdAt: string;
}

export interface DrawingState {
  id: string;
  drawingNo: string;
  title?: string;
  revision: string;
  block?: string;
  floor?: string;
  page?: number;
  scale?: string;
  rotation?: number;
}

export interface ProjectState {
  project?: { id: string; name?: string; code?: string };
  drawings: Record<string, DrawingState>;
  tags: Record<string, TagState>;
}
