// Unit tests for status/severity/tag colour + badge logic. Run: npm run verify:catalog
import { colorForTag, markerBadge } from "../src/domain/catalog";
import type { ProgressEntry, TagState } from "../src/domain/types";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) console.log("  ✓", msg);
  else { console.error("  ✗ FAIL:", msg); failures++; }
}

const mk = (family: TagState["family"], latest?: Partial<ProgressEntry>): TagState =>
  ({
    id: "x", drawingId: "d", revision: "A", page: 1, family,
    geomType: "point", geometry: [0, 0],
    timeline: latest ? [latest as ProgressEntry] : [],
    latest: latest as ProgressEntry | undefined,
    createdBy: "u", createdAt: "",
  });

console.log("DuctManage catalog verification\n");

check(colorForTag(mk("progress")) === "#9aa7b5", "progress no-status -> grey (not started)");
check(colorForTag(mk("progress", { status: "wip", progressPercent: 60 })) === "#e6a100", "progress wip -> amber");
check(colorForTag(mk("progress", { status: "completed" })) === "#1e7a46", "progress completed -> dark green");
check(markerBadge(mk("progress", { status: "wip", progressPercent: 60 })) === "60", "wip badge shows %");
check(markerBadge(mk("progress", { status: "completed" })) === "✓", "completed badge is check");
check(colorForTag(mk("defect", { severity: "critical", status: "open" })) === "#c0392b", "defect critical -> red");
check(colorForTag(mk("defect", { severity: "critical", status: "closed" })) === "#1e7a46", "defect closed -> green");
check(markerBadge(mk("defect", { severity: "major", status: "open" })) === "!", "defect badge is !");
check(colorForTag(mk("tag", { tagKind: "rfi" })) === "#6f42c1", "tag rfi -> purple");
check(markerBadge(mk("tag", { tagKind: "rfi" })) === "R", "tag badge is kind initial");

if (failures === 0) console.log("\nALL CHECKS PASSED ✅");
else { console.error(`\n${failures} CHECK(S) FAILED ❌`); process.exit(1); }
