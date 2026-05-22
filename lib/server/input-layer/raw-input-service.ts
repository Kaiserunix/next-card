import { randomUUID } from "node:crypto";
import { createSourceHash } from "@/lib/server/input-layer/source-hash";
import type { RawInput, PrivacyFlag } from "@/lib/server/input-layer/types";
import type { RawInputRepository } from "@/lib/server/input-layer/raw-input-repository";

export type CreateRawInputCommand = {
  sourceType: RawInput["sourceType"];
  text?: string;
  transcriptId?: string;
  contentRef?: string;
  anonymousDeviceId?: string;
  userId?: string;
  locale?: RawInput["locale"];
  timezone?: string;
  receivedAt?: string;
};

export type CreateRawInputResult = {
  rawInput: RawInput;
  duplicateOf?: string;
  acceptedForExtraction: boolean;
};

const FILE_LIKE_SOURCES = new Set<RawInput["sourceType"]>(["image", "pdf", "docx"]);

export async function createRawInput(
  command: CreateRawInputCommand,
  repository: RawInputRepository,
): Promise<CreateRawInputResult> {
  const receivedAt = command.receivedAt ?? new Date().toISOString();
  const sourceHash = createSourceHash(command);
  const duplicate = await repository.findDuplicateForSameDay({
    anonymousDeviceId: command.anonymousDeviceId,
    userId: command.userId,
    sourceHash,
    yyyyMmDd: receivedAt.slice(0, 10),
  });

  if (duplicate) {
    return {
      rawInput: duplicate,
      duplicateOf: duplicate.id,
      acceptedForExtraction: false,
    };
  }

  const rawInput: RawInput = {
    id: `raw_${randomUUID()}`,
    userId: command.userId,
    anonymousDeviceId: command.anonymousDeviceId,
    sourceType: command.sourceType,
    contentRef: command.contentRef,
    text: command.text,
    transcriptId: command.transcriptId,
    sourceHash,
    locale: command.locale ?? inferLocale(command.text),
    timezone: command.timezone,
    createdAt: receivedAt,
    receivedAt,
    privacyFlags: inferPrivacyFlags(command),
    retentionPolicy: {
      rawRetentionDays: FILE_LIKE_SOURCES.has(command.sourceType) ? 14 : 7,
      derivedRetentionDays: 30,
      userDeletable: true,
    },
  };

  await repository.save(rawInput);

  return {
    rawInput,
    acceptedForExtraction: true,
  };
}

export function isVoiceLikeRawInput(rawInput: RawInput): boolean {
  return rawInput.sourceType === "voice" || rawInput.sourceType === "manual-dictation";
}

function inferLocale(text = ""): RawInput["locale"] {
  if (!text.trim()) return "auto";
  const hasCjk = /[\u3400-\u9fff]/.test(text);
  const hasLatin = /[a-z]/i.test(text);
  if (hasCjk && hasLatin) return "mixed";
  return hasCjk ? "zh-CN" : "en";
}

function inferPrivacyFlags(command: CreateRawInputCommand): PrivacyFlag[] {
  const flags = new Set<PrivacyFlag>();
  const text = command.text ?? "";

  if (FILE_LIKE_SOURCES.has(command.sourceType)) flags.add("unknown");
  if (/(老师|同学|班级|辅导员|教授|张|李|王).{0,8}(老师|同学)?/.test(text)) flags.add("contains_third_party_info");
  if (/\b\d{8,14}\b/.test(text) || /学号/.test(text)) flags.add("contains_student_id");
  if (/(成绩|分数|绩点|排名|GPA)/i.test(text)) flags.add("contains_grade_info");
  if (/(校区|教室|一教|二教|三教|楼|宿舍|图书馆|室|地址|到).{0,8}\d{2,4}/.test(text)) {
    flags.add("contains_location");
  }

  return [...flags];
}
