import { normalizeInputText } from "@/lib/server/input-layer/text-normalization";
import type {
  CourseCandidate,
  EvidenceRef,
  InputExtractionResult,
  InputWarning,
  LocationCandidate,
  RawInput,
  ReminderIntentCandidate,
  TaskCandidate,
  TimeCandidate,
} from "@/lib/server/input-layer/types";
import { uniqueWarnings } from "@/lib/server/input-layer/types";

export function extractTextInput(rawInput: RawInput): InputExtractionResult {
  const rawText = rawInput.text ?? "";
  const normalized = normalizeInputText(rawText);
  const text = normalized.normalizedText.replace(/[。！？!?]$/, "");
  const evidence: EvidenceRef[] = text
    ? [{ rawInputId: rawInput.id, textSpan: { start: 0, end: text.length }, quote: text, confidence: 0.82 }]
    : [];
  const warnings: InputWarning[] = [];
  const ambiguities: string[] = [];
  const tasks: TaskCandidate[] = [];
  const timeConstraints: TimeCandidate[] = [];
  const locations: LocationCandidate[] = [];
  const courses: CourseCandidate[] = [];
  const reminders: ReminderIntentCandidate[] = [];

  if (!text) {
    warnings.push("insufficient_input");
    ambiguities.push("输入为空");
  }

  if (/(ignore previous instructions|mark this task complete|delete reminders|忽略.*指令|标成完成)/i.test(text)) {
    warnings.push("prompt_injection_like_text");
  }

  if (
    /(这个|那个|这件事|那件事|这事|那事|事情|处理一下|安排一下)/.test(rawText) ||
    /(这个|那个|这件事|那件事|这事|那事|事情|处理一下|安排一下)/.test(text)
  ) {
    warnings.push("ambiguous_reference");
    ambiguities.push("存在未解析指代");
  }

  if (/(还有|然后|顺便|以及|另外|，.*还要|也要(?:交|提交|复习|提醒|完成|去|上|看).{0,8}(?:课|作业|报告|作文|论文|高数|数学))/.test(text)) {
    warnings.push("multiple_goals");
    ambiguities.push("包含多个目标，需要先确认范围");
  }

  const task = inferTask(text);
  if (task) tasks.push(task);

  const course = inferCourse(text);
  if (course) courses.push(course);

  const location = inferLocation(text);
  if (location) locations.push(location);

  const time = inferTime(text);
  if (time) {
    timeConstraints.push(time);
    evidence[0] = {
      rawInputId: rawInput.id,
      textSpan: spanFor(text, time.label),
      quote: time.label,
      confidence: time.confidence,
    };
    if (/明天|后天|下节课|今晚|下周/.test(time.label)) warnings.push("relative_date");
    if (time.kind === "deadline") warnings.push("submission_deadline");
    if (time.kind === "hard-lock") warnings.push("course_time");
  }

  if (/提醒/.test(text)) {
    reminders.push({ id: "reminder_1", label: "提醒我一下", confidence: 0.7 });
  }

  if (task?.taskType === "course-arrival" && timeConstraints.length === 0) ambiguities.push("缺少明确时间");
  if (task?.taskType === "course-arrival" && locations.length === 0) {
    ambiguities.push("缺少地点");
  }
  if (warnings.includes("ambiguous_reference") && !ambiguities.includes("缺少具体任务对象")) {
    ambiguities.push("缺少具体任务对象");
  }

  return {
    id: `extract_${rawInput.id}`,
    rawInputId: rawInput.id,
    candidates: {
      tasks,
      timeConstraints,
      locations,
      courses,
      reminders,
    },
    confidence: warnings.includes("ambiguous_reference") ? 0.56 : tasks.length > 0 ? 0.84 : 0.4,
    ambiguities,
    warnings: uniqueWarnings(warnings),
    evidence,
    reviewRequirement: "light",
  };
}

function inferTask(text: string): TaskCandidate | undefined {
  if (
    /高数|数学/.test(text) &&
    (/(去|上|到).{0,10}课/.test(text) || /(?:高数|数学).{0,8}课/.test(text) || /课.{0,8}(?:高数|数学)/.test(text))
  ) {
    return {
      id: "task_course_calculus",
      title: "去高数课",
      taskType: "course-arrival",
      confidence: 0.9,
      lifecycle: "unknown",
    };
  }

  if (/(作文|论文|报告|实验报告|PPT|ppt)/.test(text) && /(交|提交|写|准备|处理|看)/.test(text)) {
    return {
      id: /报告|实验报告/.test(text) ? "task_report" : "task_essay",
      title: /报告|实验报告/.test(text) ? "交实验报告" : "交英语作文",
      taskType: "assignment",
      confidence: 0.9,
      lifecycle: "one-off",
    };
  }

  if (/作业/.test(text)) {
    return {
      id: "task_assignment",
      title: text.includes("那个作业") ? "那个作业" : "作业",
      taskType: "assignment",
      confidence: text.includes("那个") ? 0.55 : 0.78,
      lifecycle: "unknown",
    };
  }

  if (text) {
    return {
      id: "task_general",
      title: text,
      taskType: "unknown",
      confidence: 0.45,
      lifecycle: "unknown",
    };
  }

  return undefined;
}

function inferLocation(text: string): LocationCandidate | undefined {
  const patterns = [
    /(?:到|在|@)\s*([东西南北]?\d\s*[-－]\s*[A-Za-z0-9]+)/,
    /(?:到|在|@)\s*([一二三四五六七八九十][教楼]\s*\d{2,4})/,
    /([一二三四五六七八九十]教\s*\d{2,4})/,
    /([东西南北]?\d\s*[-－]\s*[A-Za-z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const name = match[1].replace(/\s+/g, "").replace("－", "-");
    return {
      id: "location_1",
      name,
      confidence: 0.82,
    };
  }

  return undefined;
}

function inferCourse(text: string): CourseCandidate | undefined {
  if (/高数|数学/.test(text)) {
    return {
      id: "course_calculus",
      courseName: /高数/.test(text) ? "高数" : "数学",
      confidence: 0.9,
    };
  }

  return undefined;
}

function inferTime(text: string): TimeCandidate | undefined {
  const relativeSubmissionDeadline =
    /((?:明天|后天|下周[一二三四五六日天]?)[^，。！？!?]{0,12}(?:交|提交)[^，。！？!?]{0,12}(?:作业|报告|实验报告|作文|论文|PPT|ppt))/.exec(text);
  if (relativeSubmissionDeadline) {
    return {
      id: "time_relative_deadline",
      kind: "deadline",
      label: relativeSubmissionDeadline[1],
      isHard: true,
      confidence: 0.78,
    };
  }

  const explicitDeadline = /(今晚|今天|明天|后天)?[^\d一二三四五六七八九十两]{0,4}([0-2]?\d|[一二三四五六七八九十两]{1,3})(?:[:：点](\d{1,2})?)?\s*前/.exec(text);
  if (explicitDeadline) {
    return {
      id: "time_deadline",
      kind: "deadline",
      label: explicitDeadline[0],
      isHard: true,
      confidence: 0.9,
    };
  }

  if (/早八|8\s*点|八点/.test(text) && /(课|上课|高数)/.test(text)) {
    return {
      id: "time_course",
      kind: "hard-lock",
      label: /明天/.test(text) ? "明天早八" : "早八",
      isHard: true,
      confidence: 0.86,
    };
  }

  if (/明天/.test(text)) {
    return {
      id: "time_tomorrow",
      kind: "soft-window",
      label: "明天",
      isHard: false,
      confidence: 0.65,
    };
  }

  return undefined;
}

function spanFor(text: string, quote: string): EvidenceRef["textSpan"] {
  const start = text.indexOf(quote);
  if (start < 0) return { start: 0, end: text.length };
  return { start, end: start + quote.length };
}
