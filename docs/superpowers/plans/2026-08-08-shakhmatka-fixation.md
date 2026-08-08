# Шахматка ЖК + Фиксация клиента Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** дать брокеру в CRM экран шахматки новостройки с переключателем видов (карточки / список / настоящая табличная шахматка по зданиям и подъездам) и рабочей кнопкой «Фиксировать клиента», которая создаёт настоящую фиксацию в уже существующем бэкенде и выдаёт скачиваемый лист фиксации (PDF).

**Architecture:** бэкенд уже имеет полностью рабочую модель `Fixation` со стейт-машиной (`fixations.routes.ts` + `fixation.service.ts`) — никакого UI под неё никогда не было построено. План: (1) добавить недостающие данные (`Building`/`entrance` на квартире, `paymentMethod`/`dealAmount` на фиксации), (2) переработать `/dashboard/projects/[id]/apartments` на три view-компонента вокруг общего state выбранного юнита, (3) построить модалку фиксации и карточку статуса, (4) генерировать PDF на клиенте через уже установленный `jspdf`.

**Tech Stack:** Express/Prisma/Postgres (backend), Next.js/React/TanStack Query (CRM frontend), `jspdf`+`jspdf-autotable` (уже в зависимостях).

Спека: `docs/superpowers/specs/2026-08-08-shakhmatka-fixation-design.md`

---

## Task 1: Building model + Apartment.buildingId/entrance (миграция)

**Files:**
- Modify: `delivery/backend/prisma/schema.prisma`
- Create: `delivery/backend/prisma/migrations/20260808020000_add_building_entrance/migration.sql`

- [ ] **Step 1: Добавить модель `Building` в schema.prisma**

Вставить перед `model Apartment {` (сейчас строка 260):

```prisma
model Building {
  id         String      @id @default(cuid())
  name       String
  projectId  String      @map("project_id")
  project    Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  apartments Apartment[]
  createdAt  DateTime    @default(now()) @map("created_at")

  @@index([projectId])
  @@map("buildings")
}

```

- [ ] **Step 2: Добавить обратную связь на `Project` и новые поля на `Apartment`**

В `model Project` (строка ~247, рядом с `apartments Apartment[]`) добавить:

```prisma
  buildings Building[]
```

так чтобы блок relations выглядел:

```prisma
  // Relations
  apartments Apartment[]
  buildings  Building[]
  sellers   Seller[]
  developer  User        @relation("DeveloperProjects", fields: [developerId], references: [id])
  fixations  Fixation[]
```

В `model Apartment` (строка ~260) добавить `buildingId`/`entrance` и relation, так чтобы модель выглядела:

```prisma
model Apartment {
  id          String          @id @default(cuid())
  number      String
  floor       Int
  rooms       Int
  area        Decimal         @db.Decimal(10, 2)
  price       Decimal         @db.Decimal(15, 2)
  status      ApartmentStatus @default(AVAILABLE)
  layoutImage String?         @map("layout_image")
  images      String[]        @default([])
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")
  projectId   String          @map("project_id")
  buildingId  String?         @map("building_id")
  entrance    Int?

  // Relations
  sellers              Seller[]
  project              Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  building             Building?             @relation(fields: [buildingId], references: [id], onDelete: SetNull)
  bookings             Booking[]
  mortgageCalculations MortgageCalculation[]
  selectionApartments  SelectionApartment[]
  fixations            Fixation[]

  @@unique([projectId, number])
  @@index([projectId])
  @@index([status])
  @@index([rooms])
  @@index([buildingId])
  @@map("apartments")
}
```

- [ ] **Step 3: Написать миграцию вручную**

Локальная dev-БД в этом проекте рассинхронизирована с историей миграций (известная преэкзистирующая проблема, см. `project_overnight_hardening_2026_08_08` в памяти) — `prisma migrate dev` упрётся в запрос на `migrate reset`, которую нельзя выполнять без отдельного явного согласия пользователя. Миграцию пишем руками, как это уже делалось для `20260808010000_add_landing_lead`.

Создать `delivery/backend/prisma/migrations/20260808020000_add_building_entrance/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buildings_project_id_idx" ON "buildings"("project_id");

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "apartments" ADD COLUMN "building_id" TEXT,
ADD COLUMN "entrance" INTEGER;

-- CreateIndex
CREATE INDEX "apartments_building_id_idx" ON "apartments"("building_id");

-- AddForeignKey
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Сгенерировать Prisma Client (без обращения к БД)**

Run: `cd delivery/backend && npx prisma generate`
Expected: `✔ Generated Prisma Client` — без ошибок, `prisma.building` появляется в типах.

- [ ] **Step 5: Проверить компиляцию**

Run: `cd delivery/backend && npx tsc --noEmit`
Expected: без ошибок (пока ничего не ссылается на новые поля пока что, кроме сгенерированного клиента).

- [ ] **Step 6: Commit**

```bash
git add delivery/backend/prisma/schema.prisma delivery/backend/prisma/migrations/20260808020000_add_building_entrance
git commit -m "feat(backend): add Building model + Apartment.buildingId/entrance"
```

---

## Task 2: Buildings CRUD route

**Files:**
- Create: `delivery/backend/src/routes/buildings.routes.ts`
- Modify: `delivery/backend/src/index.ts`
- Test: `delivery/backend/src/__tests__/buildings.routes.test.ts`

- [ ] **Step 1: Написать failing-тест**

Создать `delivery/backend/src/__tests__/buildings.routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'admin_1', role: 'ADMIN' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!roles.includes(req.user?.role)) {
        res.status(403).json({ error: 'Доступ запрещен' });
        return;
      }
      next();
    },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    building: { findMany: vi.fn(), create: vi.fn() },
    project: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { buildingsRouter } from '../routes/buildings.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/buildings', buildingsRouter);
  return app;
}

describe('GET /api/buildings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('filters by projectId when given', async () => {
    (prisma.building.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/buildings?projectId=proj_1');

    expect(prisma.building.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'proj_1' } })
    );
  });
});

describe('POST /api/buildings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('403s a BROKER', async () => {
    currentUser = { userId: 'broker_1', role: 'BROKER' };

    const app = buildApp();
    const res = await request(app).post('/api/buildings').send({ name: 'Блок C', projectId: 'proj_1' });

    expect(res.status).toBe(403);
    expect(prisma.building.create).not.toHaveBeenCalled();
  });

  it('creates a building for ADMIN', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({ id: 'proj_1', developerId: 'dev_1' });
    (prisma.building.create as any).mockResolvedValue({ id: 'b_1', name: 'Блок C', projectId: 'proj_1' });

    const app = buildApp();
    const res = await request(app).post('/api/buildings').send({ name: 'Блок C', projectId: 'proj_1' });

    expect(res.status).toBe(201);
    expect(prisma.building.create).toHaveBeenCalledWith({ data: { name: 'Блок C', projectId: 'proj_1' } });
  });

  it('404s when the project does not exist', async () => {
    (prisma.project.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/buildings').send({ name: 'Блок C', projectId: 'missing' });

    expect(res.status).toBe(404);
  });

  it('403s a DEVELOPER creating a building on someone else\'s project', async () => {
    currentUser = { userId: 'dev_2', role: 'DEVELOPER' };
    (prisma.project.findUnique as any).mockResolvedValue({ id: 'proj_1', developerId: 'dev_1' });

    const app = buildApp();
    const res = await request(app).post('/api/buildings').send({ name: 'Блок C', projectId: 'proj_1' });

    expect(res.status).toBe(403);
    expect(prisma.building.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `cd delivery/backend && npx vitest run src/__tests__/buildings.routes.test.ts`
Expected: FAIL — `Cannot find module '../routes/buildings.routes'`

- [ ] **Step 3: Реализовать роут**

Создать `delivery/backend/src/routes/buildings.routes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const buildingsRouter = Router();
buildingsRouter.use(authenticate);

const createBuildingSchema = z.object({
  name: z.string().min(1, 'Название здания обязательно'),
  projectId: z.string().min(1, 'ID проекта обязателен'),
});

// GET /api/buildings?projectId=X
buildingsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = projectId;

    const buildings = await prisma.building.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(buildings);
  } catch (error) {
    console.error('Get buildings error:', error);
    res.status(500).json({ error: 'Ошибка получения списка зданий' });
  }
});

// POST /api/buildings - создать здание (только застройщики и админы)
buildingsRouter.post('/', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createBuildingSchema.parse(req.body);

    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    if (req.user?.role === 'DEVELOPER' && project.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const building = await prisma.building.create({ data });

    res.status(201).json(building);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create building error:', error);
    res.status(500).json({ error: 'Ошибка создания здания' });
  }
});
```

- [ ] **Step 4: Зарегистрировать роут в index.ts**

В `delivery/backend/src/index.ts` рядом с `import { apartmentsRouter } from './routes/apartments.routes';` добавить:

```typescript
import { buildingsRouter } from './routes/buildings.routes';
```

Рядом с `app.use('/api/apartments', apartmentsRouter);` добавить:

```typescript
app.use('/api/buildings', buildingsRouter);
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `cd delivery/backend && npx vitest run src/__tests__/buildings.routes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add delivery/backend/src/routes/buildings.routes.ts delivery/backend/src/index.ts delivery/backend/src/__tests__/buildings.routes.test.ts
git commit -m "feat(backend): add buildings CRUD route"
```

---

## Task 3: apartments.routes.ts — принять и отдавать buildingId/entrance

**Files:**
- Modify: `delivery/backend/src/routes/apartments.routes.ts`
- Test: `delivery/backend/src/__tests__/apartments.routes.test.ts`

- [ ] **Step 1: Дописать тест в существующий файл**

Добавить в конец `delivery/backend/src/__tests__/apartments.routes.test.ts` (после существующего `describe` блока, тот же файл, мокает `prisma.apartment` — добавить `create: vi.fn()` в мок из Step 0 если его там нет, проверить существующий мок на строке 23-27 и дополнить):

Заменить существующий мок:
```typescript
vi.mock('../lib/prisma', () => ({
  prisma: {
    apartment: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  },
}));
```
на:
```typescript
vi.mock('../lib/prisma', () => ({
  prisma: {
    apartment: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    project: { findUnique: vi.fn() },
  },
}));
```

И добавить в конец файла (после закрывающей скобки последнего `describe`):

```typescript

describe('GET /api/apartments — building/entrance passthrough', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('includes building in the response', async () => {
    (prisma.apartment.findMany as any).mockResolvedValue([]);
    (prisma.apartment.count as any).mockResolvedValue(0);

    const app = buildApp();
    await request(app).get('/api/apartments?projectId=proj_1');

    const call = (prisma.apartment.findMany as any).mock.calls[0][0];
    expect(call.include.building).toBe(true);
  });
});

describe('POST /api/apartments — buildingId/entrance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('accepts optional buildingId and entrance', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({ id: 'proj_1', developerId: 'dev_1' });
    (prisma.apartment.findUnique as any).mockResolvedValue(null);
    (prisma.apartment.create as any).mockResolvedValue({ id: 'apt_1' });

    const app = buildApp();
    const res = await request(app).post('/api/apartments').send({
      number: '101',
      floor: 1,
      rooms: 2,
      area: 55,
      price: 20000000,
      projectId: 'proj_1',
      buildingId: 'building_1',
      entrance: 2,
    });

    expect(res.status).toBe(201);
    expect(prisma.apartment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ buildingId: 'building_1', entrance: 2 }),
      })
    );
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `cd delivery/backend && npx vitest run src/__tests__/apartments.routes.test.ts`
Expected: FAIL — `call.include.building` undefined (текущий `include` не содержит `building`), и `buildingId`/`entrance` не проходят валидацию схемы (zod strip лишних полей).

- [ ] **Step 3: Расширить схемы и GET include**

В `delivery/backend/src/routes/apartments.routes.ts` заменить:

```typescript
const createApartmentSchema = z.object({
  number: z.string().min(1, 'Номер квартиры обязателен'),
  floor: z.number().int().positive('Этаж должен быть положительным числом'),
  rooms: z.number().int().positive('Количество комнат обязательно'),
  area: z.number().positive('Площадь обязательна'),
  price: z.number().positive('Цена обязательна'),
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD']).default('AVAILABLE'),
  layoutImage: z.string().optional(),
  projectId: z.string().min(1, 'ID проекта обязателен'),
});
```

на:

```typescript
const createApartmentSchema = z.object({
  number: z.string().min(1, 'Номер квартиры обязателен'),
  floor: z.number().int().positive('Этаж должен быть положительным числом'),
  rooms: z.number().int().positive('Количество комнат обязательно'),
  area: z.number().positive('Площадь обязательна'),
  price: z.number().positive('Цена обязательна'),
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD']).default('AVAILABLE'),
  layoutImage: z.string().optional(),
  projectId: z.string().min(1, 'ID проекта обязателен'),
  buildingId: z.string().optional(),
  entrance: z.number().int().positive().optional(),
});
```

В `GET /` (метод `apartmentsRouter.get('/', ...)`) добавить `building: true` в `include` объект — заменить:

```typescript
        include: {
          project: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              developerId: true,
            },
          },
          bookings: {
```

на:

```typescript
        include: {
          project: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              developerId: true,
            },
          },
          building: true,
          bookings: {
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `cd delivery/backend && npx vitest run src/__tests__/apartments.routes.test.ts`
Expected: PASS (все тесты файла, включая уже существовавшие)

- [ ] **Step 5: Прогнать весь backend-набор на регрессии**

Run: `cd delivery/backend && npx vitest run`
Expected: тот же счёт, что и раньше, плюс новые тесты — без новых красных (кроме двух исторических `:3002`-интеграционных, см. память).

- [ ] **Step 6: Commit**

```bash
git add delivery/backend/src/routes/apartments.routes.ts delivery/backend/src/__tests__/apartments.routes.test.ts
git commit -m "feat(backend): apartments accept/return buildingId+entrance"
```

---

## Task 4: Fixation.paymentMethod/dealAmount (миграция)

**Files:**
- Modify: `delivery/backend/prisma/schema.prisma`
- Create: `delivery/backend/prisma/migrations/20260808030000_add_fixation_payment_fields/migration.sql`

- [ ] **Step 1: Добавить enum и поля в schema.prisma**

Перед `enum FixationStatus {` (строка ~360) добавить:

```prisma
enum FixationPaymentMethod {
  FULL         // 100% оплата
  MORTGAGE     // Ипотека
  INSTALLMENT  // Рассрочка
}

```

В `model Fixation` (строка ~374) заменить:

```prisma
  apartmentId     String?        @map("apartment_id")
  brokerId        String         @map("broker_id")
  status          FixationStatus @default(DRAFT)
  rejectionReason String?        @map("rejection_reason") @db.Text
```

на:

```prisma
  apartmentId     String?        @map("apartment_id")
  brokerId        String         @map("broker_id")
  status          FixationStatus @default(DRAFT)
  paymentMethod   FixationPaymentMethod? @map("payment_method")
  dealAmount      Decimal?       @map("deal_amount") @db.Decimal(15, 2)
  rejectionReason String?        @map("rejection_reason") @db.Text
```

- [ ] **Step 2: Написать миграцию вручную**

Создать `delivery/backend/prisma/migrations/20260808030000_add_fixation_payment_fields/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "FixationPaymentMethod" AS ENUM ('FULL', 'MORTGAGE', 'INSTALLMENT');

-- AlterTable
ALTER TABLE "fixations" ADD COLUMN "payment_method" "FixationPaymentMethod",
ADD COLUMN "deal_amount" DECIMAL(15,2);
```

- [ ] **Step 3: Сгенерировать Prisma Client**

Run: `cd delivery/backend && npx prisma generate`
Expected: `✔ Generated Prisma Client` без ошибок.

- [ ] **Step 4: Проверить компиляцию**

Run: `cd delivery/backend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add delivery/backend/prisma/schema.prisma delivery/backend/prisma/migrations/20260808030000_add_fixation_payment_fields
git commit -m "feat(backend): add Fixation.paymentMethod/dealAmount"
```

---

## Task 5: fixations.routes.ts — paymentMethod/dealAmount + TTL 24 часа

**Files:**
- Modify: `delivery/backend/src/routes/fixations.routes.ts`
- Test: `delivery/backend/src/__tests__/fixations.routes.test.ts`

- [ ] **Step 1: Дописать тесты**

Добавить в `delivery/backend/src/__tests__/fixations.routes.test.ts`, заменить существующий тест «allows a valid transition (DRAFT -> SENT) and sets sentAt/expiresAt»:

```typescript
  it('allows a valid transition (DRAFT -> SENT) and sets expiresAt 24 hours out', async () => {
    (prisma.fixation.findUnique as any).mockResolvedValue({ id: 'fix_1', brokerId: 'broker_1', status: 'DRAFT' });
    (prisma.fixation.update as any).mockResolvedValue({ id: 'fix_1', status: 'SENT' });

    const app = buildApp();
    const res = await request(app).patch('/api/fixations/fix_1/status').send({ status: 'SENT' });

    expect(res.status).toBe(200);
    const updateCall = (prisma.fixation.update as any).mock.calls[0][0];
    expect(updateCall.data.status).toBe('SENT');
    expect(updateCall.data.sentAt).toBeInstanceOf(Date);
    expect(updateCall.data.expiresAt).toBeInstanceOf(Date);
    const durationMs = updateCall.data.expiresAt.getTime() - updateCall.data.sentAt.getTime();
    expect(durationMs).toBe(24 * 60 * 60 * 1000);
    expect(prisma.notification.create).toHaveBeenCalled();
  });
```

И добавить новый `describe` в конец файла:

```typescript

describe('POST /api/fixations — payment fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts paymentMethod and dealAmount', async () => {
    (prisma.fixation.create as any).mockResolvedValue({ id: 'fix_1', status: 'DRAFT' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/fixations')
      .send({ clientId: 'client_1', projectId: 'proj_1', apartmentId: 'apt_1', paymentMethod: 'FULL', dealAmount: 34986400 });

    expect(res.status).toBe(201);
    expect(prisma.fixation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: 'FULL', dealAmount: 34986400 }),
      })
    );
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `cd delivery/backend && npx vitest run src/__tests__/fixations.routes.test.ts`
Expected: FAIL — длительность сейчас 14 дней, а не 24 часа; `paymentMethod`/`dealAmount` не проходят в `data` (схема их не знает).

- [ ] **Step 3: Расширить схему и поправить TTL**

В `delivery/backend/src/routes/fixations.routes.ts` заменить:

```typescript
const createFixationSchema = z.object({
    clientId: z.string().min(1),
    projectId: z.string().min(1),
    apartmentId: z.string().optional(),
});
```

на:

```typescript
const createFixationSchema = z.object({
    clientId: z.string().min(1),
    projectId: z.string().min(1),
    apartmentId: z.string().optional(),
    paymentMethod: z.enum(['FULL', 'MORTGAGE', 'INSTALLMENT']).optional(),
    dealAmount: z.number().positive().optional(),
});
```

Заменить:

```typescript
            if (status === 'SENT') {
                updateData.sentAt = new Date();
                // Заявка живёт 14 дней, если застройщик не ответил.
                updateData.expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            }
```

на:

```typescript
            if (status === 'SENT') {
                updateData.sentAt = new Date();
                // Заявка живёт 24 часа, если застройщик не ответил.
                updateData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            }
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `cd delivery/backend && npx vitest run src/__tests__/fixations.routes.test.ts`
Expected: PASS (все тесты файла)

- [ ] **Step 5: Commit**

```bash
git add delivery/backend/src/routes/fixations.routes.ts delivery/backend/src/__tests__/fixations.routes.test.ts
git commit -m "feat(backend): fixation paymentMethod/dealAmount + 24h TTL (was 14d)"
```

---

## Task 6: Client без ИИН — плейсхолдер при создании из фиксации

**Files:**
- Modify: `delivery/backend/src/routes/clients.routes.ts`
- Test: `delivery/backend/src/__tests__/clients.routes.test.ts` (создать, если не существует — проверить `ls delivery/backend/src/__tests__ | grep clients` перед стартом)

- [ ] **Step 0: Проверить, существует ли уже тестовый файл**

Run: `ls delivery/backend/src/__tests__/clients.routes.test.ts 2>&1`

Если файл существует — дописывать в него (пропустить создание заголовка/моков ниже, использовать существующие). Если не существует — создать с нуля по шаблону ниже.

- [ ] **Step 1: Написать/дописать failing-тест**

Создать (или дополнить) `delivery/backend/src/__tests__/clients.routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'broker_1', role: 'BROKER' };
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!roles.includes(req.user?.role)) {
        res.status(403).json({ error: 'Доступ запрещен' });
        return;
      }
      next();
    },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    client: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { clientsRouter } from '../routes/clients.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clients', clientsRouter);
  return app;
}

describe('POST /api/clients — iin placeholder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates a 12-char placeholder IIN when none is given', async () => {
    (prisma.client.findUnique as any).mockResolvedValue(null);
    (prisma.client.create as any).mockResolvedValue({ id: 'client_1' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/clients')
      .send({ firstName: 'Аружан', lastName: 'Смагулова', phone: '+77001112233' });

    expect(res.status).toBe(201);
    const createCall = (prisma.client.create as any).mock.calls[0][0];
    expect(createCall.data.iin).toMatch(/^FX\d{10}$/);
  });

  it('keeps a real IIN when one is provided', async () => {
    (prisma.client.findUnique as any).mockResolvedValue(null);
    (prisma.client.create as any).mockResolvedValue({ id: 'client_1' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/clients')
      .send({ firstName: 'Аружан', lastName: 'Смагулова', phone: '+77001112233', iin: '123456789012' });

    expect(res.status).toBe(201);
    const createCall = (prisma.client.create as any).mock.calls[0][0];
    expect(createCall.data.iin).toBe('123456789012');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `cd delivery/backend && npx vitest run src/__tests__/clients.routes.test.ts`
Expected: FAIL — сейчас `iin` обязателен в схеме, запрос без него 400-ится ещё до создания.

- [ ] **Step 3: Сделать `iin` опциональным + сгенерировать плейсхолдер**

В `delivery/backend/src/routes/clients.routes.ts` заменить:

```typescript
const createClientSchema = z.object({
  iin: z.string().length(12, 'ИИН должен содержать 12 цифр'),
  firstName: z.string().min(1, 'Имя обязательно'),
```

на:

```typescript
const createClientSchema = z.object({
  iin: z.string().length(12, 'ИИН должен содержать 12 цифр').optional(),
  firstName: z.string().min(1, 'Имя обязательно'),
```

В обработчике `clientsRouter.post('/', ...)` заменить:

```typescript
clientsRouter.post('/', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createClientSchema.parse(req.body);

    // Проверка уникальности ИИН
    const existing = await prisma.client.findUnique({
      where: { iin: data.iin },
    });
```

на:

```typescript
clientsRouter.post('/', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createClientSchema.parse(req.body);
    // ИИН часто неизвестен на момент фиксации клиента (см. docs/superpowers/specs/2026-08-08-shakhmatka-fixation-design.md) —
    // ставим плейсхолдер того же вида, что уже используется при CSV-импорте без ИИН (import.service.ts).
    const data = { ...parsed, iin: parsed.iin || `FX${Date.now().toString().slice(-10)}` };

    // Проверка уникальности ИИН
    const existing = await prisma.client.findUnique({
      where: { iin: data.iin },
    });
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `cd delivery/backend && npx vitest run src/__tests__/clients.routes.test.ts`
Expected: PASS (2 теста)

- [ ] **Step 5: Прогнать весь backend-набор**

Run: `cd delivery/backend && npx vitest run`
Expected: без новых красных.

- [ ] **Step 6: Commit**

```bash
git add delivery/backend/src/routes/clients.routes.ts delivery/backend/src/__tests__/clients.routes.test.ts
git commit -m "feat(backend): allow client creation without IIN (placeholder), for fixation flow"
```

---

## Task 7: lib/fixation-status.ts — чистая логика статусов (фронтенд)

**Files:**
- Create: `delivery/frontend/lib/fixation-status.ts`

Проект не имеет юнит-тест-раннера для фронтенда (только Playwright e2e, см. `package.json` — `test:e2e`), поэтому для чистых функций тестов через раннер не пишем — они проверяются вручную на Step 2 и live в финальной браузерной проверке (Task 15).

- [ ] **Step 1: Написать файл**

Создать `delivery/frontend/lib/fixation-status.ts`:

```typescript
// Дублирует FixationStatus из delivery/backend/src/lib/fixation.service.ts —
// между фронтендом и бэкендом нет общего пакета типов, держать в синхроне вручную.
export type FixationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'DUPLICATE_CHECK'
  | 'CONFIRMED'
  | 'REJECTED_DUPLICATE'
  | 'REJECTED_OTHER'
  | 'EXPIRED'
  | 'BOOKING_REQUESTED'
  | 'BOOKED'
  | 'DEAL'
  | 'CANCELLED';

export const HAPPY_PATH_STEP_LABELS = ['Отправлено', 'Подтверждено', 'Бронь', 'Сделка'] as const;

const STATUS_TO_STEP: Record<FixationStatus, number> = {
  DRAFT: 0,
  SENT: 0,
  DUPLICATE_CHECK: 0,
  CONFIRMED: 1,
  BOOKING_REQUESTED: 2,
  BOOKED: 2,
  DEAL: 3,
  REJECTED_DUPLICATE: -1,
  REJECTED_OTHER: -1,
  EXPIRED: -1,
  CANCELLED: -1,
};

// -1 = терминальный отрицательный статус (не на хэппи-пути степпера).
export function stepForStatus(status: FixationStatus): number {
  return STATUS_TO_STEP[status];
}

const NEXT_HAPPY_STATUS: Partial<Record<FixationStatus, FixationStatus>> = {
  DRAFT: 'SENT',
  SENT: 'DUPLICATE_CHECK',
  DUPLICATE_CHECK: 'CONFIRMED',
  CONFIRMED: 'BOOKING_REQUESTED',
  BOOKING_REQUESTED: 'BOOKED',
  BOOKED: 'DEAL',
};

export function nextHappyStatus(status: FixationStatus): FixationStatus | null {
  return NEXT_HAPPY_STATUS[status] ?? null;
}

const NEXT_ACTION_LABEL: Partial<Record<FixationStatus, string>> = {
  DUPLICATE_CHECK: 'Подтвердить',
  CONFIRMED: 'В бронь',
  BOOKING_REQUESTED: 'Бронь подтверждена',
  BOOKED: 'Оформить сделку',
};

export function nextActionLabel(status: FixationStatus): string | null {
  return NEXT_ACTION_LABEL[status] ?? null;
}

export function isTerminal(status: FixationStatus): boolean {
  return nextHappyStatus(status) === null;
}

const STATUS_LABELS: Record<FixationStatus, string> = {
  DRAFT: 'Черновик',
  SENT: 'Отправлено',
  DUPLICATE_CHECK: 'Отправлено',
  CONFIRMED: 'Подтверждено',
  BOOKING_REQUESTED: 'В брони',
  BOOKED: 'Забронировано',
  DEAL: 'Сделка',
  REJECTED_DUPLICATE: 'Отклонено (дубликат)',
  REJECTED_OTHER: 'Отклонено',
  EXPIRED: 'Истекло',
  CANCELLED: 'Отменено',
};

export function statusLabel(status: FixationStatus): string {
  return STATUS_LABELS[status];
}
```

- [ ] **Step 2: Проверить руками**

Run: `cd delivery/frontend && npx tsx -e "import('./lib/fixation-status').then(m => { console.log(m.stepForStatus('DUPLICATE_CHECK'), m.nextHappyStatus('DUPLICATE_CHECK'), m.statusLabel('BOOKED')); })"`
Expected: `0 CONFIRMED Забронировано`

- [ ] **Step 3: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add delivery/frontend/lib/fixation-status.ts
git commit -m "feat(crm): add pure fixation status-machine helpers"
```

---

## Task 8: lib/fixation-pdf.ts — генерация листа фиксации

**Files:**
- Create: `delivery/frontend/lib/fixation-pdf.ts`

- [ ] **Step 1: Написать файл**

Создать `delivery/frontend/lib/fixation-pdf.ts`, по образцу уже существующего `exportToPdf` в `lib/export-utils.ts` (тот же импорт `jspdf`+`jspdf-autotable`):

```typescript
export interface FixationPdfData {
  fixationId: string;
  statusLabel: string;
  createdAt: string; // ISO
  expiresAt: string | null; // ISO
  brokerName: string;
  brokerPhone: string;
  clientName: string;
  clientPhone: string;
  projectName: string;
  apartmentNumber: string;
  paymentMethodLabel: string;
  dealAmount: number;
}

export async function generateFixationSheetPdf(data: FixationPdfData) {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text(`Лист фиксации №${data.fixationId}`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Статус: ${data.statusLabel}`, 14, 25);
  doc.text(
    `Действителен до: ${data.expiresAt ? new Date(data.expiresAt).toLocaleString('ru-RU') : '—'}`,
    14,
    31
  );

  let y = 40;
  const section = (title: string, rows: [string, string][]) => {
    doc.setFontSize(11);
    doc.text(title, 14, y);
    (doc as any).autoTable({
      body: rows,
      startY: y + 3,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  section('Партнёр', [
    ['Агентство', 'CASA Pro'],
    ['Агент', data.brokerName],
    ['Телефон', data.brokerPhone],
    ['Дата', new Date(data.createdAt).toLocaleDateString('ru-RU')],
  ]);

  section('Клиент', [
    ['ФИО', data.clientName],
    ['Телефон', data.clientPhone],
  ]);

  section('Интерес клиента', [
    ['ЖК', data.projectName],
    ['Квартира', data.apartmentNumber],
    ['Способ оплаты', data.paymentMethodLabel],
    ['Сумма ДДУ', `${data.dealAmount.toLocaleString('ru-RU')} ₸`],
  ]);

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text('Специалист застройщика — заполняется вручную', 14, y);

  doc.save(`Fixation-${data.fixationId}.pdf`);
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add delivery/frontend/lib/fixation-pdf.ts
git commit -m "feat(crm): add fixation sheet PDF generator (client-side, jsPDF)"
```

---

## Task 9: Здание/подъезд в форме добавления квартиры

**Files:**
- Modify: `delivery/frontend/app/dashboard/projects/[id]/apartments/new/page.tsx`

- [ ] **Step 1: Добавить состояние зданий + подъезда**

В `NewApartmentPage` заменить:

```typescript
  const [formData, setFormData] = useState({
    number: '',
    floor: '',
    rooms: '2',
    area: '',
    price: '',
    description: '',
  });
```

на:

```typescript
  const [formData, setFormData] = useState({
    number: '',
    floor: '',
    rooms: '2',
    area: '',
    price: '',
    description: '',
    buildingId: '',
    entrance: '',
  });
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [newBuildingName, setNewBuildingName] = useState('');
  const [creatingBuilding, setCreatingBuilding] = useState(false);
```

Добавить после определения `handleLayoutUpload` (перед `handleSubmit`):

```typescript
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/buildings?projectId=${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setBuildings)
      .catch(() => setBuildings([]));
  }, [params.id]);

  const handleCreateBuilding = async () => {
    if (!newBuildingName.trim()) return;
    setCreatingBuilding(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/buildings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBuildingName, projectId: params.id }),
      });
      if (!res.ok) throw new Error('Ошибка создания здания');
      const building = await res.json();
      setBuildings((prev) => [...prev, building]);
      setFormData((prev) => ({ ...prev, buildingId: building.id }));
      setNewBuildingName('');
      toast({ title: 'Здание добавлено', description: building.name });
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось создать здание', variant: 'destructive' });
    } finally {
      setCreatingBuilding(false);
    }
  };
```

Добавить `import { useEffect } from 'react';` в существующий `useState, useRef` импорт — заменить:

```typescript
import { useState, useRef } from 'react';
```

на:

```typescript
import { useState, useRef, useEffect } from 'react';
```

- [ ] **Step 2: Отправлять buildingId/entrance при сабмите**

В `handleSubmit`, в теле `JSON.stringify({...})` заменить:

```typescript
        body: JSON.stringify({
          number: formData.number,
          projectId: params.id,
          floor: parseInt(formData.floor),
          rooms: parseInt(formData.rooms),
          area: parseFloat(formData.area),
          price: parseFloat(formData.price),
          status: 'AVAILABLE',
          layoutImage: layoutImage || undefined,
          description: formData.description || undefined,
        }),
```

на:

```typescript
        body: JSON.stringify({
          number: formData.number,
          projectId: params.id,
          floor: parseInt(formData.floor),
          rooms: parseInt(formData.rooms),
          area: parseFloat(formData.area),
          price: parseFloat(formData.price),
          status: 'AVAILABLE',
          layoutImage: layoutImage || undefined,
          description: formData.description || undefined,
          buildingId: formData.buildingId || undefined,
          entrance: formData.entrance ? parseInt(formData.entrance) : undefined,
        }),
```

- [ ] **Step 3: Добавить поля в форму**

В JSX, в первую `Card` (`Основная информация`), после блока с `number`/`floor` (после закрывающего `</div>` этого grid-блока, перед блоком с `rooms`/`area`), вставить:

```tsx
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="buildingId">Здание</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.buildingId}
                      onValueChange={(value) => handleChange('buildingId', value)}
                    >
                      <SelectTrigger id="buildingId">
                        <SelectValue placeholder="Без здания" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Новое здание, напр. Блок C"
                      value={newBuildingName}
                      onChange={(e) => setNewBuildingName(e.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={handleCreateBuilding} disabled={creatingBuilding}>
                      + Здание
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entrance">Подъезд</Label>
                  <Input
                    id="entrance"
                    type="number"
                    placeholder="1"
                    value={formData.entrance}
                    onChange={(e) => handleChange('entrance', e.target.value)}
                  />
                </div>
              </div>

```

Также добавить `import { API_URL } from '@/lib/config';` — проверить, что `API_URL` уже импортируется (файл сейчас импортирует `import { API_URL } from '@/lib/config';` — используется без изменений, ничего добавлять не нужно).

- [ ] **Step 4: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add delivery/frontend/app/dashboard/projects/\[id\]/apartments/new/page.tsx
git commit -m "feat(crm): building/entrance fields on apartment creation form"
```

---

## Task 10: Здание/подъезд в форме редактирования квартиры

**Files:**
- Modify: `delivery/frontend/app/dashboard/projects/[id]/apartments/[apartmentId]/edit/page.tsx`

Этот файл использует `getApiUrl` из `@/lib/api-config` (не `API_URL` из `@/lib/config`, как `new/page.tsx`) — паттерн запросов другой, поэтому код ниже написан заново под этот файл, а не скопирован из Task 9.

- [ ] **Step 1: Добавить импорт `useEffect` (уже импортирован) и поля в `interface Apartment`**

Заменить:

```typescript
interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: string;
  description?: string;
}
```

на:

```typescript
interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: string;
  description?: string;
  buildingId?: string | null;
  entrance?: number | null;
}

interface Building {
  id: string;
  name: string;
}
```

- [ ] **Step 2: Добавить state зданий и поля формы**

Заменить:

```typescript
  const [formData, setFormData] = useState({
    number: '',
    floor: '',
    rooms: '2',
    area: '',
    price: '',
    description: '',
  });

  useEffect(() => {
    fetchApartment();
  }, []);
```

на:

```typescript
  const [formData, setFormData] = useState({
    number: '',
    floor: '',
    rooms: '2',
    area: '',
    price: '',
    description: '',
    buildingId: '',
    entrance: '',
  });
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [newBuildingName, setNewBuildingName] = useState('');
  const [creatingBuilding, setCreatingBuilding] = useState(false);

  useEffect(() => {
    fetchApartment();
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(getApiUrl(`/buildings?projectId=${params.id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBuildings(await res.json());
    } catch {
      setBuildings([]);
    }
  };

  const handleCreateBuilding = async () => {
    if (!newBuildingName.trim()) return;
    setCreatingBuilding(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(getApiUrl('/buildings'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBuildingName, projectId: params.id }),
      });
      if (!res.ok) throw new Error('Ошибка создания здания');
      const building = await res.json();
      setBuildings((prev) => [...prev, building]);
      setFormData((prev) => ({ ...prev, buildingId: building.id }));
      setNewBuildingName('');
      toast({ title: 'Здание добавлено', description: building.name });
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось создать здание', variant: 'destructive' });
    } finally {
      setCreatingBuilding(false);
    }
  };
```

- [ ] **Step 3: Подставить buildingId/entrance при загрузке квартиры**

Заменить:

```typescript
      setFormData({
        number: apartment.number,
        floor: apartment.floor.toString(),
        rooms: apartment.rooms.toString(),
        area: apartment.area,
        price: apartment.price,
        description: apartment.description || '',
      });
```

на:

```typescript
      setFormData({
        number: apartment.number,
        floor: apartment.floor.toString(),
        rooms: apartment.rooms.toString(),
        area: apartment.area,
        price: apartment.price,
        description: apartment.description || '',
        buildingId: apartment.buildingId || '',
        entrance: apartment.entrance != null ? apartment.entrance.toString() : '',
      });
```

- [ ] **Step 4: Отправлять buildingId/entrance в PUT-запросе**

Заменить:

```typescript
          body: JSON.stringify({
            number: formData.number,
            floor: parseInt(formData.floor),
            rooms: parseInt(formData.rooms),
            area: parseFloat(formData.area),
            price: parseFloat(formData.price),
            description: formData.description || undefined,
          }),
```

на:

```typescript
          body: JSON.stringify({
            number: formData.number,
            floor: parseInt(formData.floor),
            rooms: parseInt(formData.rooms),
            area: parseFloat(formData.area),
            price: parseFloat(formData.price),
            description: formData.description || undefined,
            buildingId: formData.buildingId || undefined,
            entrance: formData.entrance ? parseInt(formData.entrance) : undefined,
          }),
```

- [ ] **Step 5: Добавить поля Здание/Подъезд в JSX**

После блока `rooms`/`area` (после его закрывающего `</div>`, перед блоком `price`) вставить:

```tsx
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="buildingId">Здание</Label>
                  <Select
                    value={formData.buildingId}
                    onValueChange={(value) => handleChange('buildingId', value)}
                  >
                    <SelectTrigger id="buildingId">
                      <SelectValue placeholder="Без здания" />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Новое здание, напр. Блок C"
                      value={newBuildingName}
                      onChange={(e) => setNewBuildingName(e.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={handleCreateBuilding} disabled={creatingBuilding}>
                      + Здание
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entrance">Подъезд</Label>
                  <Input
                    id="entrance"
                    type="number"
                    placeholder="1"
                    value={formData.entrance}
                    onChange={(e) => handleChange('entrance', e.target.value)}
                  />
                </div>
              </div>

```

- [ ] **Step 6: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add "delivery/frontend/app/dashboard/projects/[id]/apartments/[apartmentId]/edit/page.tsx"
git commit -m "feat(crm): building/entrance fields on apartment edit form"
```

---

## Task 11: ApartmentDetailPanel — общая панель деталей (без фиксации пока)

**Files:**
- Create: `delivery/frontend/components/crm/apartments/ApartmentDetailPanel.tsx`

- [ ] **Step 1: Написать компонент**

Создать `delivery/frontend/components/crm/apartments/ApartmentDetailPanel.tsx`:

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export interface ApartmentDetail {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  layoutImage?: string;
}

interface ApartmentDetailPanelProps {
  apartment: ApartmentDetail | null;
  onFixate: (apartment: ApartmentDetail) => void;
  children?: React.ReactNode;
}

function formatPrice(price: string) {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(price));
}

const STATUS_LABEL: Record<ApartmentDetail['status'], string> = {
  AVAILABLE: 'Доступно',
  RESERVED: 'Забронировано',
  SOLD: 'Продано',
};

const STATUS_BADGE: Record<ApartmentDetail['status'], string> = {
  AVAILABLE: 'bg-green-500',
  RESERVED: 'bg-yellow-500',
  SOLD: 'bg-gray-500',
};

export function ApartmentDetailPanel({ apartment, onFixate, children }: ApartmentDetailPanelProps) {
  if (!apartment) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full min-h-[300px] flex-col items-center justify-center text-muted-foreground">
          <Home className="mb-3 h-10 w-10" />
          <p>Выберите квартиру слева</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Квартира №{apartment.number}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {apartment.rooms}-комнатная, {apartment.floor} этаж
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {apartment.layoutImage && (
          <img
            src={apartment.layoutImage}
            alt="Планировка"
            className="max-h-64 w-full rounded-lg border object-contain"
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Площадь</p>
            <p className="text-lg font-medium">{apartment.area} м²</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Цена</p>
            <p className="text-lg font-medium">{formatPrice(apartment.price)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Статус</p>
          <Badge className={STATUS_BADGE[apartment.status]}>{STATUS_LABEL[apartment.status]}</Badge>
        </div>

        {apartment.status === 'AVAILABLE' && (
          <Button className="w-full" onClick={() => onFixate(apartment)}>
            Фиксировать клиента
          </Button>
        )}

        {children}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add delivery/frontend/components/crm/apartments/ApartmentDetailPanel.tsx
git commit -m "feat(crm): shared apartment detail panel (Фиксировать клиента entry point)"
```

---

## Task 12: ApartmentCardsView — вынести текущую сетку по этажам

**Files:**
- Create: `delivery/frontend/components/crm/apartments/ApartmentCardsView.tsx`

- [ ] **Step 1: Написать компонент**

Создать `delivery/frontend/components/crm/apartments/ApartmentCardsView.tsx` — логика 1:1 повторяет текущую сетку-по-этажам из `apartments/page.tsx` (строки 222-415 существующего файла), но как переиспользуемый компонент без диалога (диалог заменяется общей `ApartmentDetailPanel`, клик по карточке просто вызывает `onSelect`):

```tsx
'use client';

import { Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
}

interface ApartmentCardsViewProps {
  apartments: Apartment[];
  selectedId: string | null;
  onSelect: (apartment: Apartment) => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-green-100 border-green-500 hover:bg-green-200 text-green-900';
    case 'RESERVED':
      return 'bg-yellow-100 border-yellow-500 hover:bg-yellow-200 text-yellow-900';
    case 'SOLD':
      return 'bg-gray-100 border-gray-500 hover:bg-gray-200 text-gray-900';
    default:
      return 'bg-gray-100 border-gray-300';
  }
}

export function ApartmentCardsView({ apartments, selectedId, onSelect }: ApartmentCardsViewProps) {
  const byFloor = apartments.reduce((acc, apt) => {
    if (!acc[apt.floor]) acc[apt.floor] = [];
    acc[apt.floor].push(apt);
    return acc;
  }, {} as Record<number, Apartment[]>);

  const floors = Object.keys(byFloor).map(Number).sort((a, b) => b - a);

  if (floors.length === 0) {
    return (
      <div className="py-12 text-center">
        <Home className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Квартиры не найдены. Попробуйте изменить фильтры.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {floors.map((floor) => (
        <div key={floor} className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="text-base">{floor} этаж</Badge>
            <span className="text-sm text-muted-foreground">({byFloor[floor].length} квартир)</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {byFloor[floor]
              .sort((a, b) => a.number.localeCompare(b.number))
              .map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => onSelect(apt)}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${getStatusColor(apt.status)} ${
                    selectedId === apt.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className="text-lg font-bold">{apt.number}</div>
                  <div className="text-xs opacity-75">{apt.rooms}-комн</div>
                  <div className="text-xs opacity-75">{apt.area} м²</div>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add delivery/frontend/components/crm/apartments/ApartmentCardsView.tsx
git commit -m "feat(crm): extract floor-grouped cards into ApartmentCardsView"
```

---

## Task 13: ApartmentListView — сплит-список

**Files:**
- Create: `delivery/frontend/components/crm/apartments/ApartmentListView.tsx`

- [ ] **Step 1: Написать компонент**

Создать `delivery/frontend/components/crm/apartments/ApartmentListView.tsx`:

```tsx
'use client';

interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
}

interface ApartmentListViewProps {
  apartments: Apartment[];
  selectedId: string | null;
  onSelect: (apartment: Apartment) => void;
}

function formatPrice(price: string) {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(price));
}

const STATUS_DOT: Record<Apartment['status'], string> = {
  AVAILABLE: 'text-green-600',
  RESERVED: 'text-yellow-600',
  SOLD: 'text-gray-500',
};

export function ApartmentListView({ apartments, selectedId, onSelect }: ApartmentListViewProps) {
  if (apartments.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Квартиры не найдены.</p>;
  }

  return (
    <div className="max-h-[600px] space-y-1.5 overflow-y-auto">
      {apartments.map((apt) => (
        <button
          key={apt.id}
          onClick={() => onSelect(apt)}
          className={`flex w-full items-center justify-between rounded-md border p-2.5 text-left text-sm transition-colors hover:bg-muted ${
            selectedId === apt.id ? 'border-primary bg-muted' : ''
          }`}
        >
          <span>
            {apt.rooms}-комн {apt.area}м² · №{apt.number}
          </span>
          <span className={apt.status === 'AVAILABLE' ? 'font-medium' : `font-medium ${STATUS_DOT[apt.status]}`}>
            {apt.status === 'AVAILABLE' ? formatPrice(apt.price) : apt.status === 'RESERVED' ? 'Бронь' : 'Продано'}
          </span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add delivery/frontend/components/crm/apartments/ApartmentListView.tsx
git commit -m "feat(crm): add split-panel list view for apartments"
```

---

## Task 14: ApartmentTableView — настоящая шахматка (здание/подъезд/этаж×позиция)

**Files:**
- Create: `delivery/frontend/components/crm/apartments/ApartmentTableView.tsx`

- [ ] **Step 1: Написать компонент**

Создать `delivery/frontend/components/crm/apartments/ApartmentTableView.tsx`:

```tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  buildingId?: string | null;
  entrance?: number | null;
}

interface Building {
  id: string;
  name: string;
}

interface ApartmentTableViewProps {
  apartments: Apartment[];
  buildings: Building[];
  selectedId: string | null;
  onSelect: (apartment: Apartment) => void;
}

const STATUS_STYLE: Record<Apartment['status'], string> = {
  AVAILABLE: 'bg-green-50 border-green-300 text-green-900 hover:bg-green-100',
  RESERVED: 'bg-gray-100 border-gray-300 text-gray-500 opacity-70',
  SOLD: 'bg-gray-200 border-gray-400 text-gray-400 opacity-50',
};

function groupForTable(apartments: Apartment[]) {
  const byFloor = new Map<number, Apartment[]>();
  for (const apt of apartments) {
    const list = byFloor.get(apt.floor) ?? [];
    list.push(apt);
    byFloor.set(apt.floor, list);
  }
  for (const list of byFloor.values()) {
    list.sort((a, b) => a.number.localeCompare(b.number));
  }
  const floors = Array.from(byFloor.keys()).sort((a, b) => b - a);
  const columns = Math.max(0, ...Array.from(byFloor.values()).map((l) => l.length));
  return { floors, byFloor, columns };
}

export function ApartmentTableView({ apartments, buildings, selectedId, onSelect }: ApartmentTableViewProps) {
  const [buildingId, setBuildingId] = useState<string>(buildings[0]?.id ?? '');
  const [entrance, setEntrance] = useState<string>('');

  useEffect(() => {
    if (!buildingId && buildings.length > 0) setBuildingId(buildings[0].id);
  }, [buildings, buildingId]);

  const inBuilding = useMemo(
    () => (buildingId ? apartments.filter((a) => a.buildingId === buildingId) : apartments),
    [apartments, buildingId]
  );

  const entrances = useMemo(() => {
    const set = new Set<number>();
    for (const a of inBuilding) {
      if (a.entrance != null) set.add(a.entrance);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [inBuilding]);

  useEffect(() => {
    if (entrances.length > 0 && !entrances.includes(Number(entrance))) {
      setEntrance(String(entrances[0]));
    }
  }, [entrances, entrance]);

  const inEntrance = useMemo(
    () => (entrances.length > 0 ? inBuilding.filter((a) => a.entrance === Number(entrance)) : inBuilding),
    [inBuilding, entrances, entrance]
  );

  const { floors, byFloor, columns } = useMemo(() => groupForTable(inEntrance), [inEntrance]);

  if (apartments.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Квартиры не найдены.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {buildings.length > 0 && (
          <Select value={buildingId} onValueChange={setBuildingId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Здание" /></SelectTrigger>
            <SelectContent>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {entrances.length > 0 && (
          <Select value={entrance} onValueChange={setEntrance}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Подъезд" /></SelectTrigger>
            <SelectContent>
              {entrances.map((e) => (
                <SelectItem key={e} value={String(e)}>Подъезд {e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {floors.length === 0 || columns === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Нет квартир с заданным зданием/подъездом. Заполните их в карточке квартиры.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {floors.map((floor) => (
                <tr key={floor}>
                  <td className="w-8 pr-2 align-middle font-semibold">{floor}</td>
                  {Array.from({ length: columns }).map((_, col) => {
                    const apt = byFloor.get(floor)?.[col];
                    if (!apt) return <td key={col} className="p-1" />;
                    return (
                      <td key={col} className="p-1">
                        <button
                          onClick={() => onSelect(apt)}
                          className={`w-full rounded border p-1.5 text-left ${STATUS_STYLE[apt.status]} ${
                            selectedId === apt.id ? 'ring-2 ring-primary' : ''
                          }`}
                        >
                          <div>{apt.rooms}к {apt.area}м²</div>
                          <div className="font-semibold">№{apt.number}</div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add delivery/frontend/components/crm/apartments/ApartmentTableView.tsx
git commit -m "feat(crm): add true table/shakhmatka view (floor x position, building/entrance)"
```

---

## Task 15: CreateFixationForm — модалка фиксации

**Files:**
- Create: `delivery/frontend/components/crm/forms/CreateFixationForm.tsx`

- [ ] **Step 1: Написать компонент**

Создать `delivery/frontend/components/crm/forms/CreateFixationForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PriceInput } from '@/components/ui/price-input';

interface CreateFixationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  apartmentId: string;
  apartmentNumber: string;
  apartmentPrice: string;
  onSuccess: (fixationId: string) => void;
}

const PAYMENT_METHODS = [
  { value: 'FULL', label: '100%' },
  { value: 'MORTGAGE', label: 'Ипотека' },
  { value: 'INSTALLMENT', label: 'Рассрочка' },
] as const;

function stripPhone(phone: string) {
  return phone.replace(/\D/g, '');
}

export function CreateFixationForm({
  open,
  onOpenChange,
  projectId,
  projectName,
  apartmentId,
  apartmentNumber,
  apartmentPrice,
  onSuccess,
}: CreateFixationFormProps) {
  const queryClient = useQueryClient();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('+7');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]['value']>('FULL');
  const [dealAmount, setDealAmount] = useState(apartmentPrice);

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Найти или создать клиента по телефону
      const searchRes = await api.get('/clients', { params: { search: phone, limit: 50 } });
      const normalized = stripPhone(phone);
      const existing = searchRes.data.clients.find((c: any) => stripPhone(c.phone) === normalized);

      let clientId: string;
      if (existing) {
        clientId = existing.id;
      } else {
        const created = await api.post('/clients', {
          firstName,
          lastName,
          phone,
          clientType: 'NEW_BUILDING',
        });
        clientId = created.data.id;
      }

      // 2. Создать фиксацию (DRAFT)
      const fixationRes = await api.post('/fixations', {
        clientId,
        projectId,
        apartmentId,
        paymentMethod,
        dealAmount: Number(dealAmount),
      });
      const fixationId = fixationRes.data.id as string;

      // 3. Отправить (DRAFT -> SENT), затем сразу пройти автоматическую проверку (SENT -> DUPLICATE_CHECK) —
      // в MVP это мгновенный пропуск, реальную проверку дублей не строим (см. спеку).
      await api.patch(`/fixations/${fixationId}/status`, { status: 'SENT' });
      await api.patch(`/fixations/${fixationId}/status`, { status: 'DUPLICATE_CHECK' });

      return fixationId;
    },
    onSuccess: (fixationId) => {
      toast.success('Фиксация отправлена');
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      onOpenChange(false);
      onSuccess(fixationId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка создания фиксации');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lastName.trim() || !firstName.trim() || !phone.trim() || !dealAmount) return;
    mutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Фиксировать клиента</SheetTitle>
          <SheetDescription>{projectName} · №{apartmentNumber}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Фамилия</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Имя</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Телефон</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <p className="text-xs text-muted-foreground">Если телефон уже есть в базе — привяжем существующего клиента.</p>
          </div>

          <div className="space-y-2">
            <Label>Способ оплаты</Label>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex-1 rounded-md border p-2 text-sm ${
                    paymentMethod === m.value ? 'border-primary bg-primary/10 font-medium text-primary' : ''
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Сумма ДДУ (₸)</Label>
            <PriceInput value={dealAmount} onChange={setDealAmount} />
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Отправка...' : 'Создать и отправить фиксацию'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add delivery/frontend/components/crm/forms/CreateFixationForm.tsx
git commit -m "feat(crm): add client-fixation modal (find-or-create client, payment method, deal amount)"
```

---

## Task 16: FixationStatusCard — статус, степпер, PDF

**Files:**
- Create: `delivery/frontend/components/crm/FixationStatusCard.tsx`

- [ ] **Step 1: Написать компонент**

Создать `delivery/frontend/components/crm/FixationStatusCard.tsx`:

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  HAPPY_PATH_STEP_LABELS,
  stepForStatus,
  nextHappyStatus,
  nextActionLabel,
  statusLabel,
  type FixationStatus,
} from '@/lib/fixation-status';
import { generateFixationSheetPdf } from '@/lib/fixation-pdf';

interface FixationStatusCardProps {
  fixationId: string;
}

export function FixationStatusCard({ fixationId }: FixationStatusCardProps) {
  const queryClient = useQueryClient();

  const { data: fixation, isLoading } = useQuery({
    queryKey: ['fixation', fixationId],
    queryFn: async () => {
      const res = await api.get(`/fixations/${fixationId}`);
      return res.data;
    },
  });

  const advanceMutation = useMutation({
    mutationFn: async (status: FixationStatus) => {
      return api.patch(`/fixations/${fixationId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixation', fixationId] });
      toast.success('Статус обновлён');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка обновления статуса');
    },
  });

  if (isLoading || !fixation) {
    return null;
  }

  const status = fixation.status as FixationStatus;
  const step = stepForStatus(status);
  const next = nextHappyStatus(status);
  const nextLabel = nextActionLabel(status);

  const handleDownload = () => {
    generateFixationSheetPdf({
      fixationId: fixation.id,
      statusLabel: statusLabel(status),
      createdAt: fixation.createdAt,
      expiresAt: fixation.expiresAt,
      brokerName: `${fixation.broker?.firstName ?? ''} ${fixation.broker?.lastName ?? ''}`.trim(),
      brokerPhone: fixation.broker?.phone ?? '',
      clientName: `${fixation.client?.firstName ?? ''} ${fixation.client?.lastName ?? ''}`.trim(),
      clientPhone: fixation.client?.phone ?? '',
      projectName: fixation.project?.name ?? '',
      apartmentNumber: fixation.apartment?.number ?? '',
      paymentMethodLabel:
        fixation.paymentMethod === 'FULL' ? '100%' : fixation.paymentMethod === 'MORTGAGE' ? 'Ипотека' : fixation.paymentMethod === 'INSTALLMENT' ? 'Рассрочка' : '—',
      dealAmount: Number(fixation.dealAmount ?? 0),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Фиксация №{fixation.id.slice(-6).toUpperCase()}</CardTitle>
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Скачать PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {fixation.expiresAt && (
          <p className="text-xs text-muted-foreground">
            Действительна до {new Date(fixation.expiresAt).toLocaleString('ru-RU')}
          </p>
        )}

        {step >= 0 ? (
          <div className="flex gap-1 text-xs">
            {HAPPY_PATH_STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={`flex-1 rounded p-1.5 text-center ${
                  i <= step ? 'bg-primary/10 font-medium text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-destructive">{statusLabel(status)}</p>
        )}

        {next && nextLabel && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => advanceMutation.mutate(next)}
            disabled={advanceMutation.isPending}
          >
            {nextLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add delivery/frontend/components/crm/FixationStatusCard.tsx
git commit -m "feat(crm): add fixation status card (stepper, expiry, PDF download)"
```

---

## Task 17: apartments/page.tsx — собрать всё вместе

**Files:**
- Modify: `delivery/frontend/app/dashboard/projects/[id]/apartments/page.tsx`

- [ ] **Step 1: Переписать файл целиком**

Заменить содержимое `delivery/frontend/app/dashboard/projects/[id]/apartments/page.tsx` целиком на:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Filter, Plus, Trash2, LayoutGrid, List, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api-config';
import { ApartmentCardsView } from '@/components/crm/apartments/ApartmentCardsView';
import { ApartmentListView } from '@/components/crm/apartments/ApartmentListView';
import { ApartmentTableView } from '@/components/crm/apartments/ApartmentTableView';
import { ApartmentDetailPanel, type ApartmentDetail } from '@/components/crm/apartments/ApartmentDetailPanel';
import { CreateFixationForm } from '@/components/crm/forms/CreateFixationForm';
import { FixationStatusCard } from '@/components/crm/FixationStatusCard';

interface Apartment extends ApartmentDetail {
  buildingId?: string | null;
  entrance?: number | null;
}

interface Project {
  id: string;
  name: string;
  city: string;
  address: string;
}

interface Building {
  id: string;
  name: string;
}

type ViewMode = 'cards' | 'list' | 'table';

export default function ApartmentsGridPage() {
  const router = useRouter();
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [apartmentToDelete, setApartmentToDelete] = useState<Apartment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [fixationFormOpen, setFixationFormOpen] = useState(false);
  const [activeFixationId, setActiveFixationId] = useState<string | null>(null);
  const { toast } = useToast();

  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {};
  const canAddApartment = user.role === 'DEVELOPER' || user.role === 'ADMIN';

  const [roomsFilter, setRoomsFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');

  useEffect(() => {
    fetchAll();
  }, [params.id]);

  const fetchAll = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [projectRes, apartmentsRes, buildingsRes] = await Promise.all([
        fetch(getApiUrl(`/projects/${params.id}`), { headers }),
        fetch(getApiUrl(`/apartments?projectId=${params.id}&limit=1000`), { headers }),
        fetch(getApiUrl(`/buildings?projectId=${params.id}`), { headers }),
      ]);

      setProject(await projectRes.json());
      const apartmentsData = await apartmentsRes.json();
      setApartments(apartmentsData.apartments);
      setBuildings(await buildingsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredApartments = apartments.filter((apt) => {
    if (roomsFilter !== 'all' && apt.rooms !== parseInt(roomsFilter)) return false;
    if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
    if (floorFilter !== 'all' && apt.floor !== parseInt(floorFilter)) return false;
    return true;
  });

  const uniqueFloors = Array.from(new Set(apartments.map((apt) => apt.floor))).sort((a, b) => a - b);

  const handleDeleteApartment = async () => {
    if (!apartmentToDelete) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/apartments/${apartmentToDelete.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Не удалось удалить квартиру');
      }

      toast({ title: 'Успешно', description: 'Квартира удалена' });
      if (selectedApartment?.id === apartmentToDelete.id) setSelectedApartment(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setApartmentToDelete(null);
    }
  };

  const handleFixate = (apartment: ApartmentDetail) => {
    setSelectedApartment(apartment as Apartment);
    setActiveFixationId(null);
    setFixationFormOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Шахматка квартир</h1>
            {project && <p className="text-muted-foreground">{project.name} - {project.city}</p>}
          </div>
        </div>
        {canAddApartment && (
          <Button onClick={() => router.push(`/dashboard/projects/${params.id}/apartments/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить квартиру
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Фильтры
            </CardTitle>
            <div className="flex overflow-hidden rounded-md border">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Карточки"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Список"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : ''}`}
                title="Шахматка"
              >
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Select value={roomsFilter} onValueChange={setRoomsFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все комнаты</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="AVAILABLE">Доступно</SelectItem>
                <SelectItem value="RESERVED">Бронь</SelectItem>
                <SelectItem value="SOLD">Продано</SelectItem>
              </SelectContent>
            </Select>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все этажи</SelectItem>
                {uniqueFloors.map((floor) => (
                  <SelectItem key={floor} value={floor.toString()}>{floor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="pt-6">
            {viewMode === 'cards' && (
              <ApartmentCardsView
                apartments={filteredApartments}
                selectedId={selectedApartment?.id ?? null}
                onSelect={setSelectedApartment}
              />
            )}
            {viewMode === 'list' && (
              <ApartmentListView
                apartments={filteredApartments}
                selectedId={selectedApartment?.id ?? null}
                onSelect={setSelectedApartment}
              />
            )}
            {viewMode === 'table' && (
              <ApartmentTableView
                apartments={filteredApartments}
                buildings={buildings}
                selectedId={selectedApartment?.id ?? null}
                onSelect={setSelectedApartment}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ApartmentDetailPanel apartment={selectedApartment} onFixate={handleFixate}>
            {canAddApartment && selectedApartment && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push(`/dashboard/projects/${params.id}/apartments/${selectedApartment.id}/edit`)}
                >
                  Редактировать
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setApartmentToDelete(selectedApartment);
                    setShowDeleteDialog(true);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </ApartmentDetailPanel>

          {activeFixationId && <FixationStatusCard fixationId={activeFixationId} />}
        </div>
      </div>

      {project && selectedApartment && (
        <CreateFixationForm
          open={fixationFormOpen}
          onOpenChange={setFixationFormOpen}
          projectId={project.id}
          projectName={project.name}
          apartmentId={selectedApartment.id}
          apartmentNumber={selectedApartment.number}
          apartmentPrice={selectedApartment.price}
          onSuccess={(fixationId) => {
            setActiveFixationId(fixationId);
            fetchAll();
          }}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить квартиру?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены что хотите удалить квартиру №{apartmentToDelete?.number}? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteApartment} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd delivery/frontend && npx tsc --noEmit`
Expected: без ошибок. Если есть ошибки типов между `ApartmentDetail`/`Apartment` (например `area`/`price` как `string` в одном месте vs `number` в другом) — привести локальные интерфейсы к `string` везде (бэкенд отдаёт `Decimal` как строку в JSON), как было в оригинальном файле.

- [ ] **Step 3: Полная сборка**

Run: `cd delivery/frontend && npm run build`
Expected: сборка проходит без ошибок, маршрут `/dashboard/projects/[id]/apartments` присутствует в выводе.

- [ ] **Step 4: Commit**

```bash
git add "delivery/frontend/app/dashboard/projects/[id]/apartments/page.tsx"
git commit -m "feat(crm): wire 3-view shakhmatka switcher + fixation flow into apartments page"
```

---

## Task 18: Финальная проверка в браузере

**Files:** нет (только ручная проверка)

- [ ] **Step 1: Прогнать весь backend-набор**

Run: `cd delivery/backend && npx vitest run`
Expected: без новых красных тестов относительно baseline (см. `project_overnight_hardening_2026_08_08` в памяти про два исторических `:3002`-теста).

- [ ] **Step 2: Поднять dev-сервер backend + frontend**

Run: `cd delivery/backend && npm run dev` (в фоне)
Run: `cd delivery/frontend && npm run dev` (в фоне)

- [ ] **Step 3: Ручной сценарий в браузере**

1. Зайти в `/dashboard/projects/<id>/apartments` под ADMIN/DEVELOPER на проекте с квартирами.
2. Переключить все три вида (карточки/список/шахматка) — во всех кликабелен выбор юнита, деталь-панель справа обновляется.
3. На проекте без зданий (старые квартиры, `buildingId`/`entrance` = null) — вид «Шахматка» не падает, просто показывает все квартиры без селекторов здания/подъезда.
4. Создать новое здание через форму добавления квартиры, привязать пару квартир к нему с разными подъездами — переключиться на вид «Шахматка», убедиться что селекторы здания/подъезда появились и группировка работает.
5. Выбрать AVAILABLE-квартиру → «Фиксировать клиента» → заполнить форму новым телефоном → отправить → появляется `FixationStatusCard` со степпером на шаге «Отправлено».
6. Повторить фиксацию с ТЕМ ЖЕ телефоном на другой квартире → в Network убедиться, что `POST /clients` не вызывается повторно (клиент переиспользован).
7. Нажать «Скачать PDF» — файл скачивается, открыть — поля Партнёр/Клиент/Интерес клиента/Специалист застройщика заполнены корректно.
8. Нажать кнопку продвижения статуса на карточке фиксации несколько раз до «Сделка» — степпер продвигается.
9. Открыть консоль браузера на каждом шаге — без ошибок.

- [ ] **Step 4: Остановить dev-серверы**

Завершить оба фоновых процесса (Ctrl+C / kill).

---

## Self-Review

**Spec coverage:**
- §0 (Building/entrance) — Tasks 1-3, 9-10, 14. ✅
- §1 (3 вида + переключатель) — Tasks 11-14, 17. ✅
- §2 (модалка фиксации, клиент без ИИН, способ оплаты) — Tasks 6, 15. ✅
- §3 (карточка статуса) — Task 16. ✅
- §4 (PDF) — Task 8. ✅
- Бэкенд-изменения (миграции, TTL, схемы) — Tasks 1, 4, 5. ✅
- «Что НЕ трогаем» (Booking не удаляется, `/dashboard/projects` не трогаем) — соблюдено, ни один Task не касается этих файлов.

**Type consistency:** `FixationStatus` в `lib/fixation-status.ts` (Task 7) дословно совпадает со списком в `fixation.service.ts`. `PAYMENT_METHODS` значения (`FULL`/`MORTGAGE`/`INSTALLMENT`) идентичны на бэкенде (Task 4/5) и фронтенде (Task 15/16). `Building`/`buildingId`/`entrance` именование единообразно во всех задачах.
