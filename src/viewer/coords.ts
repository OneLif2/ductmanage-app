// Coordinate mapping between normalised marker coords (0..1, relative to the unrotated
// page, top-left origin) and the rendered canvas in CSS pixels (which may be rotated/zoomed).
// Storing normalised coords keeps markers correct across device, zoom and rotation.

export interface RenderBox {
  width: number;   // rendered canvas width in CSS px (post-rotation)
  height: number;  // rendered canvas height in CSS px (post-rotation)
  rotation: number; // 0 | 90 | 180 | 270 (clockwise), matches PDF.js
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const norm = (r: number) => ((r % 360) + 360) % 360;

/** Normalised (nx,ny) on the unrotated page -> pixel (x,y) on the rendered canvas. */
export function normToView(nx: number, ny: number, box: RenderBox): { x: number; y: number } {
  let u: number, v: number;
  switch (norm(box.rotation)) {
    case 90:  u = 1 - ny; v = nx; break;
    case 180: u = 1 - nx; v = 1 - ny; break;
    case 270: u = ny;     v = 1 - nx; break;
    default:  u = nx;     v = ny; break;
  }
  return { x: u * box.width, y: v * box.height };
}

/** Pixel (x,y) on the rendered canvas -> normalised (nx,ny) on the unrotated page. */
export function viewToNorm(x: number, y: number, box: RenderBox): { nx: number; ny: number } {
  const u = box.width ? x / box.width : 0;
  const v = box.height ? y / box.height : 0;
  let nx: number, ny: number;
  switch (norm(box.rotation)) {
    case 90:  nx = v;     ny = 1 - u; break;
    case 180: nx = 1 - u; ny = 1 - v; break;
    case 270: nx = 1 - v; ny = u; break;
    default:  nx = u;     ny = v; break;
  }
  return { nx: clamp01(nx), ny: clamp01(ny) };
}
