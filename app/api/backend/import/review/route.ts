import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import { resolveMimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";
import type { SourceType } from "@/lib/types";

export const runtime = "nodejs";
const MAX_IMPORT_BODY_BYTES = 6 * 1024 * 1024;
const MAX_RAW_TEXT_CHARS = 40_000;
const MAX_IMAGE_DATA_URL_CHARS = 5_500_000;

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "import-review", limit: 30, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<
    | {
        sourceType?: SourceType;
        rawText?: string;
        attachmentName?: string;
        imageDataUrl?: string;
        imageBase64?: string;
        imageMimeType?: string;
      }
    | null
  >(request, { label: "import review", maxBytes: MAX_IMPORT_BODY_BYTES });
  if (parsed.error) {
    return parsed.error;
  }

  const body = parsed.value;

  const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
  const imageMimeType = normalizeImageMimeType(body?.imageMimeType);
  const imageDataUrl = normalizeImageDataUrl(body?.imageDataUrl, body?.imageBase64, imageMimeType);

  if (!body || (!rawText && !imageDataUrl)) {
    return NextResponse.json({ error: "rawText or imageDataUrl is required" }, { status: 400 });
  }

  if (rawText.length > MAX_RAW_TEXT_CHARS) {
    return NextResponse.json({ error: `rawText must be ${MAX_RAW_TEXT_CHARS} characters or fewer` }, { status: 413 });
  }

  if (imageDataUrl && imageDataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
    return NextResponse.json({ error: "image data is too large" }, { status: 413 });
  }

  if ((body.imageDataUrl || body.imageBase64) && !imageDataUrl) {
    return NextResponse.json({ error: "imageDataUrl must be a base64 image data URL" }, { status: 400 });
  }

  if (!rawText && imageDataUrl && !resolveMimoProviderConfig()) {
    return NextResponse.json(
      { error: "Direct image import requires a configured multimodal provider or a rawText hint." },
      { status: 503 }
    );
  }

  try {
    const result = await backendPorts.multimodalImportParser.parseImport({
      sourceType: body.sourceType ?? (imageDataUrl ? "image" : "text"),
      rawText,
      attachmentName: normalizeAttachmentName(body.attachmentName),
      imageDataUrl,
      imageMimeType
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "multimodal import failed" },
      { status: 502 }
    );
  }
}

function normalizeImageMimeType(value: unknown) {
  return typeof value === "string" && /^image\/(?:jpeg|jpg|png|webp)$/i.test(value.trim())
    ? value.trim().toLowerCase().replace("image/jpg", "image/jpeg")
    : "image/jpeg";
}

function normalizeAttachmentName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : undefined;
}

function normalizeImageDataUrl(imageDataUrl: unknown, imageBase64: unknown, imageMimeType: string) {
  if (
    typeof imageDataUrl === "string" &&
    /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(imageDataUrl.trim())
  ) {
    return imageDataUrl.trim().replace(/^data:image\/jpg/i, "data:image/jpeg");
  }

  if (typeof imageBase64 === "string" && /^[A-Za-z0-9+/=\r\n]+$/.test(imageBase64.trim())) {
    return `data:${imageMimeType};base64,${imageBase64.trim()}`;
  }

  return undefined;
}
