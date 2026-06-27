import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
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

  const place = (e: ReactPointerEvent<SVGSVGElement> | ReactMouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const now = Date.now();
    const last = lastPlaceRef.current;
    if (last && now - last.at < 80 && Math.abs(last.x - e.clientX) < 1 && Math.abs(last.y - e.clientY) < 1) return;
    lastPlaceRef.current = { x: e.clientX, y: e.clientY, at: now };

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * box.width;
    const y = ((e.clientY - rect.top) / rect.height) * box.height;
    onPlace(x, y);
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
