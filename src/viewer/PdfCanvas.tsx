// Renders one PDF page to a canvas. The CSS size follows the requested zoom, while
// the backing bitmap is capped so large MVAC sheets do not exceed browser canvas limits.
import { useEffect, useRef } from "react";
import type { PDFPageProxy, RenderTask } from "pdfjs-dist";

export interface PdfCanvasProps {
  page: PDFPageProxy;
  scale: number;
  rotation: number;
  /** Reports the rendered CSS size so overlays/containers can match it. */
  onViewport?: (size: { width: number; height: number }) => void;
}

const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_PIXELS = 48_000_000;
const MIN_OUTPUT_SCALE = 0.1;

function canvasOutputScale(cssWidth: number, cssHeight: number): number {
  const desired = Math.min(window.devicePixelRatio || 1, 3);
  const sideCap = Math.min(MAX_CANVAS_SIDE / cssWidth, MAX_CANVAS_SIDE / cssHeight);
  const areaCap = Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight));
  return Math.max(MIN_OUTPUT_SCALE, Math.min(desired, sideCap, areaCap));
}

async function cancelTask(task: RenderTask | null): Promise<void> {
  if (!task) return;
  task.cancel();
  try {
    await task.promise;
  } catch (err) {
    if ((err as { name?: string })?.name !== "RenderingCancelledException") throw err;
  }
}

export function PdfCanvas({ page, scale, rotation, onViewport }: PdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    const render = async () => {
      const previous = taskRef.current;
      taskRef.current = null;
      try {
        await cancelTask(previous);
      } catch (err) {
        console.error(err);
      }
      if (disposed || canvasRef.current !== canvas) return;

      const viewport = page.getViewport({ scale, rotation });
      const cssWidth = Math.max(1, Math.ceil(viewport.width));
      const cssHeight = Math.max(1, Math.ceil(viewport.height));
      const outputScale = canvasOutputScale(cssWidth, cssHeight);
      const bitmapWidth = Math.max(1, Math.floor(cssWidth * outputScale));
      const bitmapHeight = Math.max(1, Math.floor(cssHeight * outputScale));

      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.dataset.outputScale = outputScale.toFixed(3);
      onViewport?.({ width: cssWidth, height: cssHeight });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, bitmapWidth, bitmapHeight);

      const task = page.render({
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      taskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        if (!disposed && (err as { name?: string })?.name !== "RenderingCancelledException") console.error(err);
      } finally {
        if (taskRef.current === task) taskRef.current = null;
      }
    };

    void render();

    return () => {
      disposed = true;
      void cancelTask(taskRef.current).catch((err) => console.error(err));
    };
  }, [page, scale, rotation, onViewport]);

  return <canvas ref={canvasRef} className="pdf-canvas" />;
}
