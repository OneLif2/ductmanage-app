// Thin wrapper around PDF.js. Loading a drawing returns a small handle the viewer uses.
import * as pdfjsLib from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
// Vite resolves the worker to a URL and bundles it (local-first, no CDN).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface LoadedPdf {
  numPages: number;
  getPage(n: number): Promise<PDFPageProxy>;
  destroy(): Promise<void>;
}

export async function loadPdf(data: ArrayBuffer): Promise<LoadedPdf> {
  // PDF.js may detach the buffer; clone so the caller's ArrayBuffer stays usable.
  const task = pdfjsLib.getDocument({ data: data.slice(0) });
  const doc = await task.promise;
  return {
    numPages: doc.numPages,
    getPage: (n: number) => doc.getPage(n),
    destroy: () => doc.destroy(),
  };
}
