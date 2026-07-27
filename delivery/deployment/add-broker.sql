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
SELECT id, email, role, first_name, last_name FROM users;
