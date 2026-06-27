import { useState } from "react";
import type { ProgressEntry, TagState } from "../domain/types";
import { useApp, type Family } from "../state/store";
import {
  DEFECT_SEVERITIES,
  DEFECT_STATUSES,
  PROGRESS_STATUSES,
  TAG_KINDS,
  WIP_PERCENTS,
  byKey,
  familyLabel,
  type Option,
} from "../domain/catalog";
import type { RenderBox } from "./coords";

type Anchor = { x: number; y: number };

interface MarkerEditorPopoverProps {
  mode: "create" | "edit";
  family: Family;
  anchor: Anchor;
  box: RenderBox;
  tagId?: string;
  onCreate?: (payload: Record<string, unknown>) => Promise<void> | void;
  onClose: () => void;
}

const POPOVER_WIDTH = 340;
const POPOVER_HEIGHT = 520;

function popupPosition(anchor: Anchor, box: RenderBox): Anchor {
  const roomRight = box.width - anchor.x;
  const roomBottom = box.height - anchor.y;
  const rawLeft = roomRight >= POPOVER_WIDTH + 24 ? anchor.x + 14 : anchor.x - POPOVER_WIDTH - 14;
  const rawTop = roomBottom >= POPOVER_HEIGHT + 24 ? anchor.y + 14 : anchor.y - POPOVER_HEIGHT - 14;
  const maxLeft = Math.max(8, box.width - POPOVER_WIDTH - 8);
  const maxTop = Math.max(8, box.height - POPOVER_HEIGHT - 8);
  return {
    x: Math.min(maxLeft, Math.max(8, rawLeft)),
    y: Math.min(maxTop, Math.max(8, rawTop)),
  };
}

function Chips({ options, value, onChange }: { options: Option[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="chips compact">
      {options.map((o) => (
        <button
          key={o.key}
          className={`chip ${value === o.key ? "active" : ""}`}
          style={value === o.key ? { background: o.color, borderColor: o.color, color: "#fff" } : undefined}
          onClick={() => onChange(o.key)}
          type="button"
        >
          {o.en}
        </button>
      ))}
    </div>
  );
}

function describeEntry(family: TagState["family"], e: ProgressEntry): string {
  if (family === "defect") {
    const sev = byKey(DEFECT_SEVERITIES, e.severity)?.en ?? e.severity ?? "";
    const st = byKey(DEFECT_STATUSES, e.status)?.en ?? e.status ?? "";
    return `${sev}${sev && st ? " / " : ""}${st}`;
  }
  if (family === "tag") return byKey(TAG_KINDS, e.tagKind)?.en ?? e.tagKind ?? "Tag";
  const st = byKey(PROGRESS_STATUSES, e.status)?.en ?? e.status ?? "";
  return e.status === "wip" && typeof e.progressPercent === "number" ? `${st} - ${e.progressPercent}%` : st;
}

export function MarkerEditorPopover({
  mode,
  family,
  anchor,
  box,
  tagId,
  onCreate,
  onClose,
}: MarkerEditorPopoverProps) {
  const tag = useApp((s) => (tagId ? s.state.tags[tagId] : undefined));
  const addUpdate = useApp((s) => s.addUpdate);
  const correctLast = useApp((s) => s.correctLast);
  const deleteTag = useApp((s) => s.deleteTag);
  const latest = tag?.latest;

  const [status, setStatus] = useState(latest?.status ?? (mode === "create" ? "wip" : "not_started"));
  const [percent, setPercent] = useState<number>(latest?.progressPercent ?? 40);
  const [severity, setSeverity] = useState(latest?.severity ?? "major");
  const [dstatus, setDstatus] = useState(latest?.status ?? "open");
  const [kind, setKind] = useState(latest?.tagKind ?? "info");
  const [remark, setRemark] = useState("");
  const [team, setTeam] = useState(latest?.responsibleTeam ?? "");
  const [editLast, setEditLast] = useState(false);
  const [busy, setBusy] = useState(false);

  if (mode === "edit" && (!tag || tag.deleted || !tagId)) return null;

  const pos = popupPosition(anchor, box);
  const title = mode === "create" ? `New ${familyLabel(family)}` : familyLabel(family);
  const timeline = tag?.timeline ?? [];

  function payload(): Record<string, unknown> {
    if (family === "defect") return { severity, status: dstatus, remark: remark || undefined };
    if (family === "tag") return { tagKind: kind, remark: remark || undefined };
    return {
      status,
      progressPercent: status === "wip" ? percent : undefined,
      remark: remark || undefined,
      responsibleTeam: team || undefined,
    };
  }

  async function submit() {
    setBusy(true);
    try {
      if (mode === "create") {
        await onCreate?.(payload());
      } else if (tagId) {
        if (editLast && timeline.length) await correctLast(tagId, payload());
        else await addUpdate(tagId, family, payload());
      }
      setRemark("");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!tagId) return;
    setBusy(true);
    try {
      await deleteTag(tagId);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="marker-popover" style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="popover-head">
        <div>
          <div className="popover-title">{title}</div>
          {tagId && <div className="popover-id mono">{tagId}</div>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close" type="button">x</button>
      </div>

      <div className="popover-body">
        {family === "progress" && (
          <>
            <div className="field-label">Status</div>
            <Chips options={PROGRESS_STATUSES} value={status} onChange={setStatus} />
            {status === "wip" && (
              <>
                <div className="field-label">Progress %</div>
                <div className="pcts compact">
                  {WIP_PERCENTS.map((p) => (
                    <button key={p} className={`pct ${percent === p ? "active" : ""}`} onClick={() => setPercent(p)} type="button">
                      {p}
                    </button>
                  ))}
                  <input
                    className="pct-input"
                    type="number"
                    min={0}
                    max={100}
                    value={percent}
                    onChange={(e) => setPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  />
                </div>
              </>
            )}
            <div className="field-label">Responsible team</div>
            <input className="text-input" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Team 1" />
          </>
        )}

        {family === "defect" && (
          <>
            <div className="field-label">Severity</div>
            <Chips options={DEFECT_SEVERITIES} value={severity} onChange={setSeverity} />
            <div className="field-label">Status</div>
            <Chips options={DEFECT_STATUSES} value={dstatus} onChange={setDstatus} />
          </>
        )}

        {family === "tag" && (
          <>
            <div className="field-label">Tag type</div>
            <Chips options={TAG_KINDS} value={kind} onChange={setKind} />
          </>
        )}

        <div className="field-label">Remark</div>
        <textarea className="text-input" rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Site note..." />

        {mode === "edit" && (
          <label className="check">
            <input type="checkbox" checked={editLast} onChange={(e) => setEditLast(e.target.checked)} />
            Correct last entry
          </label>
        )}

        {mode === "edit" && (
          <div className="timeline compact">
            {timeline.length === 0 && <div className="muted small">No updates yet.</div>}
            {[...timeline].reverse().slice(0, 3).map((e, i) => (
              <div key={e.eventId + i} className={`tl-row ${e.reverted ? "reverted" : ""}`}>
                <div className="tl-main">{describeEntry(family, e)}</div>
                <div className="tl-meta">
                  {e.at ? new Date(e.at).toLocaleString() : ""} / {e.by}
                </div>
                {e.remark && <div className="tl-remark">{e.remark}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="popover-actions">
        <button className="btn primary" onClick={() => void submit()} disabled={busy} type="button">
          {mode === "create" ? "Confirm" : editLast ? "Save" : "Add update"}
        </button>
        <button className="btn" onClick={onClose} disabled={busy} type="button">Cancel</button>
        {mode === "edit" && (
          <button className="btn danger" onClick={() => void remove()} disabled={busy} type="button">Delete</button>
        )}
      </div>
    </div>
  );
}
