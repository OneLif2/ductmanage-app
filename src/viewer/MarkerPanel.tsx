// Bottom-sheet detail form for a marker: set status/%/severity/kind, remark, team;
// add a new dated progress update OR correct the last one; view the timeline.
import { useState } from "react";
import type { ProgressEntry, TagState } from "../domain/types";
import { useApp } from "../state/store";
import {
  PROGRESS_STATUSES, WIP_PERCENTS, DEFECT_SEVERITIES, DEFECT_STATUSES, TAG_KINDS,
  byKey, effectiveProgressStatus, familyLabel, type Option,
} from "../domain/catalog";

function Chips({ options, value, onChange }: { options: Option[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.key}
          className={`chip ${value === o.key ? "active" : ""}`}
          style={value === o.key ? { background: o.color, borderColor: o.color, color: "#fff" } : undefined}
          onClick={() => onChange(o.key)}
        >
          {o.en} <span className="zh">{o.zh}</span>
        </button>
      ))}
    </div>
  );
}

function describeEntry(family: TagState["family"], e: ProgressEntry): string {
  if (family === "defect") {
    const sev = byKey(DEFECT_SEVERITIES, e.severity)?.en ?? e.severity ?? "";
    const st = byKey(DEFECT_STATUSES, e.status)?.en ?? e.status ?? "";
    return `${sev}${sev && st ? " · " : ""}${st}`;
  }
  if (family === "tag") return byKey(TAG_KINDS, e.tagKind)?.en ?? e.tagKind ?? "Tag";
  const status = effectiveProgressStatus(e);
  const st = byKey(PROGRESS_STATUSES, status)?.en ?? status ?? "";
  return status === "wip" && typeof e.progressPercent === "number" ? `${st} — ${e.progressPercent}%` : st;
}

export function MarkerPanel({ tagId, onClose }: { tagId: string; onClose: () => void }) {
  const tag = useApp((s) => s.state.tags[tagId]);
  const addUpdate = useApp((s) => s.addUpdate);
  const correctLast = useApp((s) => s.correctLast);
  const deleteTag = useApp((s) => s.deleteTag);
  const latest = tag?.latest;

  const [status, setStatus] = useState(effectiveProgressStatus(latest) ?? "not_started");
  const [percent, setPercent] = useState<number>(latest?.progressPercent ?? 40);
  const [severity, setSeverity] = useState(latest?.severity ?? "major");
  const [dstatus, setDstatus] = useState(latest?.status ?? "open");
  const [kind, setKind] = useState(latest?.tagKind ?? "info");
  const [remark, setRemark] = useState("");
  const [team, setTeam] = useState(latest?.responsibleTeam ?? "");
  const [editLast, setEditLast] = useState(false);

  if (!tag || tag.deleted) return null;
  const family = tag.family;

  function changeProgressStatus(nextStatus: string) {
    setStatus(nextStatus);
    if (nextStatus === "wip" && percent >= 100) setPercent(80);
  }

  function changeProgressPercent(nextPercent: number) {
    const clamped = Math.max(0, Math.min(100, nextPercent));
    setPercent(clamped);
    setStatus(clamped >= 100 ? "completed" : "wip");
  }

  async function submit() {
    let payload: Record<string, unknown>;
    if (family === "defect") payload = { severity, status: dstatus, remark: remark || undefined };
    else if (family === "tag") payload = { tagKind: kind, remark: remark || undefined };
    else {
      const progressStatus = status === "wip" && percent >= 100 ? "completed" : status;
      payload = {
        status: progressStatus,
        progressPercent: progressStatus === "wip" ? percent : undefined,
        remark: remark || undefined,
        responsibleTeam: team || undefined,
      };
    }

    if (editLast && tag.timeline.length) await correctLast(tagId, payload);
    else await addUpdate(tagId, family, payload);
    setRemark("");
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <div className="sheet-title">{familyLabel(family)}</div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="sheet-id mono">{tagId}</div>

      <div className="sheet-body">
        {family === "progress" && (
          <>
            <div className="field-label">Status / 狀態</div>
            <Chips options={PROGRESS_STATUSES} value={status} onChange={changeProgressStatus} />
            {status === "wip" && (
              <>
                <div className="field-label">WIP %</div>
                <div className="pcts">
                  {WIP_PERCENTS.map((p) => (
                    <button key={p} className={`pct ${percent === p ? "active" : ""}`} onClick={() => changeProgressPercent(p)}>{p}</button>
                  ))}
                  <input className="pct-input" type="number" min={0} max={100} value={percent}
                    onChange={(e) => changeProgressPercent(Number(e.target.value) || 0)} />
                </div>
              </>
            )}
            <div className="field-label">Responsible team / 隊伍</div>
            <input className="text-input" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Team 1" />
          </>
        )}

        {family === "defect" && (
          <>
            <div className="field-label">Severity / 嚴重程度</div>
            <Chips options={DEFECT_SEVERITIES} value={severity} onChange={setSeverity} />
            <div className="field-label">Status / 狀態</div>
            <Chips options={DEFECT_STATUSES} value={dstatus} onChange={setDstatus} />
          </>
        )}

        {family === "tag" && (
          <>
            <div className="field-label">Tag type / 標籤類型</div>
            <Chips options={TAG_KINDS} value={kind} onChange={setKind} />
          </>
        )}

        <div className="field-label">Remark / 備註</div>
        <textarea className="text-input" rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Site note…" />

        <label className="check">
          <input type="checkbox" checked={editLast} onChange={(e) => setEditLast(e.target.checked)} />
          Correct last entry instead of adding new / 修改上一筆（而非新增）
        </label>

        <div className="sheet-actions">
          <button className="btn primary" onClick={() => void submit()}>
            {editLast ? "Save correction / 儲存修改" : "Add update / 新增進度"}
          </button>
          <button className="btn danger" onClick={() => { void deleteTag(tagId); onClose(); }}>Delete</button>
        </div>

        <div className="field-label">Timeline / 進度時間軸 ({tag.timeline.length})</div>
        <div className="timeline">
          {tag.timeline.length === 0 && <div className="muted small">No updates yet.</div>}
          {[...tag.timeline].reverse().map((e, i) => (
            <div key={e.eventId + i} className={`tl-row ${e.reverted ? "reverted" : ""}`}>
              <div className="tl-main">{describeEntry(family, e)}</div>
              <div className="tl-meta">
                {e.at ? new Date(e.at).toLocaleString() : ""} · {e.by}
                {e.reverted ? " · (reverted)" : ""}{e.corrected ? " · (corrected)" : ""}
              </div>
              {e.remark && <div className="tl-remark">{e.remark}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
