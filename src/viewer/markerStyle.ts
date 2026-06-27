import type { Family } from "../state/store";

export function familyColor(family: Family): string {
  switch (family) {
    case "defect": return "#d9534f";
    case "tag": return "#6c757d";
    case "progress":
    default: return "#1b6ec2";
  }
}
