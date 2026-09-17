import { expect, test } from "@playwright/test";

test("첫 접속하면 프로필 화면으로 이동한다", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/userprofile$/);
  await expect(page.getByLabel("닉네임")).toBeVisible();
});
