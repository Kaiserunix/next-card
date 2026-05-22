import { inflateRawSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { RawInputSourceType } from "@/lib/server/input-layer/types";

export type DocumentTextSourceType = Extract<RawInputSourceType, "text" | "pdf" | "docx">;

export type DocumentTextExtractionResult =
  | {
      ok: true;
      sourceType: DocumentTextSourceType;
      text: string;
      bytesRead: number;
      warnings: string[];
    }
  | {
      ok: false;
      sourceType: DocumentTextSourceType;
      reason: "document_text_unavailable" | "document_too_large" | "unsupported_document_type";
      message: string;
      bytesRead?: number;
      recoverable: true;
    };

export type ExtractDocumentTextInput = {
  filePath: string;
  sourceType: DocumentTextSourceType;
  maxBytes?: number;
  maxTextLength?: number;
};

const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_TEXT_LENGTH = 50_000;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

export async function extractDocumentText(input: ExtractDocumentTextInput): Promise<DocumentTextExtractionResult> {
  const buffer = await readFile(input.filePath);
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxTextLength = input.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;

  if (buffer.byteLength > maxBytes) {
    return {
      ok: false,
      sourceType: input.sourceType,
      reason: "document_too_large",
      message: `Document exceeds the ${maxBytes} byte P0 extraction limit.`,
      bytesRead: buffer.byteLength,
      recoverable: true,
    };
  }

  if (input.sourceType === "text" || extname(input.filePath).toLowerCase() === ".txt") {
    return {
      ok: true,
      sourceType: "text",
      text: limitText(buffer.toString("utf8"), maxTextLength),
      bytesRead: buffer.byteLength,
      warnings: [],
    };
  }

  if (input.sourceType === "docx") {
    const documentXml = extractZipEntry(buffer, "word/document.xml");
    if (!documentXml) {
      return unavailable(input.sourceType, "DOCX body text was not found.", buffer.byteLength);
    }

    const text = xmlBodyToText(documentXml.toString("utf8"));
    if (!text.trim()) {
      return unavailable(input.sourceType, "DOCX body text is empty.", buffer.byteLength);
    }

    return {
      ok: true,
      sourceType: "docx",
      text: limitText(text, maxTextLength),
      bytesRead: buffer.byteLength,
      warnings: [],
    };
  }

  if (input.sourceType === "pdf") {
    return unavailable("pdf", "PDF text extraction dependency is not available in the P0 runtime.", buffer.byteLength);
  }

  return {
    ok: false,
    sourceType: input.sourceType,
    reason: "unsupported_document_type",
    message: `Unsupported document source type: ${input.sourceType}.`,
    bytesRead: buffer.byteLength,
    recoverable: true,
  };
}

function unavailable(
  sourceType: DocumentTextSourceType,
  message: string,
  bytesRead: number,
): DocumentTextExtractionResult {
  return {
    ok: false,
    sourceType,
    reason: "document_text_unavailable",
    message,
    bytesRead,
    recoverable: true,
  };
}

function limitText(text: string, maxTextLength: number): string {
  return text.replace(/\u0000/g, "").slice(0, maxTextLength);
}

function extractZipEntry(buffer: Buffer, entryName: string): Buffer | null {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) return null;

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end && offset + 46 <= buffer.byteLength) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) return null;

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (fileName === entryName) {
      return readLocalEntry(buffer, localHeaderOffset, compressionMethod, compressedSize);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function readLocalEntry(
  buffer: Buffer,
  localHeaderOffset: number,
  compressionMethod: number,
  compressedSize: number,
): Buffer | null {
  if (localHeaderOffset + 30 > buffer.byteLength || buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
    return null;
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) return Buffer.from(compressed);
  if (compressionMethod === 8) return inflateRawSync(compressed);
  return null;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.byteLength - 65_557);
  for (let offset = buffer.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  return -1;
}

function xmlBodyToText(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:p\b[^>]*>/g, "")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
