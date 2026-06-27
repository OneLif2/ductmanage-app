// Unit tests for the coordinate mapping (pure, no DOM). Run: npm run verify:coords
import { normToView, viewToNorm, type RenderBox } from "../src/viewer/coords";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) console.log("  ✓", msg);
  else { console.error("  ✗ FAIL:", msg); failures++; }
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

console.log("DuctManage coordinate-mapping verification\n");

const boxes: RenderBox[] = [
  { width: 1000, height: 1400, rotation: 0 },
  { width: 1400, height: 1000, rotation: 90 },
  { width: 1000, height: 1400, rotation: 180 },
  { width: 1400, height: 1000, rotation: 270 },
];
const pts: [number, number][] = [[0, 0], [1, 1], [0.25, 0.75], [0.5, 0.5], [0.1, 0.9]];

// Round-trip + in-bounds for every rotation.
for (const box of boxes) {
  for (const [nx, ny] of pts) {
    const v = normToView(nx, ny, box);
    const b = viewToNorm(v.x, v.y, box);
    check(near(b.nx, nx) && near(b.ny, ny), `round-trip rot${box.rotation} (${nx},${ny})`);
    check(v.x >= -1e-6 && v.x <= box.width + 1e-6 && v.y >= -1e-6 && v.y <= box.height + 1e-6,
      `in-bounds   rot${box.rotation} (${nx},${ny})`);
  }
}

// Known corner mappings: top-left of the page lands at the expected rendered corner.
const tl0 = normToView(0, 0, boxes[0]);
check(near(tl0.x, 0) && near(tl0.y, 0), "rot0: page top-left -> canvas (0,0)");
const tl90 = normToView(0, 0, boxes[1]);
check(near(tl90.x, 1400) && near(tl90.y, 0), "rot90: page top-left -> canvas top-right");
const br180 = normToView(1, 1, boxes[2]);
check(near(br180.x, 0) && near(br180.y, 0), "rot180: page bottom-right -> canvas (0,0)");

if (failures === 0) console.log("\nALL CHECKS PASSED ✅");
else { console.error(`\n${failures} CHECK(S) FAILED ❌`); process.exit(1); }
