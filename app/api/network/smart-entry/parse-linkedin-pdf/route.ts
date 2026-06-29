import { NextResponse } from "next/server";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction";
import { parseLinkedInPdfTextToSmartDraft } from "@/lib/smart-entry-parser";

export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("profilePdf");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "LinkedIn profile PDF is required." }, { status: 400 });
    }

    if (!isPdf(file)) {
      return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json({ error: "PDF file size must be 10 MB or less." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractPdfTextFromBuffer(buffer);
    if (extraction.characterCount < 200) {
      return NextResponse.json(
        {
          error:
            "Could not extract enough readable text from this PDF. Please upload the LinkedIn profile PDF export, not a screenshot.",
        },
        { status: 400 },
      );
    }

    const draft = await parseLinkedInPdfTextToSmartDraft(extraction.fullText);
    return NextResponse.json({
      diagnostics:
        process.env.NODE_ENV === "development"
          ? {
              characterCount: extraction.characterCount,
              fileName: file.name,
              pageCount: extraction.pageCount,
            }
          : undefined,
      draft,
    });
  } catch (error) {
    console.error("Smart Entry LinkedIn PDF parse failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "LinkedIn PDF could not be parsed." },
      { status: 500 },
    );
  }
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.type === "application/octet-stream" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}
