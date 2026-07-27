
-- Seed данные для PRO.casa.kz
-- Пароль для всех: Test1234

-- Админ
INSERT INTO users (id, email, password, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES (
  'admin_001',
  'admin@casa.kz',
  '$2a$10$d.E3duyuGgUkE9.q8Ey3ceEu4pkik6kN2VntojiaXUNsyy3KXhhdK',
  'ADMIN',
  'Администратор',
  'Casa',
  '+77001234567',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Застройщик
INSERT INTO users (id, email, password, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES (
  'developer_001',
  'developer@casa.kz',
  '$2a$10$d.E3duyuGgUkE9.q8Ey3ceEu4pkik6kN2VntojiaXUNsyy3KXhhdK',
  'DEVELOPER',
  'Петр',
  'Петров',
  '+77001234569',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Риелтор
INSERT INTO users (id, email, password, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES (
  'realtor_001',
  'realtor@casa.kz',
  '$2a$10$d.E3duyuGgUkE9.q8Ey3ceEu4pkik6kN2VntojiaXUNsyy3KXhhdK',
  'REALTOR',
  'Алексей',
  'Сидоров',
  '+77001234570',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Агентство
INSERT INTO users (id, email, password, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES (
  'agency_001',
  'agency@casa.kz',
  '$2a$10$d.E3duyuGgUkE9.q8Ey3ceEu4pkik6kN2VntojiaXUNsyy3KXhhdK',
  'AGENCY',
  'Агентство',
  'ProDom',
  '+77001234571',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Брокер
INSERT INTO users (id, email, password, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES (
  'broker_001',
  'broker@casa.kz',
  '$2a$10$d.E3duyuGgUkE9.q8Ey3ceEu4pkik6kN2VntojiaXUNsyy3KXhhdK',
  'BROKER',
  'Иван',
  'Брокеров',
  '+77001234572',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

SELECT 'Seed completed successfully!' as status;
SELECT id, email, role, first_name, last_name FROM users;

