import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
});

test("exposes exactly the three primary modes and switches between them", async ({ page }) => {
  const tabs = page.getByRole("navigation").getByRole("button");

  await expect(tabs).toHaveCount(3);
  await expect(page.getByRole("button", { name: "input" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "deck" })).toBeVisible();
  await expect(page.getByRole("button", { name: "proof" })).toBeVisible();

  await page.getByRole("button", { name: "deck" }).click();
  await expect(page.getByText("还没有 deck")).toBeVisible();

  await page.getByRole("button", { name: "proof" }).click();
  await expect(page.getByText("还没有形成证明记录")).toBeVisible();

  await page.getByRole("button", { name: "input" }).click();
  await expect(page.getByPlaceholder("What's your next card?")).toBeVisible();
});

test("generates, regenerates, and opens a 去高数课 burning card deck", async ({ page }) => {
  await submitCourseGoal(page);

  await expect(page.getByText("正在理解目标")).toBeVisible();
  await expect(page.getByRole("button", { name: "执行方案一" })).toBeVisible();
  await expect(page.getByRole("button", { name: "执行方案二" })).toBeVisible();
  await expect(page.getByRole("button", { name: "执行方案三" })).toBeVisible();

  await page.getByRole("button", { name: "否，重新生成" }).click();
  await expect(page.getByText(/重新生成会偏向/).first()).toBeVisible();

  await page.getByRole("button", { name: "执行方案一" }).click();
  await expect(page.getByText("task flow overview")).toBeVisible();
  await expect(page.getByText("还有 18 分钟", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "进入 deck" }).click();
  await expect(page.getByText("Deck library")).toBeVisible();
  await expect(page.getByRole("heading", { name: "去高数课" }).first()).toBeVisible();
  await expect(page.getByText("Active card")).toBeVisible();
  await expect(page.getByText("确认高数课时间和教室")).toBeVisible();
  await expect(page.getByText("4 min")).toBeVisible();
  await expect(page.getByText("burning").first()).toBeVisible();
});

test("records quick burning completion and freeze evidence in proof", async ({ page }) => {
  await openCourseDeck(page);

  await page.getByRole("button", { name: "快速燃烧" }).click();
  await page.getByRole("button", { name: "左滑完成" }).click();
  await expect(page.getByText("整理高数课本和上次作业页")).toBeVisible();

  await page.getByRole("button", { name: "先冻结" }).click();
  await expect(page.getByText("你还想继续完成这个任务吗？")).toBeVisible();
  const freezeActions = page.getByRole("button", { name: "继续完成" }).locator("xpath=..");
  await freezeActions.getByRole("button", { name: "先冻结" }).click();

  await page.getByRole("button", { name: "proof" }).click();
  await expect(page.getByText("燃烧完成")).toBeVisible();
  await expect(page.getByText("冻结重排")).toBeVisible();
  await expect(page.getByText("frozen-rescheduled").first()).toBeVisible();
  await expect(page.getByText(/快速燃烧/).first()).toBeVisible();
});

async function submitCourseGoal(page: Page) {
  await page.getByPlaceholder("What's your next card?").fill("去高数课");
  await page.getByRole("button", { name: /生成执行方案/ }).click();
}

async function openCourseDeck(page: Page) {
  await submitCourseGoal(page);
  await page.getByRole("button", { name: "执行方案一" }).click();
  await page.getByRole("button", { name: "进入 deck" }).click();
  await expect(page.getByText("确认高数课时间和教室")).toBeVisible();
}
