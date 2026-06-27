// Proof of Epic 2: local persistence (IndexedDB), snapshot/compaction, and
// Save/Load Project Package to a real folder. No network, no cloud.
// Run: npm run verify:persistence
import "fake-indexeddb/auto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DuctDb } from "../src/persistence/db";
import { DexieEventRepository, MemoryEventRepository } from "../src/persistence/repository";
import { ProjectSession } from "../src/persistence/session";
import { NodeDirectoryPackageStore } from "../src/persistence/node-package-store";
import { toShards } from "../src/domain/package";
import { tagPositionId } from "../src/domain/ids";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) console.log("  ✓", msg);
  else { console.error("  ✗ FAIL:", msg); failures++; }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  console.log("DuctManage persistence verification\n");

  // --- 1. Persist to IndexedDB, reopen, state survives ---
  const db = new DuctDb("ductmanage-test-" + Date.now());
  const repo = new DexieEventRepository(db);

  const s1 = await ProjectSession.open(repo, "aaa", "Alice");
  await s1.dispatch("PROJECT_SET", "proj1", { name: "PolyU Hostel — Block D" });
  await s1.dispatch("DRAWING_ADDED", "dwg1", { drawingNo: "207_2", revision: "B", page: 1, block: "D", scale: "1:100" });
  const tag = tagPositionId("207_2", 1, 0.0734, 0.0512);
  await s1.dispatch("TAG_CREATED", tag, {
    drawingId: "dwg1", revision: "B", page: 1,
    family: "progress", geomType: "point", geometry: [0.0734, 0.0512], ductRef: "200x150 FAD",
  });
  await s1.dispatch("PROGRESS_ADDED", tag, { status: "WIP", progressPercent: 40, remark: "started" });

  check((await repo.count()) === 4, "4 events persisted to IndexedDB");

  const s2 = await ProjectSession.open(repo, "aaa", "Alice"); // simulate app restart
  check(eq(s2.stateFull(), s1.stateFull()), "reopening from IndexedDB reproduces identical state");
  check(s2.stateFull().tags[tag].latest?.progressPercent === 40, "reloaded marker has correct latest progress");

  // --- 2. Snapshot / compaction ---
  await s2.compact();
  await s2.dispatch("PROGRESS_ADDED", tag, { status: "WIP", progressPercent: 80, remark: "more done" });
  check(eq(s2.state(), s2.stateFull()), "snapshot + tail equals full replay after a post-snapshot event");
  check(s2.state().tags[tag].latest?.progressPercent === 80, "post-snapshot event applied on top of snapshot");

  const s3 = await ProjectSession.open(repo, "aaa", "Alice"); // restart with snapshot present
  check(eq(s3.state(), s2.stateFull()), "restart uses snapshot+tail and matches full replay");

  // --- 3. Save / Load Project Package to a real folder ---
  const dir = join(tmpdir(), "ductpkg-" + Date.now());
  const pkgStore = new NodeDirectoryPackageStore(dir);
  await pkgStore.save(toShards(s2.store.events, { id: "proj1", name: "PolyU Hostel — Block D" }));

  const loaded = await pkgStore.load();
  check(loaded.manifest.devices.includes("aaa"), "saved package manifest lists the device shard");

  const mem = new MemoryEventRepository();
  const { fromShards } = await import("../src/domain/package");
  await mem.append(fromShards(loaded.shards));
  const s4 = await ProjectSession.open(mem, "zzz");
  check(eq(s4.stateFull(), s2.stateFull()), "package saved to folder and loaded into a fresh session matches");

  console.log(`\nSaved package folder: ${dir}`);
  console.log(`Events: ${s2.store.events.length} | tag: ${tag}`);

  await rm(dir, { recursive: true, force: true });
  await db.delete();

  if (failures === 0) console.log("\nALL CHECKS PASSED ✅");
  else { console.error(`\n${failures} CHECK(S) FAILED ❌`); process.exit(1); }
}

main().catch((err) => { console.error(err); process.exit(1); });
