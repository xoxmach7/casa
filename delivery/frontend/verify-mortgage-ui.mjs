import { chromium } from 'playwright';

const BASE = 'https://pro.casa.kz';
const EMAIL = 'admin@casa.kz';
const PASS = process.env.CASA_ADMIN_PASS || 'Casa-Admin-2026';
const OUT_DIR = process.argv[2] || '.';

const consoleErrors = [];
const failedReq = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => failedReq.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));

const check = (label, ok) => console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASS);
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {}),
    page.click('button[type="submit"], button:has-text("Войти")'),
  ]);
  await page.waitForTimeout(2500);
  console.log('after-login URL:', page.url());

  await page.goto(`${BASE}/dashboard/mortgage`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4000);
  console.log('mortgage URL:', page.url());

  const body = (await page.locator('body').innerText().catch(() => '')) || '';

  console.log('\n=== ЭКРАН ИПОТЕКИ (язык брокера) ===');
  check('заголовок "Расчёты по клиентам"', body.includes('Расчёты по клиентам'));
  check('подзаголовок про документы/платёж', body.includes('ежемесячный платёж'));
  check('шаг "Выберите клиента"', body.includes('Выберите клиента'));
  check('шаг "Загрузите документы"', body.includes('Загрузите документы'));
  check('шаг "Получите расчёт"', body.includes('Получите расчёт'));
  check('кнопка "Калькулятор"', body.includes('Калькулятор'));
  check('кнопка "Условия банков"', body.includes('Условия банков'));
  check('НЕТ жаргона "M05"/"M06"', !/\bM0[56]\b/.test(body));
  check('НЕТ слова "кейс"', !/кейс/i.test(body));
  check('НЕТ сырого cuid в списке', !/\bcm[a-z0-9]{22,}\b/.test(body));
  check('НЕТ сырого статуса DRAFT', !/\bDRAFT\b/.test(body));

  console.log('\n=== БОКОВОЕ МЕНЮ ===');
  const navText = (await page.locator('nav, aside').first().innerText().catch(() => body)) || body;
  const iNovo = navText.indexOf('Новостройки');
  const iVtor = navText.indexOf('Вторичка');
  const iSdel = navText.indexOf('Сделки');
  const iOcen = navText.indexOf('Оценка объектов');
  console.log(`  позиции: Новостройки=${iNovo} Вторичка=${iVtor} Сделки=${iSdel} Оценка=${iOcen}`);
  check('«Вторичка» есть в меню', iVtor >= 0);
  check('«Вторичка» ПОСЛЕ «Новостроек»', iNovo >= 0 && iVtor > iNovo);
  check('«Сделки» видны без клика', iSdel > iVtor);
  check('«Оценка объектов» видна без клика', iOcen > iVtor);

  const sidebar = page.locator('[data-sidebar="sidebar"], aside').first();
  await sidebar.screenshot({ path: `${OUT_DIR}/sidebar.png` }).catch(async () => {
    await page.screenshot({ path: `${OUT_DIR}/sidebar.png`, clip: { x: 0, y: 0, width: 300, height: 950 } });
  });
  await page.screenshot({ path: `${OUT_DIR}/mortgage.png`, fullPage: true });
  console.log('\nscreenshots:', `${OUT_DIR}/mortgage.png`, `${OUT_DIR}/sidebar.png`);
} catch (e) {
  console.log('ERROR:', e.message);
  await page.screenshot({ path: `${OUT_DIR}/error.png` }).catch(() => {});
} finally {
  console.log(`\n--- console errors (${consoleErrors.length}) ---`);
  consoleErrors.slice(0, 15).forEach((e) => console.log('  ', e));
  console.log(`--- failed requests (${failedReq.length}) ---`);
  failedReq.slice(0, 15).forEach((e) => console.log('  ', e));
  await browser.close();
}
