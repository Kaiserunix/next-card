import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractDocumentText } from "@/lib/server/input-layer/document-text-extractor";
import { createStoredDocx } from "@/tests/fixtures/document-docx";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("extractDocumentText", () => {
  it("reads UTF-8 txt files", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-document-text-"));
    const filePath = join(tempDir, "notice.txt");
    await writeFile(filePath, "今晚 20:00 前交英语作文", "utf8");

    const result = await extractDocumentText({ filePath, sourceType: "text" });

    expect(result).toMatchObject({ ok: true, sourceType: "text" });
    if (result.ok) expect(result.text).toContain("今晚 20:00 前交英语作文");
  });

  it("extracts DOCX body XML text with paragraph breaks", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-document-text-"));
    const filePath = join(tempDir, "assignment.docx");
    await writeFile(filePath, createStoredDocx("课程作业通知\n5 月 25 日 20:00 前提交实验报告"));

    const result = await extractDocumentText({ filePath, sourceType: "docx" });

    expect(result).toMatchObject({ ok: true, sourceType: "docx" });
    if (result.ok) {
      expect(result.text).toContain("课程作业通知");
      expect(result.text).toContain("5 月 25 日 20:00 前提交实验报告");
    }
  });

  it("returns a recoverable fallback for PDF when text extraction is unavailable", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-document-text-"));
    const filePath = join(tempDir, "assignment.pdf");
    await writeFile(filePath, Buffer.from("%PDF-1.4 fake"));

    const result = await extractDocumentText({ filePath, sourceType: "pdf" });

    expect(result).toMatchObject({
      ok: false,
      sourceType: "pdf",
      reason: "document_text_unavailable",
      recoverable: true,
    });
  });
});
