// Composes the page canvas, controls, tool palette, overlay, anchored marker editor,
// and AutoCAD-style drag panning.
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import type { LoadedPdf } from "../pdf/pdfDocument";
import { PdfCanvas } from "./PdfCanvas";
import { ViewerControls } from "./ViewerControls";
import { MarkerOverlay } from "./MarkerOverlay";
import { MarkerEditorPopover } from "./MarkerEditorPopover";
import { normToView, viewToNorm, type RenderBox } from "./coords";
import { useApp, type Family, type GeomType } from "../state/store";

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const LINE_ACTION_WIDTH = 172;
const LINE_ACTION_HEIGHT = 48;
const ROTATION_STORAGE_PREFIX = "ductmanage.viewer.rotation";
const clamp = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
const normRotation = (r: number) => ((Math.round(r / 90) * 90) % 360 + 360) % 360;

type Tool = "pan" | "select" | "progress" | "defect" | "tag" | "line";
const TOOLS: { key: Tool; label: string }[] = [
  { key: "pan", label: "Pan" },
  { key: "select", label: "Select" },
  { key: "progress", label: "Progress" },
  { key: "defect", label: "Defect" },
  { key: "tag", label: "Tag" },
  { key: "line", label: "Line" },
];

interface PendingPlacement {
  family: Family;
  geomType: GeomType;
  geometry: number[];
  anchor: { x: number; y: number };
}

function rotationStorageKey(drawingId: string, revision: string): string {
  return `${ROTATION_STORAGE_PREFIX}:${encodeURIComponent(drawingId)}:${encodeURIComponent(revision)}`;
}

function loadSavedRotation(drawingId: string, revision: string): number {
  try {
    const raw = window.localStorage.getItem(rotationStorageKey(drawingId, revision));
    if (raw == null) return 0;
    return normRotation(Number(raw));
  } catch {
    return 0;
  }
}

function saveRotation(drawingId: string, revision: string, rotation: number): void {
  try {
    window.localStorage.setItem(rotationStorageKey(drawingId, revision), String(normRotation(rotation)));
  } catch {
    // localStorage can be unavailable in some privacy modes; rotation still works for the current session.
  }
}

export function DrawingViewer({ pdf, drawingId, revision }: { pdf: LoadedPdf; drawingId: string; revision: string }) {
  const [pageNum, setPageNum] = useState(1);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(() => loadSavedRotation(drawingId, revision));
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<Tool>("pan");
  const [draftLine, setDraftLine] = useState<number[] | null>(null);
  const [pending, setPending] = useState<PendingPlacement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const scaleRef = useRef(scale);
  const canvasStackRef = useRef<HTMLDivElement | null>(null);

  const tagsMap = useApp((s) => s.state.tags);
  const place = useApp((s) => s.place);
  const undo = useApp((s) => s.undo);

  const markers = useMemo(
    () => Object.values(tagsMap).filter((t) => t.drawingId === drawingId && t.page === pageNum && !t.deleted),
    [tagsMap, drawingId, pageNum],
  );

  useEffect(() => {
    let active = true;
    pdf.getPage(pageNum).then((p) => active && setPage(p));
    return () => {
      active = false;
    };
  }, [pdf, pageNum]);

  const fit = useCallback(() => {
    if (!page || !scrollEl) return;
    const base = page.getViewport({ scale: 1, rotation });
    setScale(clamp((scrollEl.clientWidth - 24) / base.width));
  }, [page, rotation, scrollEl]);
  useEffect(() => {
    fit();
  }, [fit]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    saveRotation(drawingId, revision, rotation);
  }, [drawingId, revision, rotation]);

  useEffect(() => {
    setDraftLine(null);
    setPending(null);
    setSelectedId(null);
  }, [drawingId, pageNum]);

  const zoomAt = useCallback((clientX: number, clientY: number, deltaY: number, deltaMode: number) => {
    if (!scrollEl) return;

    const oldScale = scaleRef.current;
    const deltaPixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * scrollEl.clientHeight : deltaY;
    const zoomFactor = Math.min(1.5, Math.max(0.67, Math.exp(-deltaPixels * 0.001)));
    const nextScale = clamp(oldScale * zoomFactor);
    if (nextScale === oldScale) return;

    const rect = scrollEl.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    const contentX = scrollEl.scrollLeft + pointerX;
    const contentY = scrollEl.scrollTop + pointerY;
    const ratio = nextScale / oldScale;

    scaleRef.current = nextScale;
    setScale(nextScale);
    requestAnimationFrame(() => {
      scrollEl.scrollLeft = contentX * ratio - pointerX;
      scrollEl.scrollTop = contentY * ratio - pointerY;
    });
  }, [scrollEl]);

  useEffect(() => {
    if (!scrollEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY, e.deltaMode);
    };

    scrollEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", handleWheel);
  }, [scrollEl, zoomAt]);

  const switchTool = (t: Tool) => {
    setTool(t);
    setDraftLine(null);
    setPending(null);
    if (t !== "select") setSelectedId(null);
  };

  const box: RenderBox | null = size ? { width: size.width, height: size.height, rotation } : null;

  // Convert a canvas-space point to viewport (client) coordinates, so floating UI
  // (marker editor, line action bar) can be positioned with `fixed` and stay on-screen
  // regardless of zoom/scroll.
  const canvasToClient = useCallback((cx: number, cy: number) => {
    const el = canvasStackRef.current;
    if (!el) return { x: cx, y: cy };
    const r = el.getBoundingClientRect();
    return { x: r.left + cx, y: r.top + cy };
  }, []);

  const cancelLineDraft = useCallback(() => {
    setDraftLine(null);
  }, []);

  const finishLineDraft = useCallback(() => {
    if (!box || !draftLine || draftLine.length < 4) return false;
    const lastX = draftLine[draftLine.length - 2];
    const lastY = draftLine[draftLine.length - 1];
    const v = normToView(lastX, lastY, box);
    setPending({
      family: "progress",
      geomType: "line",
      geometry: draftLine,
      anchor: canvasToClient(v.x, v.y),
    });
    setDraftLine(null);
    setSelectedId(null);
    return true;
  }, [box, draftLine, canvasToClient]);

  const lineDraftAnchor = useMemo(() => {
    if (!box || !draftLine || draftLine.length < 4) return null;
    return normToView(draftLine[draftLine.length - 2], draftLine[draftLine.length - 1], box);
  }, [box, draftLine]);
  const lineDraftActionPos = useMemo(() => {
    if (!lineDraftAnchor) return null;
    const c = canvasToClient(lineDraftAnchor.x, lineDraftAnchor.y);
    return {
      x: Math.min(Math.max(8, c.x + 14), Math.max(8, window.innerWidth - LINE_ACTION_WIDTH - 8)),
      y: Math.min(Math.max(8, c.y + 14), Math.max(8, window.innerHeight - LINE_ACTION_HEIGHT - 8)),
    };
  }, [lineDraftAnchor, canvasToClient]);

  const startPan = (e: PointerEvent<HTMLDivElement>) => {
    const panByTool = tool === "pan" && (e.button === 0 || e.pointerType === "touch" || e.pointerType === "pen");
    const panByMiddleButton = e.button === 1;
    if (!panByTool && !panByMiddleButton) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      scrollLeft: e.currentTarget.scrollLeft,
      scrollTop: e.currentTarget.scrollTop,
    };
    setIsPanning(true);
  };

  const movePan = (e: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;

    e.preventDefault();
    e.currentTarget.scrollLeft = pan.scrollLeft - (e.clientX - pan.x);
    e.currentTarget.scrollTop = pan.scrollTop - (e.clientY - pan.y);
  };

  const endPan = (e: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    panRef.current = null;
    setIsPanning(false);
  };

  const handlePlace = async (screenX: number, screenY: number) => {
    if (!box || pending) return;
    const { nx, ny } = viewToNorm(screenX, screenY, box);

    if (tool === "select") {
      setSelectedId(null);
      return;
    }

    if (tool === "line") {
      setDraftLine((points) => [...(points ?? []), nx, ny]);
      return;
    }

    const family: Family = tool === "defect" ? "defect" : tool === "tag" ? "tag" : "progress";
    setPending({
      family,
      geomType: "point",
      geometry: [nx, ny],
      anchor: canvasToClient(screenX, screenY),
    });
    setSelectedId(null);
  };

  const createPending = async (payload: Record<string, unknown>) => {
    if (!pending) return;

    await place(drawingId, revision, pageNum, pending.family, pending.geomType, pending.geometry, payload);
    setPending(null);
    setDraftLine(null);
    setSelectedId(null);
  };

  const handleSelect = (id: string) => {
    setPending(null);
    setDraftLine(null);
    setSelectedId(id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (draftLine) {
          e.preventDefault();
          cancelLineDraft();
        } else if (pending) {
          e.preventDefault();
          setPending(null);
        }
      }
      if (e.key === "Enter" && tool === "line" && draftLine && draftLine.length >= 4) {
        e.preventDefault();
        finishLineDraft();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelLineDraft, draftLine, finishLineDraft, pending, tool]);

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (tool !== "line" || !draftLine) return;
    e.preventDefault();
    if (!finishLineDraft()) cancelLineDraft();
  };

  const selectedMarker = selectedId ? markers.find((m) => m.id === selectedId) ?? null : null;
  const selectedAnchor = useMemo(() => {
    if (!box || !selectedMarker) return null;
    let v: { x: number; y: number };
    if (selectedMarker.geomType === "line" && selectedMarker.geometry.length >= 4) {
      const a = normToView(selectedMarker.geometry[0], selectedMarker.geometry[1], box);
      const b = normToView(selectedMarker.geometry[2], selectedMarker.geometry[3], box);
      v = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    } else {
      v = normToView(selectedMarker.geometry[0], selectedMarker.geometry[1], box);
    }
    return canvasToClient(v.x, v.y);
  }, [box, selectedMarker, canvasToClient]);

  return (
    <div className="viewer">
      <ViewerControls
        page={pageNum}
        numPages={pdf.numPages}
        zoomPct={Math.round(scale * 100)}
        onPage={(n) => setPageNum(Math.min(pdf.numPages, Math.max(1, n)))}
        onZoomIn={() => setScale((s) => clamp(s * 1.25))}
        onZoomOut={() => setScale((s) => clamp(s * 0.8))}
        onFit={fit}
        onRotate={() => setRotation((r) => normRotation(r + 90))}
      />

      <div className="toolstrip">
        <div className="seg">
          {TOOLS.map((t) => (
            <button key={t.key} className={`seg-btn ${tool === t.key ? "active" : ""}`} onClick={() => switchTool(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <button className="seg-btn" onClick={() => void undo()}>Undo</button>
        <div className="count">
          {markers.length} marker{markers.length === 1 ? "" : "s"}
          {tool === "line" && draftLine ? ` / ${draftLine.length / 2} point${draftLine.length === 2 ? "" : "s"}` : ""}
        </div>
      </div>

      <div
        className={`canvas-scroll ${tool === "pan" ? "is-pan-tool" : ""} ${isPanning ? "is-panning" : ""}`}
        ref={setScrollEl}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onContextMenu={handleContextMenu}
      >
        {page ? (
          <div className="canvas-stack" ref={canvasStackRef}>
            <PdfCanvas page={page} scale={scale} rotation={rotation} onViewport={setSize} />
            {box && (
              <MarkerOverlay
                box={box}
                markers={markers}
                interactive={tool !== "pan" && !pending}
                selectedId={selectedId}
                draftLine={draftLine}
                pendingMarker={pending ? { geomType: pending.geomType, geometry: pending.geometry } : null}
                onPlace={(x, y) => void handlePlace(x, y)}
                onSelect={handleSelect}
              />
            )}
            {lineDraftActionPos && !pending && (
              <div className="line-draft-actions" style={{ left: lineDraftActionPos.x, top: lineDraftActionPos.y }} onPointerDown={(e) => e.stopPropagation()}>
                <button className="btn primary" onClick={finishLineDraft} type="button">Confirm</button>
                <button className="btn" onClick={cancelLineDraft} type="button">Cancel</button>
              </div>
            )}
            {box && pending && (
              <MarkerEditorPopover
                mode="create"
                family={pending.family}
                anchor={pending.anchor}
                onCreate={createPending}
                onClose={() => setPending(null)}
              />
            )}
            {box && selectedMarker && selectedAnchor && !pending && (
              <MarkerEditorPopover
                mode="edit"
                family={selectedMarker.family}
                tagId={selectedMarker.id}
                anchor={selectedAnchor}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        ) : (
          <div className="loading">Rendering...</div>
        )}
      </div>
    </div>
  );
}
