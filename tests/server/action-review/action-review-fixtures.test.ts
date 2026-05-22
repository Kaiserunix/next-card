import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type {
  AgentPolicySnapshot,
  ProfileSnapshot,
  SystemSoftTaskCandidate,
} from "@/lib/server/action-review/types";
import {
  ACTION_REVIEW_FIXTURE_DIR,
  expectForbiddenKeysAbsent,
  loadActionReviewFixture,
} from "./test-utils";

const expectedFixtures = [
  "empty-proof-default-profile.json",
  "completed-deck-proof-events.json",
  "frozen-then-resumed-proof-events.json",
  "burn-then-completed-proof-events.json",
  "reminder-delivered-and-responded.json",
  "reminder-delivery-failed.json",
  "notification-permission-missing.json",
  "personalization-disabled.json",
  "candidate-profile-low-confidence.json",
  "static-policy-default-balanced.json",
];

describe("action review fixtures and contracts", () => {
  it("contains every required fixture", async () => {
    const files = await readdir(ACTION_REVIEW_FIXTURE_DIR);
    expect(files.sort()).toEqual(expectedFixtures.sort());
  });

  it("keeps third-layer fixtures free of authoritative mutation outputs", async () => {
    const files = await readdir(ACTION_REVIEW_FIXTURE_DIR);

    for (const file of files) {
      const fixture = await loadActionReviewFixture(file);
      expectForbiddenKeysAbsent(fixture);
    }
  });

  it("models an empty proof default profile as unknown and confidence zero", async () => {
    const fixture = await loadActionReviewFixture<{ defaultProfile: ProfileSnapshot }>(
      "empty-proof-default-profile.json",
    );

    expect(fixture.defaultProfile.confidence).toBe(0);
    expect(fixture.defaultProfile.mode).toBe("default");
    expect(Object.values(fixture.defaultProfile.dimensions).every((dimension) => dimension.value === "unknown")).toBe(
      true,
    );
  });

  it("keeps policy snapshots future-facing", async () => {
    const fixture = await loadActionReviewFixture<{ policy: AgentPolicySnapshot }>(
      "static-policy-default-balanced.json",
    );

    expect(["future-planning-only", "future-reminders-only", "experiment"]).toContain(fixture.policy.appliesTo);
    expect(fixture.policy.appliesTo).toBe("future-planning-only");
  });

  it("models system soft tasks only as Time Guardian reviewed soft candidates", async () => {
    const fixture = await loadActionReviewFixture<{ candidates: SystemSoftTaskCandidate[] }>(
      "candidate-profile-low-confidence.json",
    );

    for (const candidate of fixture.candidates) {
      expect(candidate.defaultTension).toBe("soft");
      expect(candidate.requiresTimeGuardianReview).toBe(true);
      expect(candidate.evidenceIds.length).toBeGreaterThan(0);
    }
  });

  it("does not create an active inferred profile when personalization is disabled", async () => {
    const fixture = await loadActionReviewFixture<{ profile: ProfileSnapshot }>("personalization-disabled.json");

    expect(fixture.profile.mode).not.toBe("active");
    expect(fixture.profile.confidence).toBe(0);
  });
});
