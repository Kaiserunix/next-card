import { ImportReviewService } from "@/lib/server/import-review/import-review-service";
import type { ImportReviewClientContext } from "@/lib/server/import-review/types";
import type { RawInputSourceType } from "@/lib/server/input-layer/types";

export const runtime = "nodejs";

const SOURCE_TYPES: RawInputSourceType[] = ["voice", "manual-dictation", "text", "image", "pdf", "docx", "notification", "mixed"];

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const sourceType = readSourceType(form.get("sourceType"));
    const clientContext = parseClientContext(form.get("clientContext"));
    const file = readFile(form.get("file"));
    const service = new ImportReviewService();
    const report = await service.review({
      sourceType,
      text: readOptionalString(form.get("text")),
      file,
      clientContext,
      sandboxMode: readBoolean(form.get("sandboxMode")),
    });

    return Response.json(report);
  } catch (error) {
    return Response.json(
      {
        error: "IMPORT_REVIEW_FAILED",
        recoverable: true,
        message: sanitizeError(error),
      },
      { status: error instanceof InvalidImportRequestError ? 400 : 500 },
    );
  }
}

class InvalidImportRequestError extends Error {}

function readSourceType(value: FormDataEntryValue | null): RawInputSourceType {
  const sourceType = typeof value === "string" ? value : "";
  if (!SOURCE_TYPES.includes(sourceType as RawInputSourceType)) {
    throw new InvalidImportRequestError("sourceType must be text, manual-dictation, notification, image, pdf, docx, voice, or mixed.");
  }
  return sourceType as RawInputSourceType;
}

function parseClientContext(value: FormDataEntryValue | null): ImportReviewClientContext | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value) as ImportReviewClientContext;
    return {
      now: typeof parsed.now === "string" ? parsed.now : undefined,
      timezone: typeof parsed.timezone === "string" ? parsed.timezone : undefined,
      locale: parsed.locale,
      anonymousDeviceId: typeof parsed.anonymousDeviceId === "string" ? parsed.anonymousDeviceId : undefined,
      userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
    };
  } catch {
    throw new InvalidImportRequestError("clientContext must be valid JSON.");
  }
}

function readFile(value: FormDataEntryValue | null): File | undefined {
  if (!value || typeof value === "string") return undefined;
  return value;
}

function readOptionalString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") return true;
  return value !== "false";
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/tp-[A-Za-z0-9._-]+/g, "tp-[redacted]")
    .slice(0, 300);
}
