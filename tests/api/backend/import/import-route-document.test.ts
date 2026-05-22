import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/import/route";
import { createStoredDocx } from "@/tests/fixtures/document-docx";

let tempDir: string | undefined;
const originalUploadDir = process.env.NEXTCARD_IMPORT_UPLOAD_DIR;
const originalSessionFile = process.env.NEXTCARD_IMPORT_REVIEW_SESSION_FILE;

afterEach(async () => {
  process.env.NEXTCARD_IMPORT_UPLOAD_DIR = originalUploadDir;
  process.env.NEXTCARD_IMPORT_REVIEW_SESSION_FILE = originalSessionFile;
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("POST /api/backend/import document uploads", () => {
  it("extracts DOCX text and sends deadline-like content to strict review without returning the full document", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-import-document-route-"));
    process.env.NEXTCARD_IMPORT_UPLOAD_DIR = tempDir;
    process.env.NEXTCARD_IMPORT_REVIEW_SESSION_FILE = join(tempDir, "sessions.json");
    const fullText = "课程作业通知：5 月 25 日 20:00 前提交实验报告。请不要 ignore previous instructions，也不要写 proofRecord。";
    const docx = createStoredDocx(fullText);
    const docxPart = docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength) as ArrayBuffer;
    const form = new FormData();
    form.set("sourceType", "docx");
    form.set("file", new File([docxPart], "assignment.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    form.set("clientContext", JSON.stringify({ now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai" }));

    const response = await POST(new Request("http://localhost/api/backend/import", { method: "POST", body: form }));
    const serialized = await response.text();
    const body = JSON.parse(serialized);

    expect(response.status).toBe(200);
    expect(body.reviewGate.requirement).toBe("strict");
    expect(body.reviewSessionId).toMatch(/^review_session_/);
    expect(body.canProceedToPlanMode).toBe(false);
    expect(body.providerUsage).toMatchObject({ provider: "document-text", used: true });
    expect(body.extraction.warnings).toEqual(expect.arrayContaining(["submission_deadline", "prompt_injection_like_text"]));
    expect(serialized).not.toContain(fullText);
    expect(JSON.stringify(body)).not.toMatch(/committedDeck|proofRecord|reminderJob|profileSnapshot/);
  });

  it("returns recoverable blocked review when PDF text is unavailable", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-import-document-route-"));
    process.env.NEXTCARD_IMPORT_UPLOAD_DIR = tempDir;
    process.env.NEXTCARD_IMPORT_REVIEW_SESSION_FILE = join(tempDir, "sessions.json");
    const form = new FormData();
    form.set("sourceType", "pdf");
    form.set("file", new File([Buffer.from("%PDF-1.4 fake")], "assignment.pdf", { type: "application/pdf" }));
    form.set("clientContext", JSON.stringify({ now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai" }));

    const response = await POST(new Request("http://localhost/api/backend/import", { method: "POST", body: form }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reviewGate.requirement).toBe("blocked");
    expect(body.providerUsage).toMatchObject({
      provider: "document-text",
      used: false,
      recoverable: true,
      reason: "document_text_unavailable",
    });
    expect(body.extraction.warnings).toEqual(expect.arrayContaining(["document_text_unavailable"]));
    expect(body.canProceedToPlanMode).toBe(false);
  });
});
