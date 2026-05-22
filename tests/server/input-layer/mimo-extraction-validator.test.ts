import { describe, expect, it } from "vitest";
import {
  MimoExtractionSchemaError,
  parseAndValidateMimoExtraction,
} from "@/lib/server/input-layer/mimo-extraction-validator";
import type { RawInput } from "@/lib/server/input-layer/types";

describe("parseAndValidateMimoExtraction", () => {
  it("maps valid MiMo course-schedule JSON into input-layer extraction candidates", () => {
    const result = parseAndValidateMimoExtraction(
      JSON.stringify({
        sourceKind: "courseSchedule",
        extractedEvents: [
          {
            title: "高数",
            day: "周一",
            time: "08:00-09:30",
            location: "三教201",
            confidence: 0.91,
            evidence: {
              quote: "周一 08:00-09:30 高数 三教201",
              boundingBox: { x: 12, y: 20, width: 200, height: 48 },
            },
          },
        ],
        extractedTimes: [{ label: "周一 08:00-09:30", kind: "hard-lock", confidence: 0.9 }],
        extractedLocations: [{ name: "三教201", confidence: 0.88 }],
        warnings: [],
        needsStrictReview: true,
      }),
      rawInput(),
      "model_run_1",
    );

    expect(result.modelRunId).toBe("model_run_1");
    expect(result.reviewRequirement).toBe("strict");
    expect(result.warnings).toEqual(expect.arrayContaining(["high_risk_multimodal", "course_time"]));
    expect(result.candidates.tasks[0]).toMatchObject({
      title: "去高数课",
      taskType: "course-arrival",
      lifecycle: "fixed-recurring",
    });
    expect(result.candidates.timeConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "hard-lock", label: "周一 08:00-09:30", isHard: true }),
      ]),
    );
    expect(result.evidence[0]).toMatchObject({
      rawInputId: "raw_image_1",
      quote: "周一 08:00-09:30 高数 三教201",
      confidence: 0.91,
    });
  });

  it("rejects provider JSON that omits needsStrictReview", () => {
    expect(() =>
      parseAndValidateMimoExtraction(
        JSON.stringify({
          sourceKind: "courseSchedule",
          extractedEvents: [],
          extractedTimes: [],
          extractedLocations: [],
          warnings: [],
        }),
        rawInput(),
      ),
    ).toThrow(MimoExtractionSchemaError);
  });

  it("extracts JSON from provider content wrapped in explanatory text", () => {
    const result = parseAndValidateMimoExtraction(
      [
        "下面是抽取结果：",
        "```json",
        JSON.stringify({
          sourceKind: "courseSchedule",
          extractedEvents: [{ title: "高数", day: "周一", time: "08:00-09:30", location: "三教201" }],
          extractedTimes: [],
          extractedLocations: [],
          warnings: [],
          needsStrictReview: true,
        }),
        "```",
      ].join("\n"),
      rawInput(),
    );

    expect(result.reviewRequirement).toBe("strict");
    expect(result.candidates.tasks[0]?.title).toBe("去高数课");
  });
});

function rawInput(): RawInput {
  return {
    id: "raw_image_1",
    sourceType: "image",
    contentRef: "upload://timetable.jpg",
    sourceHash: "a".repeat(64),
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    createdAt: "2026-05-22T08:00:00.000Z",
    receivedAt: "2026-05-22T08:00:00.000Z",
    privacyFlags: ["unknown"],
    retentionPolicy: {
      rawRetentionDays: 14,
      derivedRetentionDays: 30,
      userDeletable: true,
    },
  };
}
