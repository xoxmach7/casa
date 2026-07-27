import { test, expect, Page } from '@playwright/test';

// Helper: login via API and set localStorage directly (faster than UI login)
async function login(page: Page, email: string, password: string) {
  // Login via API
  const res = await page.request.post('http://localhost:3001/api/auth/login', {
    data: { email, password },
  });
  const data = await res.json();
  
  // Set localStorage before navigating
  await page.goto('/login');
  await page.evaluate((d) => {
    localStorage.setItem('token', d.token);
    localStorage.setItem('user', JSON.stringify(d.user));
  }, data);
  
  await page.goto('/dashboard');
  await page.waitForTimeout(1000);
}

// Helper: check page loads without error
async function checkPage(page: Page, url: string) {
  await page.goto(url);
  await page.waitForTimeout(3000);
  // No crash — page rendered
  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  // No "500" or "Error" in title
  const title = await page.title();
  expect(title).not.toContain('500');
}

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════
test.describe('Login', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=PRO.casa.kz')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login with valid credentials', async ({ page }) => {
    await login(page, 'admin@casa.kz', 'Test1234');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@casa.kz');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    // Should still be on login page
    await expect(page).toHaveURL(/login/);
  });
});

// ═══════════════════════════════════════════
// ADMIN — all pages
// ═══════════════════════════════════════════
test.describe('ADMIN pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@casa.kz', 'Test1234');
  });

  const adminPages = [
    '/dashboard',
    '/dashboard/crm',
    '/dashboard/strategies',
    '/dashboard/properties',
    '/dashboard/projects',
    '/dashboard/chess',
    '/dashboard/mortgage',
    '/dashboard/profile',
    '/dashboard/forms',
    '/dashboard/settings/funnels',
    '/dashboard/settings/fields',
    '/dashboard/archives',
    '/dashboard/users',
    '/dashboard/courses',
    '/dashboard/admin/projects',
    '/dashboard/admin/settings',
    '/dashboard/admin/import',
    '/dashboard/notifications',
    '/dashboard/clients',
    '/dashboard/deals',
    '/dashboard/bookings',
    '/dashboard/sellers',
  ];

  for (const url of adminPages) {
    test(`loads ${url}`, async ({ page }) => {
      await checkPage(page, url);
    });
  }

  test('sidebar shows Управление section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Управление')).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to users page', async ({ page }) => {
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle').catch(() => {});
    const body = await page.textContent('body');
    expect(body).toContain('Пользователи');
  });
});

// ═══════════════════════════════════════════
// BROKER — all pages
// ═══════════════════════════════════════════
test.describe('BROKER pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'broker@casa.kz', 'Test1234');
  });

  const brokerPages = [
    '/dashboard',
    '/dashboard/crm',
    '/dashboard/strategies',
    '/dashboard/properties',
    '/dashboard/projects',
    '/dashboard/chess',
    '/dashboard/mortgage',
    '/dashboard/profile',
    '/dashboard/forms',
    '/dashboard/settings/funnels',
    '/dashboard/archives',
    '/dashboard/notifications',
    '/dashboard/deals',
    '/dashboard/bookings',
  ];

  for (const url of brokerPages) {
    test(`loads ${url}`, async ({ page }) => {
      await checkPage(page, url);
    });
  }

  test('sidebar does NOT show Управление', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    const mgmt = page.locator('text=Управление');
    await expect(mgmt).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════
// DEVELOPER — pages
// ═══════════════════════════════════════════
test.describe('DEVELOPER pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'developer@casa.kz', 'Test1234');
  });

  const devPages = [
    '/dashboard',
    '/dashboard/crm',
    '/dashboard/projects',
    '/dashboard/chess',
    '/dashboard/mortgage',
    '/dashboard/profile',
    '/dashboard/archives',
  ];

  for (const url of devPages) {
    test(`loads ${url}`, async ({ page }) => {
      await checkPage(page, url);
    });
  }
});

// ═══════════════════════════════════════════
// REALTOR — pages
// ═══════════════════════════════════════════
test.describe('REALTOR pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'realtor@casa.kz', 'Test1234');
  });

  const realtorPages = [
    '/dashboard',
    '/dashboard/crm',
    '/dashboard/properties',
    '/dashboard/sellers',
    '/dashboard/projects',
    '/dashboard/mortgage',
    '/dashboard/profile',
    '/dashboard/archives',
  ];

  for (const url of realtorPages) {
    test(`loads ${url}`, async ({ page }) => {
      await checkPage(page, url);
    });
  }
});

// ═══════════════════════════════════════════
// AGENCY — pages
// ═══════════════════════════════════════════
test.describe('AGENCY pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'agency@casa.kz', 'Test1234');
  });

  const agencyPages = [
    '/dashboard',
    '/dashboard/crm',
    '/dashboard/agency/team',
    '/dashboard/properties',
    '/dashboard/sellers',
    '/dashboard/projects',
    '/dashboard/mortgage',
    '/dashboard/profile',
    '/dashboard/forms',
    '/dashboard/archives',
  ];

  for (const url of agencyPages) {
    test(`loads ${url}`, async ({ page }) => {
      await checkPage(page, url);
    });
  }

  test('sidebar shows Команда', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Команда')).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════
// STRATEGIES — click and view detail
// ═══════════════════════════════════════════
test.describe('Strategies', () => {
  test('click strategy card opens dialog', async ({ page }) => {
    await login(page, 'admin@casa.kz', 'Test1234');
    await page.goto('/dashboard/strategies');
    await page.waitForLoadState('networkidle').catch(() => {});
    // Click first strategy card
    const card = page.locator('[class*="rounded-xl"]').first();
    await card.click();
    // Dialog should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    // Should contain strategy details
    await expect(page.locator('text=Описание')).toBeVisible();
    await expect(page.locator('text=Применяется если')).toBeVisible();
    await expect(page.locator('text=Тактики')).toBeVisible();
  });
});
