import { describe, expect, it } from "vitest";

import { readProofEvents } from "@/lib/server/action-review/proof-reader";
import type { ProofEventRef } from "@/lib/server/action-review/types";
import { loadActionReviewFixture } from "./test-utils";

describe("readProofEvents", () => {
  it("returns verified proof events for the user and window without mutating the source", async () => {
    const fixture = await loadActionReviewFixture<{ proofEvents: ProofEventRef[] }>(
      "completed-deck-proof-events.json",
    );
    const originalLength = fixture.proofEvents.length;

    const events = readProofEvents("user-demo", 14, fixture.proofEvents, "2026-05-21T12:00:00.000Z");

    expect(events.map((event) => event.id)).toEqual([
      "evt_deck_created_math",
      "evt_first_card_started_math",
      "evt_card_completed_math_1",
      "evt_card_completed_math_2",
      "evt_deck_rewarded_math",
    ]);
    expect(fixture.proofEvents).toHaveLength(originalLength);
  });

  it("excludes rejected transcript and unconfirmed multimodal facts", async () => {
    const fixture = await loadActionReviewFixture<{ proofEvents: ProofEventRef[] }>(
      "completed-deck-proof-events.json",
    );

    const events = readProofEvents("user-demo", 14, fixture.proofEvents, "2026-05-21T12:00:00.000Z");

    expect(events.some((event) => event.id === "evt_rejected_transcript")).toBe(false);
    expect(events.some((event) => event.id === "evt_unconfirmed_ocr")).toBe(false);
  });

  it("does not fabricate proof events when the source is empty", () => {
    expect(readProofEvents("user-demo", 14, [], "2026-05-21T12:00:00.000Z")).toEqual([]);
  });
});
