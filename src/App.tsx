import { useEffect, useState } from "react";
import { loadPdf, type LoadedPdf } from "./pdf/pdfDocument";
import { DrawingViewer } from "./viewer/DrawingViewer";
import { useApp } from "./state/store";

interface DrawingMeta { id: string; revision: string; title: string; drawingNo: string }

const SAMPLE_FILE_NAME = "MF Revised Equipment Layout & Opening Drawing  with MB (30-9-2020).pdf";
const SAMPLE_TITLE = "MF Revised Equipment Layout & Opening Drawing with MB";

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function slugPart(name: string, maxLength = 48): string {
  return baseName(name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, maxLength) || "drawing";
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  let hash = 2166136261;
  for (const b of new Uint8Array(data)) {
    hash ^= b;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function drawingMetaForPdf(fileName: string, data: ArrayBuffer, revision = "—", title = fileName): Promise<DrawingMeta> {
  const slug = slugPart(fileName);
  const hash = (await sha256Hex(data)).slice(0, 16);
  return {
    id: `pdf_${slug}_${data.byteLength}_${hash}`,
    revision,
    title,
    drawingNo: slug,
  };
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
      await app.ensureDrawing(meta.id, { drawingNo: meta.drawingNo, title: meta.title, revision: meta.revision, page: 1 });
      setPdf(loaded);
      setDrawing(meta);
    } catch (e) {
      setError(`Could not open PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    const data = await file.arrayBuffer();
    open(data, await drawingMetaForPdf(file.name, data, "—", file.name));
  }

  async function loadSample() {
    try {
      setBusy(true);
      const res = await fetch("sample.pdf");
      if (!res.ok) throw new Error("sample not found");
      const data = await res.arrayBuffer();
      await open(data, await drawingMetaForPdf(SAMPLE_FILE_NAME, data, "30-9-2020", SAMPLE_TITLE));
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
          <DrawingViewer key={`${drawing.id}:${drawing.revision}`} pdf={pdf} drawingId={drawing.id} revision={drawing.revision} />
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
