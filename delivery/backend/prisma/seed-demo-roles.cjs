// Демо-профили под новую структуру ролей (7→5): один рабочий логин на роль
// для прохода/проверки. Идемпотентно. Запуск в контейнере:
//   docker exec casa-backend node prisma/seed-demo-roles.cjs
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 1. Слияние ролей: бывшие REALTOR/COORDINATOR становятся BROKER («Агент»).
  const merged = await p.user.updateMany({
    where: { role: { in: ['REALTOR', 'COORDINATOR'] } },
    data: { role: 'BROKER' },
  });
  console.log('роль -> Агент (BROKER):', merged.count);

  // 1b. Демо-аккаунт агента: логин agent@ совпадает с ролью (был broker@).
  await p.user.updateMany({ where: { email: 'broker@casa.kz' }, data: { email: 'agent@casa.kz' } });

  // 2. Известные демо-пароли на 5 канонических аккаунтов (по одному на роль).
  const accounts = [
    ['admin@casa.kz', 'Casa-Admin-2026'],
    ['agent@casa.kz', 'Casa-Agent-2026'],    // Агент (роль BROKER)
    ['agency@casa.kz', 'Casa-Agency-2026'],
    ['analyst@casa.kz', 'Casa-Analyst-2026'],
    ['developer@casa.kz', 'Casa-Dev-2026'],
  ];
  for (const [email, pw] of accounts) {
    const hash = await bcrypt.hash(pw, 10);
    const r = await p.user.updateMany({ where: { email }, data: { password: hash, isActive: true } });
    console.log(r.count ? 'пароль задан: ' + email : 'НЕТ аккаунта: ' + email);
  }

  // 3. Лишние демо-агенты — деактивируем, чтобы остался ровно один Агент.
  const off = await p.user.updateMany({
    where: { email: { in: ['broker.demo@casa.kz', 'realtor@casa.kz', 'coordinator@casa.kz'] } },
    data: { isActive: false },
  });
  console.log('деактивировано лишних:', off.count);

  console.log('--- итог: активные аккаунты ---');
  const active = await p.user.findMany({ where: { isActive: true }, select: { email: true, role: true }, orderBy: { role: 'asc' } });
  active.forEach((u) => console.log(u.role.padEnd(12), u.email));

  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
