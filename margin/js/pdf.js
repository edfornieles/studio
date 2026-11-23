import { pageLines, removeRunningLines, linesToText, EXTRACT_VERSION } from './extract.js';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let loading = null;

function loadPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { loading = null; reject(new Error('Could not load the PDF reader. Are you online?')); };
    document.head.append(s);
  });
  return loading;
}

// Returns { pages: string[], title, emptyPages: number[] (1-based), version }.
export async function extractPdf(blob, onProgress) {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await lib.getDocument({ data }).promise;
  let title = '';
  try { title = String((await pdf.getMetadata())?.info?.Title || '').trim(); } catch { /* no metadata */ }
  const all = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    all.push(pageLines(content.items, page.view));
    page.cleanup();
    onProgress?.(i, pdf.numPages);
  }
  await pdf.destroy();
  const pages = removeRunningLines(all).map(linesToText);
  const emptyPages = [];
  pages.forEach((p, i) => { if (!p.trim()) emptyPages.push(i + 1); });
  return { pages, title, emptyPages, version: EXTRACT_VERSION };
}
