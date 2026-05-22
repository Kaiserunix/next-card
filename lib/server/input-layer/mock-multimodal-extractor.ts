import type { MultimodalExtractionPort } from "@/lib/server/input-layer/multimodal-port";
import { evaluateMultimodalRisk } from "@/lib/server/input-layer/multimodal-risk-rules";
import type { InputExtractionResult, InputWarning, RawInput } from "@/lib/server/input-layer/types";

export class MockMultimodalExtractor implements MultimodalExtractionPort {
  readonly provider = "mock" as const;

  async extract(input: RawInput): Promise<InputExtractionResult> {
    const text = input.text ?? input.contentRef ?? "";
    const warnings: InputWarning[] = [];
    const result: InputExtractionResult = {
      id: `extract_${input.id}`,
      rawInputId: input.id,
      candidates: {
        tasks: [],
        timeConstraints: [],
        locations: [],
        courses: [],
        reminders: [],
      },
      confidence: 0.72,
      ambiguities: [],
      warnings,
      evidence: [],
      reviewRequirement: "light",
    };

    if (/ignore previous instructions|delete reminders|mark this task complete/i.test(text)) {
      result.warnings.push("prompt_injection_like_text");
      result.confidence = 0.45;
    }

    if (/高数|课表|timetable/i.test(text) || input.sourceType === "image") {
      result.candidates.tasks.push({
        id: "task_course_calculus",
        title: "去高数课",
        taskType: "course-arrival",
        confidence: 0.7,
        lifecycle: "fixed-recurring",
      });
      result.candidates.courses.push({ id: "course_calculus", courseName: "高数", confidence: 0.72 });
      result.candidates.timeConstraints.push({
        id: "time_course_calculus",
        kind: "hard-lock",
        label: /10[:：]00/.test(text) ? "周一 10:00" : "周一 8:00",
        isHard: true,
        confidence: 0.66,
      });
      result.evidence.push({
        rawInputId: input.id,
        page: 1,
        boundingBox: { x: 120, y: 80, width: 240, height: 60 },
        quote: /10[:：]00/.test(text) ? "周一 10:00 高数" : "周一 8:00 高数",
        confidence: 0.66,
      });
      result.warnings.push("course_time");
    }

    if (/作文|作业|提交|报告/.test(text) && (input.sourceType === "pdf" || input.sourceType === "docx")) {
      result.candidates.tasks.push({
        id: "task_assignment",
        title: /作文/.test(text) ? "交英语作文" : "交课程作业",
        taskType: "assignment",
        confidence: 0.86,
        lifecycle: "one-off",
      });
      result.candidates.timeConstraints.push({
        id: "time_assignment_deadline",
        kind: "deadline",
        label: extractDeadlineLabel(text) ?? "提交截止",
        isHard: true,
        confidence: 0.86,
      });
      result.evidence.push({
        rawInputId: input.id,
        page: 1,
        quote: extractDeadlineEvidence(text),
        confidence: 0.86,
      });
      result.warnings.push("submission_deadline");
    }

    if (input.sourceType === "notification" && /明天|后天|下周/.test(text)) {
      result.candidates.tasks.push({
        id: "task_notification",
        title: /报告/.test(text) ? "交实验报告" : "处理通知任务",
        taskType: "assignment",
        confidence: 0.74,
        lifecycle: "one-off",
      });
      result.candidates.timeConstraints.push({
        id: "time_notification_relative",
        kind: "deadline",
        label: /明天/.test(text) ? "明天" : "相对日期",
        isHard: true,
        confidence: 0.7,
      });
      result.evidence.push({ rawInputId: input.id, quote: text, confidence: 0.7 });
      result.warnings.push("relative_date", "submission_deadline");
    }

    const risk = evaluateMultimodalRisk(input, result);

    return {
      ...result,
      warnings: risk.warnings,
      reviewRequirement: risk.reviewRequirement,
    };
  }
}

function extractDeadlineLabel(text: string): string | undefined {
  return /(\d+\s*月\s*\d+\s*日\s*)?([0-2]?\d[:：]\d{2}|[0-2]?\d\s*点)\s*前/.exec(text)?.[0];
}

function extractDeadlineEvidence(text: string): string {
  return /[^。！？!?]*(\d+\s*月\s*\d+\s*日\s*)?([0-2]?\d[:：]\d{2}|[0-2]?\d\s*点)\s*前[^。！？!?]*/.exec(text)?.[0] ?? text;
}
