import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { TagState } from "../domain/types";
import { colorForTag, markerBadge } from "../domain/catalog";
import { normToView, type RenderBox } from "./coords";

export interface MarkerOverlayProps {
  box: RenderBox;
  markers: TagState[];
  interactive: boolean;
  selectedId: string | null;
  draftLine: number[] | null;
  pendingMarker: { geomType: TagState["geomType"]; geometry: number[] } | null;
  onPlace: (screenX: number, screenY: number) => void;
  onSelect: (id: string) => void;
}

function linePoints(geometry: number[], box: RenderBox): string {
  const points: string[] = [];
  for (let i = 0; i + 1 < geometry.length; i += 2) {
    const p = normToView(geometry[i], geometry[i + 1], box);
    points.push(`${p.x},${p.y}`);
  }
  return points.join(" ");
}

function lineVertices(geometry: number[], box: RenderBox): { x: number; y: number }[] {
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < geometry.length; i += 2) {
    vertices.push(normToView(geometry[i], geometry[i + 1], box));
  }
  return vertices;
}

function MarkerShape({ m, box, selected, onSelect }: { m: TagState; box: RenderBox; selected: boolean; onSelect: (id: string) => void }) {
  const color = colorForTag(m);
  const badge = markerBadge(m);
  const pick = (e: ReactPointerEvent<SVGGElement> | ReactMouseEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(m.id);
  };

  if (m.geomType === "line" && m.geometry.length >= 4) {
    const vertices = lineVertices(m.geometry, box);
    const points = linePoints(m.geometry, box);
    return (
      <g onPointerDown={pick} onMouseDown={pick}>
        <polyline points={points} fill="none" stroke="transparent" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={points} fill="none" stroke={color} strokeWidth={selected ? 6 : 4} strokeLinecap="round" strokeLinejoin="round" />
        {vertices.map((p, i) => (
          <circle key={`${p.x}-${p.y}-${i}`} cx={p.x} cy={p.y} r={5} fill={color} stroke="#fff" strokeWidth={2} />
        ))}
      </g>
    );
  }

  const p = normToView(m.geometry[0], m.geometry[1], box);
  const r = selected ? 13 : 11;
  return (
    <g onPointerDown={pick} onMouseDown={pick}>
      <circle
        cx={p.x}
        cy={p.y}
        r={r}
        fill={color}
        stroke={selected ? "#0b2545" : "#fff"}
        strokeWidth={selected ? 3 : 2}
        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.45))"
      />
      {badge ? (
        <text
          x={p.x}
          y={p.y}
          fill="#fff"
          fontSize={badge.length > 1 ? 9 : 12}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
          pointerEvents="none"
        >
          {badge}
        </text>
      ) : (
        <circle cx={p.x} cy={p.y} r={3} fill="#fff" pointerEvents="none" />
      )}
    </g>
  );
}

function PendingMarker({ marker, box }: { marker: NonNullable<MarkerOverlayProps["pendingMarker"]>; box: RenderBox }) {
  if (marker.geomType === "line" && marker.geometry.length >= 4) {
    const vertices = lineVertices(marker.geometry, box);
    return (
      <g opacity={0.75} pointerEvents="none">
        <polyline points={linePoints(marker.geometry, box)} fill="none" stroke="#1b6ec2" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 5" />
        {vertices.map((p, i) => (
          <circle key={`${p.x}-${p.y}-${i}`} cx={p.x} cy={p.y} r={6} fill="#1b6ec2" stroke="#fff" strokeWidth={2} />
        ))}
      </g>
    );
  }

  const p = normToView(marker.geometry[0], marker.geometry[1], box);
  return (
    <g opacity={0.75} pointerEvents="none">
      <circle cx={p.x} cy={p.y} r={13} fill="#1b6ec2" stroke="#fff" strokeWidth={3} strokeDasharray="5 3" />
      <circle cx={p.x} cy={p.y} r={4} fill="#fff" />
    </g>
  );
}

export function MarkerOverlay({ box, markers, interactive, selectedId, draftLine, pendingMarker, onPlace, onSelect }: MarkerOverlayProps) {
  const lastPlaceRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const touchIdsRef = useRef<Set<number>>(new Set());
  const touchTapRef = useRef<{ pointerId: number; x: number; y: number; target: SVGSVGElement } | null>(null);

  useEffect(() => {
    const clearTouch = (e: PointerEvent) => {
      touchIdsRef.current.delete(e.pointerId);
      if (touchTapRef.current?.pointerId === e.pointerId) touchTapRef.current = null;
      if (touchIdsRef.current.size === 0) touchIdsRef.current.clear();
    };

    window.addEventListener("pointerup", clearTouch);
    window.addEventListener("pointercancel", clearTouch);
    return () => {
      window.removeEventListener("pointerup", clearTouch);
      window.removeEventListener("pointercancel", clearTouch);
    };
  }, []);

  const placeAt = (clientX: number, clientY: number, target: SVGSVGElement) => {
    const now = Date.now();
    const last = lastPlaceRef.current;
    if (last && now - last.at < 80 && Math.abs(last.x - clientX) < 1 && Math.abs(last.y - clientY) < 1) return;
    lastPlaceRef.current = { x: clientX, y: clientY, at: now };

    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * box.width;
    const y = ((clientY - rect.top) / rect.height) * box.height;
    onPlace(x, y);
  };

  const place = (e: ReactPointerEvent<SVGSVGElement> | ReactMouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;

    if ("pointerType" in e && e.pointerType === "touch") {
      touchIdsRef.current.add(e.pointerId);
      touchTapRef.current = touchIdsRef.current.size === 1 ? { pointerId: e.pointerId, x: e.clientX, y: e.clientY, target: e.currentTarget } : null;
      return;
    }

    placeAt(e.clientX, e.clientY, e.currentTarget);
  };

  const moveTouch = (e: ReactPointerEvent<SVGSVGElement>) => {
    const tap = touchTapRef.current;
    if (e.pointerType !== "touch" || !tap || tap.pointerId !== e.pointerId) return;
    if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) touchTapRef.current = null;
  };

  const endTouch = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    const tap = touchTapRef.current;
    touchIdsRef.current.delete(e.pointerId);
    if (tap && tap.pointerId === e.pointerId && touchIdsRef.current.size === 0) {
      placeAt(e.clientX, e.clientY, tap.target);
    }
    if (tap?.pointerId === e.pointerId) touchTapRef.current = null;
  };

  const cancelTouch = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    touchIdsRef.current.delete(e.pointerId);
    if (touchTapRef.current?.pointerId === e.pointerId) touchTapRef.current = null;
  };

  const draftVertices = draftLine ? lineVertices(draftLine, box) : [];

  return (
    <div className="overlay" style={{ width: box.width, height: box.height, pointerEvents: interactive ? "auto" : "none" }}>
      <svg
        className="marker-svg"
        width={box.width}
        height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
      onPointerDown={place}
      onPointerMove={moveTouch}
      onPointerUp={endTouch}
      onPointerCancel={cancelTouch}
      onMouseDown={place}
      style={{ cursor: interactive ? "crosshair" : "default" }}
      >
        {markers.map((m) => (
          <MarkerShape key={m.id} m={m} box={box} selected={m.id === selectedId} onSelect={onSelect} />
        ))}
        {pendingMarker && <PendingMarker marker={pendingMarker} box={box} />}
        {draftLine && draftLine.length >= 4 && (
          <polyline points={linePoints(draftLine, box)} fill="none" stroke="#1b6ec2" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" pointerEvents="none" />
        )}
        {draftVertices.map((p, i) => (
          <circle key={`${p.x}-${p.y}-${i}`} cx={p.x} cy={p.y} r={6} fill={i === draftVertices.length - 1 ? "#1b6ec2" : "#fff"} stroke="#1b6ec2" strokeWidth={2} pointerEvents="none" />
        ))}
      </svg>
    </div>
  );
}
