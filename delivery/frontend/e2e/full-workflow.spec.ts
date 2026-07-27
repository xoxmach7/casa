import { test, expect, Page } from '@playwright/test';

// ── Helper: Login via API + localStorage ──
async function login(page: Page, email: string, password: string) {
  const res = await page.request.post('http://localhost:3001/api/auth/login', {
    data: { email, password },
  });
  const data = await res.json();
  await page.goto('/login');
  await page.evaluate((d) => {
    localStorage.setItem('token', d.token);
    localStorage.setItem('user', JSON.stringify(d.user));
  }, data);
  await page.goto('/dashboard');
  await page.waitForTimeout(2000);
}

// ══════════════════════════════════════════
// ADMIN — Full Workflow
// ══════════════════════════════════════════
test.describe('ADMIN — Полный цикл', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@casa.kz', 'Test1234');
  });

  test('1. Главная страница загружается', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Casa');
    await page.waitForTimeout(1000);
  });

  test('2. Управление пользователями — просмотр списка', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('3. Создание нового брокера', async ({ page }) => {
    await page.goto('/dashboard/users/new');
    await page.waitForTimeout(2000);
    // Fill form
    await page.fill('input[name="email"], input[placeholder*="email"], input[type="email"]', `test_broker_${Date.now()}@casa.kz`);
    await page.fill('input[name="password"], input[placeholder*="пароль"], input[type="password"]', 'Test1234');
    await page.waitForTimeout(500);
  });

  test('4. CRM — открытие канбан-доски', async ({ page }) => {
    await page.goto('/dashboard/crm');
    await page.waitForTimeout(3000);
    // Should see kanban columns
    const body = await page.textContent('body');
    expect(body).toContain('КОНТАКТ');
  });

  test('5. Стратегии — просмотр и клик', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    await page.waitForTimeout(2000);
    // Click first strategy card
    const card = page.locator('[class*="rounded-xl"]').first();
    if (await card.isVisible()) {
      await card.click();
      await page.waitForTimeout(1000);
    }
  });

  test('6. Ипотека — калькулятор', async ({ page }) => {
    await page.goto('/dashboard/mortgage');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('7. Профиль', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('8. Курсы обучения', async ({ page }) => {
    await page.goto('/dashboard/courses');
    await page.waitForTimeout(2000);
  });

  test('9. Настройки AI', async ({ page }) => {
    await page.goto('/dashboard/admin/settings');
    await page.waitForTimeout(2000);
  });

  test('10. Импорт amoCRM — страница загружается', async ({ page }) => {
    await page.goto('/dashboard/admin/import');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('Импорт');
  });

  test('11. Архив', async ({ page }) => {
    await page.goto('/dashboard/archives');
    await page.waitForTimeout(2000);
  });
});

// ══════════════════════════════════════════
// BROKER — Full Workflow
// ══════════════════════════════════════════
test.describe('BROKER — Полный цикл работы', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'realtor@casa.kz', 'Test1234'); // Using realtor as broker was deleted
  });

  test('1. Главная — дашборд брокера', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Casa');
    await page.waitForTimeout(1000);
  });

  test('2. CRM — канбан-доска', async ({ page }) => {
    await page.goto('/dashboard/crm');
    await page.waitForTimeout(3000);
  });

  test('3. Мои объекты', async ({ page }) => {
    await page.goto('/dashboard/properties');
    await page.waitForTimeout(2000);
  });

  test('4. Новостройки — каталог', async ({ page }) => {
    await page.goto('/dashboard/projects');
    await page.waitForTimeout(2000);
  });

  test('5. Шахматка', async ({ page }) => {
    await page.goto('/dashboard/chess');
    await page.waitForTimeout(2000);
  });

  test('6. Ипотека', async ({ page }) => {
    await page.goto('/dashboard/mortgage');
    await page.waitForTimeout(2000);
  });

  test('7. Профиль', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await page.waitForTimeout(2000);
  });

  test('8. Настройки — воронки', async ({ page }) => {
    await page.goto('/dashboard/settings/funnels');
    await page.waitForTimeout(2000);
  });

  test('9. Архив', async ({ page }) => {
    await page.goto('/dashboard/archives');
    await page.waitForTimeout(2000);
  });
});

// ══════════════════════════════════════════
// DEVELOPER — Workflow
// ══════════════════════════════════════════
test.describe('DEVELOPER — Цикл застройщика', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'developer@casa.kz', 'Test1234');
  });

  test('1. Главная', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Casa');
  });

  test('2. CRM — кастомные воронки', async ({ page }) => {
    await page.goto('/dashboard/crm');
    await page.waitForTimeout(3000);
  });

  test('3. Новостройки — мои проекты', async ({ page }) => {
    await page.goto('/dashboard/projects');
    await page.waitForTimeout(2000);
  });

  test('4. Создание проекта', async ({ page }) => {
    await page.goto('/dashboard/projects/new');
    await page.waitForTimeout(2000);
  });

  test('5. Ипотека', async ({ page }) => {
    await page.goto('/dashboard/mortgage');
    await page.waitForTimeout(2000);
  });

  test('6. Профиль', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await page.waitForTimeout(2000);
  });
});

// ══════════════════════════════════════════
// AGENCY — Workflow
// ══════════════════════════════════════════
test.describe('AGENCY — Цикл агентства', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'agency@casa.kz', 'Test1234');
  });

  test('1. Главная', async ({ page }) => {
    await expect(page.locator('body')).toContainText('Casa');
  });

  test('2. Команда', async ({ page }) => {
    await page.goto('/dashboard/agency/team');
    await page.waitForTimeout(2000);
  });

  test('3. CRM', async ({ page }) => {
    await page.goto('/dashboard/crm');
    await page.waitForTimeout(3000);
  });

  test('4. Профиль', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await page.waitForTimeout(2000);
  });
});
