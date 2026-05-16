import { test, expect } from "@playwright/test";

test.describe("MVP main flow", () => {
  test("input -> deck -> proof", async ({ page }) => {
    await page.goto("/");

    // input mode is default - the textarea is the composer
    const composer = page.getByPlaceholder("What's your next card?");
    await expect(composer).toBeVisible();
    await composer.fill("去高数课");

    // submit
    await page.getByRole("button", { name: "生成执行方案" }).click();

    // analysis -> ready: three plan cards appear
    await expect(page.getByRole("button", { name: "执行方案一" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "执行方案二" })).toBeVisible();
    await expect(page.getByRole("button", { name: "执行方案三" })).toBeVisible();

    // pick plan one
    await page.getByRole("button", { name: "执行方案一" }).click();

    // task flow shows up in input mode after selection
    // switch to deck mode (top tab — exact match avoids "进入 deck" button)
    await page.getByRole("button", { name: "deck", exact: true }).click();

    // deck library shows the 去高数课 deck cover
    await expect(page.getByRole("heading", { name: "去高数课" })).toBeVisible();

    // open the deck (clicking the cover button which contains the title)
    await page.getByRole("button").filter({ hasText: "去高数课" }).first().click();

    // active card is rendered with the burning demo
    await expect(page.getByText("Active card", { exact: true })).toBeVisible();

    // complete one card via the in-card button
    await page.getByRole("button", { name: /左滑完成/ }).click();

    // switch to proof mode (top tab)
    await page.getByRole("button", { name: "proof", exact: true }).click();

    // proof page shows at least the records section
    await expect(page.getByText(/分钟|条|记录|证据/).first()).toBeVisible();
  });
});
