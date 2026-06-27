// Reducers + replay. The current read-model is a deterministic fold of the event log
// in HLC order. This file has no side effects and is fully unit-testable.
import type { DuctEvent, ProgressEntry, ProjectState } from "./types";
import { hlcCompare } from "./hlc";

export function emptyState(): ProjectState {
  return { drawings: {}, tags: {} };
}

export function applyEvent(state: ProjectState, e: DuctEvent): void {
  const p = e.payload as Record<string, any>;
  switch (e.type) {
    case "PROJECT_SET":
      state.project = { id: e.entityId, name: p.name, code: p.code };
      break;

    case "DRAWING_ADDED":
    case "DRAWING_REVISED":
      state.drawings[e.entityId] = {
        ...(state.drawings[e.entityId] ?? {}),
        ...p,
        id: e.entityId,
      } as ProjectState["drawings"][string];
      break;

    case "TAG_CREATED":
      state.tags[e.entityId] = {
        id: e.entityId,
        drawingId: p.drawingId,
        revision: p.revision,
        page: p.page,
        family: p.family,
        geomType: p.geomType,
        geometry: p.geometry,
        ductRef: p.ductRef,
        timeline: [],
        createdBy: e.by,
        createdAt: e.at,
      };
      break;

    case "TAG_MOVED": {
      const t = state.tags[e.entityId];
      if (t) t.geometry = p.geometry;
      break;
    }

    case "TAG_DELETED": {
      const t = state.tags[e.entityId];
      if (t) t.deleted = true;
      break;
    }

    case "PROGRESS_ADDED":
    case "DEFECT_STATUS_SET": {
      const t = state.tags[e.entityId];
      if (!t) break;
      const entry: ProgressEntry = {
        eventId: e.id,
        hlc: e.hlc,
        by: e.by,
        at: e.at,
        status: p.status,
        progressPercent: p.progressPercent,
        severity: p.severity,
        tagKind: p.tagKind,
        remark: p.remark,
        responsibleTeam: p.responsibleTeam,
        photoIds: p.photoIds,
      };
      t.timeline.push(entry);
      break;
    }

    case "PROGRESS_CORRECTED": {
      const t = state.tags[e.entityId];
      if (!t) break;
      const target = t.timeline.find((x) => x.eventId === p.targetEventId);
      if (target) Object.assign(target, p.changes ?? {}, { corrected: true });
      break;
    }

    case "PHOTO_ADDED": {
      const t = state.tags[e.entityId];
      if (!t) break;
      const last = t.timeline[t.timeline.length - 1];
      if (last) last.photoIds = [...(last.photoIds ?? []), p.photoId];
      break;
    }
  }
}

/** Recompute each tag's `latest` (newest non-reverted entry; timeline is in HLC order). */
export function finalizeLatest(state: ProjectState): void {
  for (const id of Object.keys(state.tags)) {
    const t = state.tags[id];
    t.latest = undefined;
    for (const entry of t.timeline) {
      if (!entry.reverted) t.latest = entry;
    }
  }
}

/**
 * Apply `events` (sorted by HLC) on top of an existing `state`, then finalise.
 * Used both for a full replay (base = emptyState) and for snapshot + tail replay.
 * NOTE: snapshot + tail assumes monotonic local HLC; on sync (Phase 2) the snapshot
 * is invalidated/recomputed if an out-of-order event arrives before its coveredHlc.
 */
export function replayOnto(state: ProjectState, events: DuctEvent[]): ProjectState {
  const ordered = [...events].sort((a, b) => hlcCompare(a.hlc, b.hlc));
  for (const e of ordered) applyEvent(state, e);
  finalizeLatest(state);
  return state;
}

/** Replay all events from scratch into a fresh read-model. */
export function replay(events: DuctEvent[]): ProjectState {
  return replayOnto(emptyState(), events);
}
