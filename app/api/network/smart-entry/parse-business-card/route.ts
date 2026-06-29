import { NextResponse } from "next/server";
import { parseBusinessCardImageToSmartDraft } from "@/lib/smart-entry-parser";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("businessCard");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Business card image is required." }, { status: 400 });
    }

    if (!isAllowedImage(file)) {
      return NextResponse.json(
        { error: "Please upload a JPG, PNG, or WebP image." },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: "Image file size must be 10 MB or less." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file);
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const draft = await parseBusinessCardImageToSmartDraft({ dataUrl, mimeType });

    return NextResponse.json({
      diagnostics:
        process.env.NODE_ENV === "development"
          ? {
              fileName: file.name,
              fileSize: file.size,
              mimeType,
            }
          : undefined,
      draft,
    });
  } catch (error) {
    console.error("Smart Entry business card parse failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Business card image could not be parsed." },
      { status: 500 },
    );
  }
}

function isAllowedImage(file: File) {
  return ALLOWED_TYPES.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function getMimeType(file: File) {
  if (ALLOWED_TYPES.has(file.type)) return file.type;
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  return "image/jpeg";
}
