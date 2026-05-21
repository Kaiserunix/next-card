export type NormalizedTranscript = {
  rawTranscript: string;
  normalizedText: string;
  changedTooMuch: boolean;
};

const FILLER_PATTERN = /(呃+|嗯+|就是)/g;

export function normalizeTranscript(rawTranscript: string): NormalizedTranscript {
  const collapsed = rawTranscript
    .replace(FILLER_PATTERN, " ")
    .replace(/(.{2,8})\s+\1/g, "$1")
    .replace(/\s+/g, "")
    .trim();

  const normalizedText = addTerminalPunctuation(collapsed || rawTranscript.trim());
  const changedRatio = rawTranscript.length === 0 ? 0 : 1 - normalizedText.length / rawTranscript.length;

  return {
    rawTranscript,
    normalizedText,
    changedTooMuch: changedRatio > 0.55,
  };
}

function addTerminalPunctuation(text: string): string {
  if (!text) return text;
  return /[。！？!?]$/.test(text) ? text : `${text}。`;
}
