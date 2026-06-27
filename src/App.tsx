import { useEffect, useState } from "react";
import { loadPdf, type LoadedPdf } from "./pdf/pdfDocument";
import { DrawingViewer } from "./viewer/DrawingViewer";
import { useApp } from "./state/store";

interface DrawingMeta { id: string; revision: string; title: string }

function slugId(name: string): string {
  return (
    name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "drawing"
  );
}

export function App() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [drawing, setDrawing] = useState<DrawingMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const init = useApp((s) => s.init);
  useEffect(() => { void init(); }, [init]);

  async function open(data: ArrayBuffer, meta: DrawingMeta) {
    setBusy(true);
    setError(null);
    try {
      pdf?.destroy();
      const loaded = await loadPdf(data);
      const app = useApp.getState();
      await app.init();
      await app.ensureDrawing(meta.id, { drawingNo: meta.id, title: meta.title, revision: meta.revision, page: 1 });
      setPdf(loaded);
      setDrawing(meta);
    } catch (e) {
      setError(`Could not open PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    open(await file.arrayBuffer(), { id: slugId(file.name), revision: "—", title: file.name });
  }

  async function loadSample() {
    try {
      setBusy(true);
      const res = await fetch("sample.pdf");
      if (!res.ok) throw new Error("sample not found");
      await open(await res.arrayBuffer(), { id: "sample", revision: "—", title: "Sample drawing (Equipment Layout)" });
    } catch (e) {
      setError(`Sample unavailable: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          DuctManage <span className="zh">風喉進度</span>
        </div>
        <div className="spacer" />
        {drawing && <div className="dwg-name" title={drawing.title}>{drawing.title}</div>}
        <label className="btn primary">
          Open PDF
          <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </header>

      <main className="main">
        {error && <div className="banner error">{error}</div>}
        {busy && !pdf && <div className="banner">Loading…</div>}
        {pdf && drawing ? (
          <DrawingViewer pdf={pdf} drawingId={drawing.id} revision={drawing.revision} />
        ) : (
          <div className="empty">
            <h1>Open an air-duct layout drawing</h1>
            <p className="muted">Local-first · works offline · nothing is uploaded.</p>
            <div className="empty-actions">
              <label className="btn primary lg">
                Open a PDF…
                <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
              <button className="btn lg" onClick={loadSample} disabled={busy}>Load sample drawing</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
