// Glove-friendly viewer toolbar: page nav, zoom, fit, rotate. Large touch targets.

export interface ViewerControlsProps {
  page: number;
  numPages: number;
  zoomPct: number;
  onPage: (n: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRotate: () => void;
}

export function ViewerControls(props: ViewerControlsProps) {
  const { page, numPages, zoomPct, onPage, onZoomIn, onZoomOut, onFit, onRotate } = props;
  return (
    <div className="controls">
      <div className="group">
        <button className="ctl" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">‹</button>
        <span className="readout">{page} / {numPages}</span>
        <button className="ctl" onClick={() => onPage(page + 1)} disabled={page >= numPages} aria-label="Next page">›</button>
      </div>
      <div className="group">
        <button className="ctl" onClick={onZoomOut} aria-label="Zoom out">−</button>
        <span className="readout">{zoomPct}%</span>
        <button className="ctl" onClick={onZoomIn} aria-label="Zoom in">+</button>
        <button className="ctl" onClick={onFit} aria-label="Fit to width">Fit</button>
        <button className="ctl" onClick={onRotate} aria-label="Rotate 90°">⟳</button>
      </div>
    </div>
  );
}
