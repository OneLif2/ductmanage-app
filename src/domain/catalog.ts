// Single source of truth for statuses, severities, tag types, colours and labels.
import type { TagState } from "./types";

export interface Option {
  key: string;
  en: string;
  zh: string;
  color: string;
}

export const PROGRESS_STATUSES: Option[] = [
  { key: "not_started", en: "Not Started", zh: "未開始", color: "#9aa7b5" },
  { key: "wip", en: "Work in Progress", zh: "安裝中", color: "#e6a100" },
  { key: "installed", en: "Installed", zh: "已安裝", color: "#1b6ec2" },
  { key: "inspected", en: "RISC Inspected", zh: "已驗收", color: "#2e8b57" },
  { key: "completed", en: "Completed", zh: "已完成", color: "#1e7a46" },
];

export const WIP_PERCENTS = [1, 5, 10, 20, 40, 50, 60, 80, 100];

export const DEFECT_SEVERITIES: Option[] = [
  { key: "critical", en: "Critical", zh: "嚴重", color: "#c0392b" },
  { key: "major", en: "Major", zh: "主要", color: "#e67e22" },
  { key: "minor", en: "Minor", zh: "次要", color: "#d4a700" },
];

export const DEFECT_STATUSES: Option[] = [
  { key: "open", en: "Open", zh: "待處理", color: "#c0392b" },
  { key: "in_progress", en: "In Progress", zh: "處理中", color: "#e67e22" },
  { key: "fixed", en: "Fixed", zh: "已修復", color: "#3498db" },
  { key: "verified", en: "Verified", zh: "已核實", color: "#2e8b57" },
  { key: "closed", en: "Closed", zh: "已關閉", color: "#1e7a46" },
];

export const TAG_KINDS: Option[] = [
  { key: "info", en: "Info", zh: "資料", color: "#6c757d" },
  { key: "follow_up", en: "Follow-up", zh: "跟進", color: "#e6a100" },
  { key: "rfi", en: "RFI", zh: "查詢", color: "#6f42c1" },
  { key: "ncr", en: "NCR", zh: "不合格", color: "#c0392b" },
  { key: "hold", en: "Hold Point", zh: "驗收點", color: "#0d6efd" },
  { key: "fire_damper", en: "Fire Damper", zh: "防火閘", color: "#d63384" },
  { key: "safety", en: "Safety", zh: "安全", color: "#fd7e14" },
];

export const byKey = (opts: Option[], key?: string): Option | undefined => opts.find((o) => o.key === key);

/** Marker colour derived from the latest timeline entry (status / severity / kind). */
export function colorForTag(tag: TagState): string {
  const l = tag.latest;
  if (tag.family === "defect") {
    if (l?.status === "closed") return "#1e7a46";
    return byKey(DEFECT_SEVERITIES, l?.severity)?.color ?? "#e67e22";
  }
  if (tag.family === "tag") {
    return byKey(TAG_KINDS, l?.tagKind)?.color ?? "#6c757d";
  }
  return byKey(PROGRESS_STATUSES, l?.status)?.color ?? "#9aa7b5";
}

/** Short glyph shown on the marker: WIP %, ✓ when complete, ! for defects, kind initial for tags. */
export function markerBadge(tag: TagState): string | null {
  const l = tag.latest;
  if (tag.family === "defect") return "!";
  if (tag.family === "tag") return (byKey(TAG_KINDS, l?.tagKind)?.en ?? "T").slice(0, 1);
  if (l?.status === "wip" && typeof l.progressPercent === "number") return String(l.progressPercent);
  if (l?.status === "completed" || l?.status === "inspected") return "✓";
  return null;
}

export function familyLabel(family: TagState["family"]): string {
  return family === "defect" ? "Defect / 缺陷" : family === "tag" ? "Tag / 標籤" : "Progress / 進度";
}
