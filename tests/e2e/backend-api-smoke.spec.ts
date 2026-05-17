import { expect, test } from "@playwright/test";

test("new frontend renders while backend health and import review APIs are mounted", async ({ page, request, baseURL }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Next Card/);
  await expect(page.getByRole("button", { name: "input" })).toBeVisible();
  await expect(page.getByRole("button", { name: "deck" })).toBeVisible();
  await expect(page.getByRole("button", { name: "proof" })).toBeVisible();

  const health = await request.get(`${baseURL}/api/backend/health`);
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({
    status: "ok",
    service: "next-card-backend",
    providers: {
      ai: {
        multimodalModel: "mimo-v2.5"
      }
    }
  });

  const review = await request.post(`${baseURL}/api/backend/import/review`, {
    data: {
      sourceType: "image",
      rawText: "5月11日 周一 第1节 08:00-09:35 大学物理B（上）\n5月15日 周五 第1节 08:00-09:35 高等数学B@西3-T1",
      attachmentName: "backend-smoke-timetable.png"
    }
  });
  expect(review.ok()).toBe(true);
  const reviewJson = await review.json();
  expect(reviewJson.topLevelCards).toHaveLength(2);
  expect(reviewJson.reviewRequired).toBe(true);
});
