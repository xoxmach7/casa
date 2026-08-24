import { expect, test, type Page } from "@playwright/test";

async function loginWithCookieSession(page: Page): Promise<void> {
  const response = await page.request.post("http://localhost:3001/api/auth/login", {
    data: { email: process.env.E2E_ADMIN_EMAIL ?? "admin@casa.kz", password: process.env.E2E_ADMIN_PASSWORD ?? "" },
  });
  await expect(response).toBeOK();
  const body = await response.json();
  await page.goto("/login");
  await page.evaluate((user) => localStorage.setItem("user", JSON.stringify(user)), body.user);
}

test.skip(!process.env.E2E_ADMIN_PASSWORD, "requires disposable-stack E2E_ADMIN_PASSWORD");

test("authenticated session opens the truthful mortgage sandbox", async ({ page }) => {
  await loginWithCookieSession(page);
  await page.goto("/dashboard/mortgage");

  await expect(page.getByRole("heading", { name: "Безопасный sandbox" })).toBeVisible();
  await expect(page.getByText("Только синтетические или обезличенные данные.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Загрузить PDF" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Создать публичную ссылку" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Сформировать PDF" })).toBeDisabled();
  await expect(page.getByText("Согласие: требуется интеграция провайдера")).toBeVisible();
  await expect(page.getByText("Сервер недоступен — демо-режим")).toHaveCount(0);
});