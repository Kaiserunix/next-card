import { afterEach, describe, expect, it } from "vitest";
import { POST as postCalendarEvent } from "@/app/api/backend/calendar/events/route";
import { POST as postPushSend } from "@/app/api/backend/push/send/route";
import { POST as postWorkerTick } from "@/app/api/backend/worker/tick/route";

describe("internal backend routes", () => {
  const originalToken = process.env.NEXT_CARD_INTERNAL_API_TOKEN;

  afterEach(() => {
    process.env.NEXT_CARD_INTERNAL_API_TOKEN = originalToken;
  });

  it("disables side-effect provider routes when no internal token is configured", async () => {
    delete process.env.NEXT_CARD_INTERNAL_API_TOKEN;

    const pushResponse = await postPushSend(jsonRequest({}));
    const calendarResponse = await postCalendarEvent(jsonRequest({}));
    const workerResponse = await postWorkerTick(jsonRequest({}));

    expect(pushResponse.status).toBe(503);
    expect(calendarResponse.status).toBe(503);
    expect(workerResponse.status).toBe(503);
  });

  it("rejects malformed provider actions even with a valid token", async () => {
    process.env.NEXT_CARD_INTERNAL_API_TOKEN = "test-token";

    const response = await postPushSend(jsonRequest({ kind: "create-calendar-event" }, "test-token"));

    expect(response.status).toBe(400);
  });

  it("allows authenticated dry-run worker ticks without persisting caller snapshots", async () => {
    process.env.NEXT_CARD_INTERNAL_API_TOKEN = "test-token";

    const response = await postWorkerTick(
      jsonRequest(
        {
          dryRun: true,
          now: "2026-05-17T12:00:00.000Z",
          queueItems: [],
          activeQueue: [],
          timeLocks: [],
          frozenTasks: [],
          hiddenGoals: [],
          processedActionIds: []
        },
        "test-token"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.persisted).toBe(false);
    expect(body.nextSnapshot).toBeTruthy();
  });
});

function jsonRequest(body: unknown, token?: string) {
  return new Request("http://test.local", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-next-card-internal-token": token } : {})
    },
    body: JSON.stringify(body)
  });
}
