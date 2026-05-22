import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";

export const ACTION_REVIEW_FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "action-review");

export const forbiddenOutputKeys = new Set([
  "committedDeck",
  "cardMutation",
  "reminderJob",
  "proofAppend",
  "deadlineMutation",
  "hardLockMutation",
  "timeLockMove",
  "baselineGoalReduction",
  "standardGoalReduction",
]);

export const forbiddenCopyTerms = [
  "懒",
  "拖延症",
  "自律差",
  "执行力评分",
  "人格画像",
  "能力评估",
  "失败",
  "惩罚",
  "低纪律",
  "low discipline",
  "lazy",
  "personality score",
  "procrastination disorder",
];

export async function loadActionReviewFixture<T = Record<string, unknown>>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(ACTION_REVIEW_FIXTURE_DIR, name), "utf8")) as T;
}

export function expectForbiddenKeysAbsent(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectForbiddenKeysAbsent);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    expect(forbiddenOutputKeys.has(key)).toBe(false);
    expectForbiddenKeysAbsent(nested);
  }
}

export function expectSupportCopy(value: unknown): void {
  const strings = collectStrings(value).join("\n").toLowerCase();
  for (const term of forbiddenCopyTerms) {
    expect(strings.includes(term.toLowerCase())).toBe(false);
  }
  expect(strings.includes("agent 1")).toBe(false);
  expect(strings.includes("agent2")).toBe(false);
  expect(strings.includes("agent3")).toBe(false);
  expect(strings.includes("行动回顾层")).toBe(false);
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectStrings);
}
