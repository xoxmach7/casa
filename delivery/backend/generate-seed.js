const bcrypt = require('bcryptjs');

async function generateSeedSQL() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const brokerHash = await bcrypt.hash('broker123', 10);
  const developerHash = await bcrypt.hash('developer123', 10);

  const sql = `
-- Seed данные для PRO.casa.kz
-- Пароли: admin123, broker123, developer123

-- Админ
INSERT INTO users (id, email, password, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES (
  'admin_001',
  'admin@casa.kz',
  '${adminHash}',
  'ADMIN',
  'Администратор',
  'Casa',
  '+77001234567',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Брокер
INSERT INTO users (id, email, password, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES (
  'broker_001',
  'broker@casa.kz',
  '${brokerHash}',
  'BROKER',
  'Иван',
  'Иванов',
  '+77001234568',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Застройщик
INSERT INTO users (id, email, password, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES (
  'developer_001',
  'developer@casa.kz',
  '${developerHash}',
  'DEVELOPER',
  'Петр',
  'Петров',
  '+77001234569',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

SELECT 'Seed completed successfully!' as status;
SELECT id, email, role, first_name, last_name FROM users;
`;

  console.log(sql);
}

generateSeedSQL();
