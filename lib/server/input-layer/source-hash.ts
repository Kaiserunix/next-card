import { createHash } from "node:crypto";
import type { RawInputSourceType } from "@/lib/server/input-layer/types";

export type SourceHashInput = {
  sourceType: RawInputSourceType;
  text?: string;
  contentRef?: string;
  transcriptId?: string;
};

export function createSourceHash(input: SourceHashInput): string {
  const normalizedMaterial = normalizeHashMaterial(input.text ?? input.contentRef ?? input.transcriptId ?? "");
  return createHash("sha256").update(`${input.sourceType}:${normalizedMaterial}`, "utf8").digest("hex");
}

function normalizeHashMaterial(material: string): string {
  return material.trim().replace(/\s+/g, "").normalize("NFKC");
}
