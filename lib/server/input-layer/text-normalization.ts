export type NormalizedInputText = {
  rawText: string;
  normalizedText: string;
  changedTooMuch: boolean;
  removedFillers: string[];
};

const FILLERS = ["呃", "那个", "就是", "嗯", "啊", "额"];

export function normalizeInputText(rawText: string): NormalizedInputText {
  const removedFillers = FILLERS.filter((filler) => rawText.includes(filler));
  const withoutFillers = rawText
    .trim()
    .replace(/^(?:(?:呃+|嗯+|啊+|额+|那个|就是)\s*)+/, "")
    .replace(/(^|[，,、。！？!?\s])(?:呃+|嗯+|啊+|额+|那个|就是)(?=$|[，,、。！？!?\s])/g, "$1")
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1")
    .replace(/\s*([，,、。！？!?])\s*/g, "$1")
    .replace(/[，,、]{2,}/g, "，")
    .replace(/[。！？!?]{2,}/g, "。")
    .replace(/[，,、]+([。！？!?])/g, "$1")
    .trim();
  const normalizedText = addTerminalPunctuation(withoutFillers);
  const changedRatio = rawText.length === 0 ? 0 : 1 - normalizedText.length / rawText.length;

  return {
    rawText,
    normalizedText,
    changedTooMuch: changedRatio > 0.55,
    removedFillers,
  };
}

function addTerminalPunctuation(text: string): string {
  if (!text) return text;
  return /[。！？!?]$/.test(text) ? text : `${text}。`;
}
