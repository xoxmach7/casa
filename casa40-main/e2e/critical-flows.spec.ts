import { test, expect } from '@playwright/test';

async function mockBackend(page: import('@playwright/test').Page, authenticated = false) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ status: authenticated ? 200 : 401, contentType: 'application/json', body: JSON.stringify(authenticated ? { id: 'admin', role: 'ADMIN' } : { error: 'Unauthorized' }) });
    if (path.endsWith('/auth/login')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'access_token=test-cookie; Path=/; HttpOnly' }, body: JSON.stringify({ user: { role: 'ADMIN' } }) });
    if (path.endsWith('/auth/logout')) return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ properties: [], leads: [], objects: [] }) });
  });
}

test('public homepage is reachable', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await expect(page.locator('body')).toContainText('CASA', { timeout: 10_000 });
});

test('unauthenticated admin route redirects to cookie login', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
});

test('cookie-only admin login and logout flow', async ({ page }) => {
  await mockBackend(page, true);
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('admin@example.test');
  await page.getByLabel('Пароль').fill('test-only-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/admin\/objects$/);
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});
