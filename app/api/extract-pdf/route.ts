import { NextRequest, NextResponse } from "next/server";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction";

export const runtime = "nodejs";

const PDF_EXTRACTION_ERROR =
  "We could not extract readable text from this PDF. Please make sure it is the LinkedIn Profile PDF export, not a screenshot or scanned file.";
const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid PDF upload." }, { status: 400 });
  }

  const pdfFile = formData.get("profilePdf");

  if (!(pdfFile instanceof File)) {
    return NextResponse.json(
      { error: "LinkedIn Profile PDF is required." },
      { status: 400 },
    );
  }

  const isPdfUpload =
    pdfFile.type === "application/pdf" ||
    pdfFile.type === "application/octet-stream" ||
    pdfFile.name.toLowerCase().endsWith(".pdf") ||
    !pdfFile.type;

  if (!isPdfUpload) {
    return NextResponse.json(
      { error: "Please upload your LinkedIn Profile PDF." },
      { status: 400 },
    );
  }

  if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
    return NextResponse.json(
      { error: "PDF file size must be 5 MB or less." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const extraction = await extractPdfTextFromBuffer(buffer);
    const diagnostics = {
      fileName: pdfFile.name,
      fileSize: pdfFile.size,
      pageCount: extraction.pageCount,
      characterCount: extraction.characterCount,
      first1000Characters: extraction.first1000Characters,
    };

    if (process.env.NODE_ENV === "development") {
      console.info("INConnect /api/extract-pdf diagnostics", diagnostics);
    }

    if (extraction.characterCount < 500) {
      return NextResponse.json(
        {
          error: PDF_EXTRACTION_ERROR,
          ...extraction,
          diagnostics:
            process.env.NODE_ENV === "development" ? diagnostics : undefined,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...extraction,
      diagnostics:
        process.env.NODE_ENV === "development" ? diagnostics : undefined,
    });
  } catch (error) {
    console.error("INConnect PDF extraction failed", error);
    return NextResponse.json({ error: PDF_EXTRACTION_ERROR }, { status: 500 });
  }
}
