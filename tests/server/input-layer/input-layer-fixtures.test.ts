import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "input-layer");

const expectedFixtures = [
  "voice-go-to-calculus.json",
  "ambiguous-voice-that-assignment.json",
  "manual-dictation-reminder.json",
  "image-timetable-low-confidence.json",
  "pdf-assignment-deadline.json",
  "notification-relative-date.json",
  "mixed-multi-goal-input.json",
  "prompt-injection-like-document.json",
];

const forbiddenOutputKeys = new Set([
  "committedDeck",
  "cardState",
  "proofRecord",
  "reminderJob",
  "profileSnapshot",
]);

describe("input layer fixtures", () => {
  it("contains every required fixture", async () => {
    const files = await readdir(FIXTURE_DIR);
    expect(files.sort()).toEqual(expectedFixtures.sort());
  });

  it("keeps fixtures inside candidate, confirmation, verified, and handoff contracts", async () => {
    const files = await readdir(FIXTURE_DIR);

    for (const file of files) {
      const fixture = JSON.parse(await readFile(join(FIXTURE_DIR, file), "utf8")) as Record<string, unknown>;

      expect(fixture).toHaveProperty("caseId");
      expect(fixture).toHaveProperty("path");
      expect(fixture).toHaveProperty("rawInput");
      expect(fixture).toHaveProperty("extraction");
      expect(fixture).toHaveProperty("confirmationRequest");
      expectForbiddenKeysAbsent(fixture);

      const rawInput = fixture.rawInput as Record<string, unknown>;
      expect(rawInput.id).toMatch(/^raw_/);
      expect(rawInput.sourceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(rawInput.createdAt).toEqual(expect.any(String));
      expect(rawInput.receivedAt).toEqual(expect.any(String));
      expect(rawInput.retentionPolicy).toMatchObject({
        rawRetentionDays: expect.any(Number),
        derivedRetentionDays: expect.any(Number),
        userDeletable: true,
      });

      const extraction = fixture.extraction as Record<string, unknown>;
      expect(extraction).toMatchObject({
        rawInputId: rawInput.id,
        candidates: expect.any(Object),
        confidence: expect.any(Number),
        ambiguities: expect.any(Array),
        warnings: expect.any(Array),
        evidence: expect.any(Array),
        reviewRequirement: expect.stringMatching(/^(none|light|strict|blocked)$/),
      });

      const request = fixture.confirmationRequest as Record<string, unknown>;
      expect(request.rawInputId).toBe(rawInput.id);
      expect(request.mode).toEqual(expect.stringMatching(/^(light-card|rough-scope|strict-review|blocked)$/));
      expect(request.facts).toEqual(expect.any(Array));
      expect(request.missingFields).toEqual(expect.any(Array));

      assertFixturePathMatchesReview(file, fixture.path, extraction.reviewRequirement, request.mode);
    }
  });
});

function assertFixturePathMatchesReview(
  file: string,
  path: unknown,
  reviewRequirement: unknown,
  mode: unknown,
): void {
  if (path === "light") {
    expect([`${file}:review`, reviewRequirement]).toEqual([`${file}:review`, "light"]);
    expect([`${file}:mode`, mode]).toEqual([`${file}:mode`, "light-card"]);
  }
  if (path === "rough-scope") {
    expect([`${file}:mode`, mode]).toEqual([`${file}:mode`, "rough-scope"]);
  }
  if (path === "strict-review") {
    expect([`${file}:review`, reviewRequirement]).toEqual([`${file}:review`, "strict"]);
    expect([`${file}:mode`, mode]).toEqual([`${file}:mode`, "strict-review"]);
  }
  if (path === "blocked") {
    expect([`${file}:review`, reviewRequirement]).toEqual([`${file}:review`, "blocked"]);
    expect([`${file}:mode`, mode]).toEqual([`${file}:mode`, "blocked"]);
  }
}

function expectForbiddenKeysAbsent(value: unknown): void {
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
