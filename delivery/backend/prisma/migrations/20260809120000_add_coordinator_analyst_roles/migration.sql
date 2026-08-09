-- Роли контура вторички (CASA Developer Handoff v2.0).
-- COORDINATOR — ведёт сделку и подтверждает оценку.
-- ANALYST — собирает аналоги и считает, решения не принимает.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COORDINATOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ANALYST';
