import type { VoicePlanReadiness } from "@/lib/server/voice/types";

export type ReadinessInput = {
  normalizedText: string;
  confidence?: number;
  normalizationChangedTooMuch: boolean;
};

const UNRESOLVED_REFERENCE_PATTERNS = [/这个[。！？!?]?$/, /那个/, /这件事/, /那件事/];

export function evaluateVoicePlanReadiness(input: ReadinessInput): VoicePlanReadiness {
  const confidence = input.confidence ?? 1;
  const reasons: string[] = [];
  const missingInfoChips: string[] = [];
  const text = input.normalizedText.trim();

  if (text.length <= 3 || confidence < 0.4) {
    return {
      gate: "retry-transcript",
      confidence,
      reasons: ["语音内容过短或识别置信度过低"],
      understandingPreview: text,
      missingInfoChips: ["重新说一遍"],
    };
  }

  if (confidence < 0.75) reasons.push("识别置信度偏低");
  if (input.normalizationChangedTooMuch) reasons.push("转写清理改动较大");
  if (UNRESOLVED_REFERENCE_PATTERNS.some((pattern) => pattern.test(text))) {
    reasons.push("存在未解析指代");
    missingInfoChips.push("具体任务对象");
  }
  if (looksLikeCourseWithoutSubject(text)) {
    reasons.push("课程信息不完整");
    missingInfoChips.push("具体课程");
  }
  if (looksTimeSensitiveButIncomplete(text)) {
    reasons.push("时间信息不完整");
    missingInfoChips.push("具体时间");
  }
  if (looksLikeMultipleGoals(text)) {
    reasons.push("可能包含多个目标");
    missingInfoChips.push("先做哪一个");
  }

  if (reasons.length > 0) {
    return {
      gate: "confirm-understanding",
      confidence,
      reasons,
      understandingPreview: buildUnderstandingPreview(text),
      missingInfoChips,
    };
  }

  return {
    gate: "direct-plan",
    confidence,
    reasons: [],
    understandingPreview: buildUnderstandingPreview(text),
    missingInfoChips: [],
  };
}

function looksTimeSensitiveButIncomplete(text: string): boolean {
  return /(明天|今晚|今天|早八|课前|截止|ddl|deadline)/i.test(text) && !/(\d{1,2}\s*[:：点]|[一二三四五六七八九十两]{1,3}点|上午|下午|晚上|早上|明早|早八|周[一二三四五六日天]|星期[一二三四五六日天]|下课前)/.test(text);
}

function looksLikeMultipleGoals(text: string): boolean {
  if (/(还有|然后|顺便|以及|另外|也要)/.test(text)) return true;

  const [beforeAnd, afterAnd] = text.split("和", 2);
  if (hasActionVerb(beforeAnd) && hasActionVerb(afterAnd)) return true;

  const [beforeAgain, afterAgain] = text.split("再", 2);
  return hasActionVerb(beforeAgain) && hasActionVerb(afterAgain);
}

function looksLikeCourseWithoutSubject(text: string): boolean {
  return /(去|上).{0,6}课/.test(text) && !/(高数|数学|英语|线代|马原|物理|实验|课程|这门课|那门课)/.test(text);
}

function hasActionVerb(text = ""): boolean {
  return /(写|复习|整理|准备|去|交|完成|打开|做)/.test(text);
}

function buildUnderstandingPreview(text: string): string {
  return `我理解你想处理：${text.replace(/[。！？!?]$/, "")}`;
}
