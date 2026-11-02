// Extracts a PDF's text in the browser (DECISIONS.md, Decision 6). The extracted
// text is what the model reads and what highlights point into, so offsets line up.
// Scanned PDFs with no text layer come back empty; the page says so.
export async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let text = "";
    for (const item of content.items) if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
    pages.push(text.trim());
  }
  return pages.join("\n\n");
}
