import type { InputsState, SourceType } from "@/lib/types";

type ExpectedKind = "course" | "assignment" | "default";

export type ExpandedAiCase = {
  id: string;
  name: string;
  input: InputsState;
  expectedSource: SourceType;
  expectedKind: ExpectedKind;
  expectedNeedle: string;
  fixtureImagePath?: string;
};

const baseInput: InputsState = {
  text: "",
  attachments: [],
  imageSchedule: null,
  parsedText: "",
  sourceType: "text"
};

function input(overrides: Partial<InputsState>): InputsState {
  return {
    ...baseInput,
    ...overrides
  };
}

export const expandedAiCases: ExpandedAiCase[] = [
  {
    id: "long-dialogue-course-departure",
    name: "长对话：用户反复确认高数课出门准备",
    input: input({
      text:
        "用户：我明天早上有高数课，但我总是拖到最后才出门。\n助手：你几点上课？\n用户：08:00，二教 304，路上差不多 18 分钟，还要找上次作业页。\n助手：你希望我怎么帮你？\n用户：不要做 Todo，帮我拆成现在就能完成的卡片。"
    }),
    expectedSource: "text",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "long-dialogue-assignment-deadline",
    name: "长对话：作业通知和截止时间",
    input: input({
      text:
        "老师在群里说，课程作业今晚 20:00 前提交，一页分析就行。\n我现在有点慌，之前想直接写完整报告，但估计来不及。\n请先帮我做最低可提交版本，再把润色放到后面。"
    }),
    expectedSource: "text",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "long-dialogue-mixed-multi-goal",
    name: "长对话：多目标里有作业 deadline",
    input: input({
      text:
        "今天要做三件事：整理桌面、去拿快递、还有把报告 ddl 前交掉。\n如果只能先做一件，请先处理报告，因为提交失败最麻烦。\n之后再把其他事情做成轻量卡。"
    }),
    expectedSource: "text",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "long-dialogue-no-time",
    name: "长对话：没有明确时间信息",
    input: input({
      text:
        "我想开始整理专业课笔记，但不知道从哪里下手。\n之前每次都想整理完整体系，然后就卡住。\n请只给我第一轮推进，不要安排太复杂。"
    }),
    expectedSource: "text",
    expectedKind: "default",
    expectedNeedle: "今天内完成第一轮推进"
  },
  {
    id: "long-dialogue-fatigue-gentle",
    name: "长对话：疲劳状态下的温和推进",
    input: input({
      text:
        "我今天状态很低，但是不想完全放弃。\n想把明天要用的资料简单整理一下，先做 10 分钟就好。\n如果做不完，希望能冻结而不是失败。"
    }),
    expectedSource: "text",
    expectedKind: "default",
    expectedNeedle: "温和默认时间建议"
  },
  {
    id: "attachment-assignment-notice",
    name: "附件：作业通知",
    input: input({
      attachments: [
        {
          id: "notice-1",
          name: "assignment-notice.txt",
          kind: "notice",
          mockedText: "课程作业通知：今晚 20:00 前提交一页简短分析。"
        }
      ],
      parsedText: "课程作业通知：今晚 20:00 前提交一页简短分析。"
    }),
    expectedSource: "attachment",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "mixed-text-and-attachment",
    name: "混合：文字 + 附件",
    input: input({
      text: "帮我把这个通知变成可执行卡，不要漏掉提交时间。",
      attachments: [
        {
          id: "notice-2",
          name: "report-deadline.txt",
          kind: "notice",
          mockedText: "报告 deadline：周三 20:00 前提交，包含观点、例子和结论。"
        }
      ],
      parsedText: "报告 deadline：周三 20:00 前提交，包含观点、例子和结论。"
    }),
    expectedSource: "mixed",
    expectedKind: "assignment",
    expectedNeedle: "今晚 20:00 前"
  },
  {
    id: "image-monday-math",
    name: "图片课表：周一早八高数",
    fixtureImagePath: "tests/fixtures/timetables/monday-math-schedule.svg",
    input: input({
      imageSchedule: {
        id: "image-monday-math",
        name: "monday-math-schedule.svg",
        parsedTimetable: "图像课表识别：周一 08:00 高数课，地点二教 304，建议提前 20 分钟出门。"
      }
    }),
    expectedSource: "image",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "image-tuesday-lab",
    name: "图片课表：实验课提前到",
    fixtureImagePath: "tests/fixtures/timetables/tuesday-lab-schedule.svg",
    input: input({
      imageSchedule: {
        id: "image-tuesday-lab",
        name: "tuesday-lab-schedule.svg",
        parsedTimetable: "图像课表识别：周二 10:25 物理实验课，实验中心 2F，需提前 15 分钟到达。"
      }
    }),
    expectedSource: "image",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "image-weekly-crowded",
    name: "图片课表：拥挤周课表",
    fixtureImagePath: "tests/fixtures/timetables/weekly-crowded-schedule.svg",
    input: input({
      imageSchedule: {
        id: "image-weekly-crowded",
        name: "weekly-crowded-schedule.svg",
        parsedTimetable: "图像课表识别：明天早八高数，周三 20:00 报告截止，实验课需要提前到。"
      }
    }),
    expectedSource: "image",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "image-friday-review",
    name: "图片课表：周五复盘和高数习题课",
    fixtureImagePath: "tests/fixtures/timetables/friday-review-schedule.svg",
    input: input({
      imageSchedule: {
        id: "image-friday-review",
        name: "friday-review-schedule.svg",
        parsedTimetable: "图像课表识别：周五 14:00 高数习题课，二教 306；19:30 整理错题和复盘。"
      }
    }),
    expectedSource: "image",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "mixed-text-image-course",
    name: "混合：文字 + 课表图片",
    fixtureImagePath: "tests/fixtures/timetables/monday-math-schedule.svg",
    input: input({
      text: "这张课表里明天高数最容易迟到，请帮我先做出门卡组。",
      imageSchedule: {
        id: "image-mixed-course",
        name: "monday-math-schedule.svg",
        parsedTimetable: "图像课表识别：明天 08:00 高数课，二教 304。"
      }
    }),
    expectedSource: "mixed",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "mixed-text-image-assignment",
    name: "混合：文字 + 拥挤课表里的报告截止",
    fixtureImagePath: "tests/fixtures/timetables/weekly-crowded-schedule.svg",
    input: input({
      text: "课表里周三有报告截止，先别管其他课，帮我保护提交线。",
      imageSchedule: {
        id: "image-mixed-assignment",
        name: "weekly-crowded-schedule.svg",
        parsedTimetable: "图像课表识别：周三 20:00 报告截止；周四 08:00 高数。"
      }
    }),
    expectedSource: "mixed",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "english-deadline",
    name: "英文 deadline 输入",
    input: input({
      text: "deadline tonight 20:00: submit the course report with one argument, one example, and a short conclusion."
    }),
    expectedSource: "text",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "course-material-prep",
    name: "课程材料准备",
    input: input({
      text: "下午要上课，先帮我整理课本、笔记和上次作业页，别让我变成学习数学这种大目标。"
    }),
    expectedSource: "text",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "long-dialogue-negated-homework-course",
    name: "长对话：否定交作业后改成去上课",
    input: input({
      text:
        "用户：不是要提交作业，也不要把这个当成作业任务。\n助手：那你现在真正要做什么？\n用户：我要去上课，带上上次作业页和课本，08:00 前到二教 304。\n助手：需要拆成什么节奏？\n用户：先帮我做出门卡组。"
    }),
    expectedSource: "text",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "long-dialogue-cancel-course-submit-report",
    name: "长对话：否定上课后改成提交报告",
    input: input({
      text:
        "用户：我刚才说去上课不准确。\n助手：那现在最紧急的是什么？\n用户：不是去上课，是今晚 22:00 前提交报告，先别做完整排版。\n助手：我会优先保护提交线。"
    }),
    expectedSource: "text",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "empty-whitespace-input",
    name: "空白输入：只有空格和换行",
    input: input({
      text: "   \n  \t  "
    }),
    expectedSource: "text",
    expectedKind: "default",
    expectedNeedle: "温和默认时间建议"
  },
  {
    id: "ocr-noisy-course-image",
    name: "图片课表：OCR 噪声但仍是课程",
    fixtureImagePath: "tests/fixtures/timetables/monday-math-schedule.svg",
    input: input({
      imageSchedule: {
        id: "image-ocr-noisy-course",
        name: "monday-math-schedule.svg",
        parsedTimetable: "图像课表识别：周一 08:OO 高 数 / Calculus，二教 3O4，提前 2Omin 出门。"
      }
    }),
    expectedSource: "image",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "attachment-and-image-without-text",
    name: "混合：附件 + 图片但没有正文",
    fixtureImagePath: "tests/fixtures/timetables/tuesday-lab-schedule.svg",
    input: input({
      attachments: [
        {
          id: "course-note-1",
          name: "course-note.txt",
          kind: "document",
          mockedText: "Course schedule note: calculus lecture needs notebook and last worksheet."
        }
      ],
      parsedText: "Course schedule note: calculus lecture needs notebook and last worksheet.",
      imageSchedule: {
        id: "image-attachment-course",
        name: "tuesday-lab-schedule.svg",
        parsedTimetable: "图像课表识别：周二 10:25 实验课，实验中心 2F。"
      }
    }),
    expectedSource: "mixed",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "english-course-lecture",
    name: "英文课程输入：calculus lecture",
    input: input({
      text: "I have a calculus lecture at 8am in classroom 304. Help me leave on time with a small card deck."
    }),
    expectedSource: "text",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "english-assignment-submit-essay",
    name: "英文作业输入：submit essay",
    input: input({
      text: "Submit an essay by 23:59 tonight: one argument, one example, and a short conclusion. Keep it minimum viable."
    }),
    expectedSource: "text",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "mixed-language-deadline",
    name: "中英混合：DDL 和中文说明",
    input: input({
      text: "明天 10am DDL，submit reflection，不要先做排版，先保住可提交版本。"
    }),
    expectedSource: "text",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "relative-time-chinese-course",
    name: "中文相对时间：明早八点高数",
    input: input({
      text: "明早八点高数，今晚先把课本、笔、上次作业页放好，明天别迟到。"
    }),
    expectedSource: "text",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "relative-time-chinese-assignment",
    name: "中文相对时间：今晚十点前提交小论文",
    input: input({
      text: "今晚十点前提交小论文，现在先写最低可交版本，引用和润色放后面。"
    }),
    expectedSource: "text",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "ocr-noisy-assignment-image",
    name: "图片课表：英文 OCR 的 report due",
    fixtureImagePath: "tests/fixtures/timetables/weekly-crowded-schedule.svg",
    input: input({
      imageSchedule: {
        id: "image-ocr-noisy-assignment",
        name: "weekly-crowded-schedule.svg",
        parsedTimetable: "图像课表识别：WED 20:00 Report due, one-page reflection; THU 08:00 calculus."
      }
    }),
    expectedSource: "image",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "voice-dictation-punctuationless-course",
    name: "语音转写：无标点课程提醒",
    input: input({
      text: "我要明天早八去上高数课 现在先收书包 找作业页 查教室"
    }),
    expectedSource: "text",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "attachment-course-syllabus-english",
    name: "附件：英文课程表说明",
    input: input({
      attachments: [
        {
          id: "syllabus-1",
          name: "syllabus-note.txt",
          kind: "document",
          mockedText: "Course schedule: calculus lecture starts at 08:00 in classroom 304."
        }
      ],
      parsedText: "Course schedule: calculus lecture starts at 08:00 in classroom 304."
    }),
    expectedSource: "attachment",
    expectedKind: "course",
    expectedNeedle: "出门/到课卡组"
  },
  {
    id: "mixed-conflict-submit-priority",
    name: "混合冲突：课表图片 + 报告截止优先",
    fixtureImagePath: "tests/fixtures/timetables/friday-review-schedule.svg",
    input: input({
      text: "图片里有课，但先别管上课，报告截止今晚更重要，帮我保护提交线。",
      imageSchedule: {
        id: "image-conflict-course",
        name: "friday-review-schedule.svg",
        parsedTimetable: "图像课表识别：周五 14:00 高数习题课，19:30 复盘。"
      }
    }),
    expectedSource: "mixed",
    expectedKind: "assignment",
    expectedNeedle: "最低可提交"
  },
  {
    id: "long-dialogue-sleepy-gentle-no-time",
    name: "长对话：困倦但想轻推一下",
    input: input({
      text:
        "用户：我现在很困，但又不想完全躺平。\n助手：有没有硬截止？\n用户：没有，就是想把明天要处理的资料先看一眼。\n助手：那我会拆成低压力卡组。\n用户：可以，最好随时能冻结。"
    }),
    expectedSource: "text",
    expectedKind: "default",
    expectedNeedle: "温和默认时间建议"
  }
];
