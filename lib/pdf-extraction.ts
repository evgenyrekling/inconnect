export type PdfExtractionResult = {
  pageCount: number;
  characterCount: number;
  first1000Characters: string;
  fullText: string;
};

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<PdfExtractionResult> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer), { mergePages: true });
  const fullText = normalizeExtractedText(result.text);

  return {
    pageCount: result.totalPages,
    characterCount: fullText.length,
    first1000Characters: fullText.slice(0, 1000),
    fullText,
  };
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
