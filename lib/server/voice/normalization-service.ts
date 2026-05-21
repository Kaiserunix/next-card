export type NormalizedTranscript = {
  rawTranscript: string;
  normalizedText: string;
  changedTooMuch: boolean;
};

const LEADING_FILLER_PATTERN = /^(?:呃+|嗯+|啊+|额+(?!外)|就是)+/;
const STANDALONE_FILLER_PATTERN = /(^|[，,、。！？!?\s])(?:呃+|嗯+|啊+|额+|就是)(?=$|[，,、。！？!?\s])/g;

export function normalizeTranscript(rawTranscript: string): NormalizedTranscript {
  const corrected = dropLeadingSelfCorrection(rawTranscript);
  const collapsed = corrected
    .replace(LEADING_FILLER_PATTERN, " ")
    .replace(STANDALONE_FILLER_PATTERN, "$1")
    .trim()
    .replace(/(.{2,8})\s+\1/g, "$1")
    .replace(/^(我想|然后)\1+/, "$1")
    .replace(/^(然后|我想)\s*(?=(我需要|今天|明天|后天|今晚|明早|下周|早八|去|写|复习|整理|打开|把|提醒|帮我))/, "")
    .replace(/\s+/g, "")
    .replace(/^[，,、。！？!?]+/, "")
    .replace(/[，,、]{2,}/g, "，")
    .replace(/[。！？!?]{2,}/g, "。")
    .replace(/[，,、]+([。！？!?])/g, "$1")
    .trim();

  const normalizedText = addTerminalPunctuation(collapsed || corrected.trim());
  const changedRatio = rawTranscript.length === 0 ? 0 : 1 - normalizedText.length / rawTranscript.length;

  return {
    rawTranscript,
    normalizedText,
    changedTooMuch: changedRatio > 0.55,
  };
}

function dropLeadingSelfCorrection(text: string): string {
  return text.replace(
    /^(不是)+.*?[，,、。！？!?\s]*是(?:先|要|应该是)?(?=(写|做|去|把|复习|整理|打开|交|准备|提醒|完成))/,
    "",
  );
}

function addTerminalPunctuation(text: string): string {
  if (!text) return text;
  return /[。！？!?]$/.test(text) ? text : `${text}。`;
}
