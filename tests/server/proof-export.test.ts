import { describe, expect, it } from "vitest";
import { POST as backendProofExportPost } from "@/app/api/backend/proof/export/route";
import { POST as proofExportPost } from "@/app/api/proof/export/route";
import { exportProofJson, exportProofMarkdown } from "@/lib/server/proof-export";
import type { ProofRecord, RewardCard } from "@/lib/types";

const records: ProofRecord[] = [
  {
    id: "proof-1",
    goalTitle: "去高数课",
    source: "text",
    status: "completed",
    progress: 50,
    completedCards: 2,
    frozenCards: 1,
    actualMinutes: 8,
    timeStatus: "burning-completed",
    timeDamageEvents: ["快速燃烧 6 分钟后完成"],
    lastDamageEffect: "burn",
    lastAction: "完成：确认教室",
    nextSuggestion: "继续下一张卡",
    createdAt: "2026-05-16T12:00:00.000Z"
  }
];

const rewardCards: RewardCard[] = [
  {
    id: "reward-1",
    deckId: "deck-1",
    title: "去高数课 已变成行动证据",
    summary: "完成 4 张分解卡。",
    actualMinutes: 18,
    timePerformance: "比预计快 4 分钟完成",
    createdAt: "2026-05-16T12:18:00.000Z"
  }
];

function request(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("proof export", () => {
  it("exports readable Markdown evidence", () => {
    const markdown = exportProofMarkdown({
      records,
      rewardCards,
      summaryDocument: "今天你完成了 1 个阶段目标。"
    });

    expect(markdown).toContain("# Next Card Proof");
    expect(markdown).toContain("去高数课");
    expect(markdown).toContain("快速燃烧 6 分钟后完成");
    expect(markdown).toContain("比预计快 4 分钟完成");
  });

  it("exports structured JSON evidence for later cloud archive", () => {
    const json = exportProofJson({ records, rewardCards, summaryDocument: "summary" });

    expect(JSON.parse(json)).toMatchObject({
      schemaVersion: "next-card-proof-export/v1",
      records: [{ id: "proof-1" }],
      rewardCards: [{ id: "reward-1" }]
    });
  });

  it("serves the legacy /api/proof/export route as Markdown or JSON", async () => {
    const markdownResponse = await proofExportPost(
      request("http://next-card.test/api/proof/export", { records, rewardCards, summaryDocument: "summary" })
    );
    const jsonResponse = await proofExportPost(
      request("http://next-card.test/api/proof/export?format=json", { records, rewardCards, summaryDocument: "summary" })
    );

    expect(markdownResponse.headers.get("content-type")).toContain("text/markdown");
    expect(await markdownResponse.text()).toContain("Next Card Proof");
    expect(jsonResponse.headers.get("content-type")).toContain("application/json");
    expect(await jsonResponse.json()).toMatchObject({ records: [{ id: "proof-1" }] });
  });

  it("also serves the backend namespace proof export route", async () => {
    const response = await backendProofExportPost(
      request("http://next-card.test/api/backend/proof/export", {
        records,
        rewardCards,
        summaryDocument: "summary"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Next Card Proof");
  });
});
