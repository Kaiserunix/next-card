import { describe, expect, it } from "vitest";
import { createImportReview } from "@/lib/server/import-coverage";

describe("large import coverage review", () => {
  it("requires review for timetable imports and deals only the first one or two top-level cards", () => {
    const result = createImportReview({
      sourceType: "image",
      rawText: [
        "周一 08:00 高数 二教304",
        "周一 10:00 大学英语 三教201",
        "周二 14:00 物理实验 实验楼B201",
        "周五 20:00 课程报告截止"
      ].join("\n")
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.topLevelCards).toHaveLength(4);
    expect(result.dealNowCards.length).toBeLessThanOrEqual(2);
    expect(result.hiddenBacklogCards).toHaveLength(2);
    expect(result.coverageChecks).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "timetable-line-count", passed: true })])
    );
  });

  it("flags likely omissions so the user must inspect the generated card list once", () => {
    const result = createImportReview({
      sourceType: "attachment",
      rawText: "通知：明天 08:00 高数。另有晚自习和作业提醒见附件末尾。"
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.possibleOmissions.join(" ")).toContain("另有");
    expect(result.userReviewPrompt).toContain("检阅");
  });

  it("detects duplicate or conflicting time slots before cards enter the queue", () => {
    const result = createImportReview({
      sourceType: "mixed",
      rawText: "周一 08:00 高数 二教304\n周一 08:00 英语 三教201"
    });

    expect(result.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "same-time-conflict", timeLabel: "周一 08:00" })])
    );
    expect(result.reviewRequired).toBe(true);
  });
});
