// Executable proof of the event-sourced core invariants.
// Run: npm run verify:domain
import { EventStore } from "../src/domain/store";
import { tagPositionId } from "../src/domain/ids";
import { toShards, fromShards } from "../src/domain/package";
import type { DuctEvent } from "../src/domain/types";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) {
    console.log("  ✓", msg);
  } else {
    console.error("  ✗ FAIL:", msg);
    failures++;
  }
}
const clone = (evts: DuctEvent[]) => evts.map((e) => structuredClone(e));

console.log("DuctManage domain-core verification\n");

// --- Two devices, offline, then sync ---
const A = new EventStore("aaa", "Alice");
const B = new EventStore("bbb", "Bob");

// Device A sets up the project, a drawing, a duct tag, and logs 40% progress.
A.append("PROJECT_SET", "proj1", { name: "PolyU Hostel — Block D" });
A.append("DRAWING_ADDED", "dwg1", { drawingNo: "207_2", revision: "B", page: 1, block: "D", scale: "1:100" });
const tagId = tagPositionId("207_2", 1, 0.0734, 0.0512);
A.append("TAG_CREATED", tagId, {
  drawingId: "dwg1", revision: "B", page: 1,
  family: "progress", geomType: "point", geometry: [0.0734, 0.0512], ductRef: "200x150 FAD",
});
A.append("PROGRESS_ADDED", tagId, { status: "WIP", progressPercent: 40, remark: "started", responsibleTeam: "Team 1" });

// Device B receives A's log, then (later HLC) logs 80% on the same tag and creates a defect tag.
B.merge(clone(A.events));
B.append("PROGRESS_ADDED", tagId, { status: "WIP", progressPercent: 80, remark: "more done", responsibleTeam: "Team 1" });
const tag2 = tagPositionId("207_2", 1, 0.5, 0.5);
B.append("TAG_CREATED", tag2, { drawingId: "dwg1", revision: "B", page: 1, family: "defect", geomType: "point", geometry: [0.5, 0.5] });

// Bidirectional sync.
A.merge(clone(B.events));
B.merge(clone(A.events));

const sa = A.state();
const sb = B.state();

check(JSON.stringify(sa) === JSON.stringify(sb), "two devices converge to byte-identical state");
check(sa.tags[tagId].timeline.length === 2, "marker timeline has 2 progress entries (nothing overwritten)");
check(sa.tags[tagId].latest?.progressPercent === 80, "latest progress = 80 (higher HLC wins deterministically)");
check(!!sa.tags[tag2], "tag created on B is present on A after sync");
check(sa.drawings["dwg1"].scale === "1:100", "drawing metadata survived replay");

// --- Undo (compensating event) ---
B.undoLast(); // undoes B's last action: the defect tag creation -> TAG_DELETED
A.merge(clone(B.events));
check(A.state().tags[tag2]?.deleted === true, "undo of clone marks it deleted and converges after sync");

// --- Project Package round-trip ---
const pkg = toShards(A.events, { id: "proj1", name: "PolyU Hostel — Block D" });
const restored = fromShards(pkg.shards);
const R = new EventStore("zzz");
R.merge(restored);
check(restored.length === A.events.length, "package shard round-trip preserves every event");
check(JSON.stringify(R.state()) === JSON.stringify(A.state()), "replay from package equals live state");
check(pkg.manifest.devices.sort().join(",") === "aaa,bbb", "manifest lists both device shards");

console.log(`\nTag ID example: ${tagId}`);
console.log(`Event ID example: ${A.events[0].id}`);
console.log(`Total events: ${A.events.length} | shards: [${Object.keys(pkg.shards).join(", ")}]`);

if (failures === 0) {
  console.log("\nALL CHECKS PASSED ✅");
} else {
  console.error(`\n${failures} CHECK(S) FAILED ❌`);
  process.exit(1);
}
