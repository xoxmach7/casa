# Casa ⇄ Pro-Casa Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `casa` (public Next.js site) into the public frontend of the existing `pro-casa` CRM backend (`delivery/backend`), replacing the mock valuation wizard with a real backend-backed valuation, and adding a buyer catalog and a seller lead-intake wizard for Almaty.

**Architecture:** `delivery/backend` gains five new/updated public (unauthenticated) Express routes plus two pure-logic modules (valuation math, broker assignment). `casa` gains an HTTP client to that backend, a rewired `/otsenka`, and two new sections: `/catalog` (map + listing detail) and `/prodat` (landing + 4-step "add apartment" wizard).

**Tech Stack:** Backend: Express, Prisma, Postgres, Zod, Vitest. Frontend: Next.js 14 (App Router), React 18, Tailwind, Vitest + Testing Library.

**Working directories:**
- Backend: `delivery/backend/` (all backend paths below are relative to this)
- Frontend: repository root `casa/` (all frontend paths below are relative to this)

---

## Backend: schema and pure logic

### Task 1: Add `ViewingRequest` model and migration

**Files:**
- Modify: `delivery/backend/prisma/schema.prisma`
- Create: `delivery/backend/prisma/migrations/20260727000000_add_viewing_request/migration.sql`

- [ ] **Step 1: Add the model**

Add to `delivery/backend/prisma/schema.prisma`, right before the closing of the file (after `model SystemSettings`):

```prisma
model ViewingRequest {
  id         String   @id @default(cuid())
  propertyId String   @map("property_id")
  name       String
  phone      String
  createdAt  DateTime @default(now()) @map("created_at")

  property   CrmProperty @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@index([propertyId])
  @@map("viewing_requests")
}
```

Add the inverse relation to `CrmProperty` — insert this line inside `model CrmProperty { ... }` right below the existing `events Event[]` relation line (around line 1166):

```prisma
  viewingRequests       ViewingRequest[]
```

- [ ] **Step 2: Write the migration SQL by hand**

There is no live database in the implementer's sandbox, so `prisma migrate dev` cannot be run interactively here. Write the migration file directly so it is ready to apply in an environment with `DATABASE_URL` set:

`delivery/backend/prisma/migrations/20260727000000_add_viewing_request/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "viewing_requests" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "viewing_requests_property_id_idx" ON "viewing_requests"("property_id");

-- AddForeignKey
ALTER TABLE "viewing_requests" ADD CONSTRAINT "viewing_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate the schema without a live DB**

Run: `cd delivery/backend && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Regenerate the Prisma client (schema-only, no DB connection needed)**

Run: `cd delivery/backend && npx prisma generate`
Expected: `✔ Generated Prisma Client` — this makes `prisma.viewingRequest` available to TypeScript in later tasks.

- [ ] **Step 5: Commit**

```bash
git add delivery/backend/prisma/schema.prisma delivery/backend/prisma/migrations/20260727000000_add_viewing_request
git commit -m "feat(backend): add ViewingRequest model and migration"
```

---

### Task 2: Valuation math — `valuation.service.ts`

Pure function, no Prisma import, no DB — fully unit-testable without a live database. The route in Task 4 fetches comparables from Prisma and passes them into this function.

**Files:**
- Create: `delivery/backend/src/lib/valuation.service.ts`
- Test: `delivery/backend/src/__tests__/valuation.service.test.ts`

- [ ] **Step 1: Write the failing test**

`delivery/backend/src/__tests__/valuation.service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeValuation, URGENT_SALE_MULTIPLIER, MARKET_SALE_MULTIPLIER } from '../lib/valuation.service';

describe('computeValuation', () => {
  it('returns null when there are no comparables', () => {
    expect(computeValuation([], 60)).toBeNull();
  });

  it('computes price per m2 as the average across comparables', () => {
    const comparables = [
      { price: 30_000_000, area: 60 }, // 500,000 / m2
      { price: 42_000_000, area: 60 }, // 700,000 / m2
    ];
    // average price/m2 = 600,000
    const result = computeValuation(comparables, 60);
    expect(result).not.toBeNull();
    expect(result!.comparablesCount).toBe(2);
    expect(result!.marketValue).toBe(36_000_000); // 600,000 * 60
  });

  it('applies the urgent (0.90) and market (0.93) multipliers', () => {
    const comparables = [{ price: 30_000_000, area: 60 }]; // 500,000 / m2
    const result = computeValuation(comparables, 60)!;
    expect(result.marketValue).toBe(30_000_000);
    expect(result.urgentPrice).toBe(Math.round(30_000_000 * URGENT_SALE_MULTIPLIER));
    expect(result.marketPrice).toBe(Math.round(30_000_000 * MARKET_SALE_MULTIPLIER));
  });

  it('scales price per m2 by the target area, not the comparable area', () => {
    const comparables = [{ price: 30_000_000, area: 60 }]; // 500,000 / m2
    const result = computeValuation(comparables, 45)!;
    expect(result.marketValue).toBe(500_000 * 45);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd delivery/backend && npx vitest run src/__tests__/valuation.service.test.ts`
Expected: FAIL — `Cannot find module '../lib/valuation.service'`

- [ ] **Step 3: Implement**

`delivery/backend/src/lib/valuation.service.ts`:

```typescript
export const URGENT_SALE_MULTIPLIER = 0.9;
export const MARKET_SALE_MULTIPLIER = 0.93;

export interface Comparable {
  price: number;
  area: number;
}

export interface ValuationResult {
  marketValue: number;
  urgentPrice: number;
  marketPrice: number;
  comparablesCount: number;
}

export function computeValuation(
  comparables: Comparable[],
  targetArea: number
): ValuationResult | null {
  if (comparables.length === 0) {
    return null;
  }

  const avgPricePerSqm =
    comparables.reduce((sum, c) => sum + c.price / c.area, 0) / comparables.length;

  const marketValue = Math.round(avgPricePerSqm * targetArea);

  return {
    marketValue,
    urgentPrice: Math.round(marketValue * URGENT_SALE_MULTIPLIER),
    marketPrice: Math.round(marketValue * MARKET_SALE_MULTIPLIER),
    comparablesCount: comparables.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd delivery/backend && npx vitest run src/__tests__/valuation.service.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add delivery/backend/src/lib/valuation.service.ts delivery/backend/src/__tests__/valuation.service.test.ts
git commit -m "feat(backend): add pure valuation math (0.90/0.93 multipliers)"
```

---

### Task 3: Broker assignment — extract `lead-assignment.ts`

`public-forms.routes.ts` (`delivery/backend/src/routes/public-forms.routes.ts:42-63`) currently inlines round-robin/fallback broker assignment. Extract it to a pure, DB-free function so both the existing form-submit route and the new property-leads route (Task 8) share one implementation.

**Files:**
- Create: `delivery/backend/src/lib/lead-assignment.ts`
- Test: `delivery/backend/src/__tests__/lead-assignment.test.ts`
- Modify: `delivery/backend/src/routes/public-forms.routes.ts`

- [ ] **Step 1: Write the failing test**

`delivery/backend/src/__tests__/lead-assignment.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickBroker } from '../lib/lead-assignment';

describe('pickBroker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the explicit brokerId when provided, ignoring the pool', () => {
    const result = pickBroker({
      explicitBrokerId: 'broker_explicit',
      distributionType: 'MANUAL',
      brokerPool: ['broker_a', 'broker_b'],
    });
    expect(result).toEqual({ brokerId: 'broker_explicit', isFallback: false });
  });

  it('picks randomly from the pool on ROUND_ROBIN with no explicit broker', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // forces last index
    const result = pickBroker({
      explicitBrokerId: undefined,
      distributionType: 'ROUND_ROBIN',
      brokerPool: ['broker_a', 'broker_b'],
    });
    expect(result).toEqual({ brokerId: 'broker_b', isFallback: false });
  });

  it('returns isFallback=true and no brokerId when the pool is empty and no fallback is given', () => {
    const result = pickBroker({
      explicitBrokerId: undefined,
      distributionType: 'ROUND_ROBIN',
      brokerPool: [],
    });
    expect(result).toEqual({ brokerId: undefined, isFallback: true });
  });

  it('uses the fallback broker id when the pool is empty', () => {
    const result = pickBroker({
      explicitBrokerId: undefined,
      distributionType: 'MANUAL',
      brokerPool: [],
      fallbackBrokerId: 'admin_001',
    });
    expect(result).toEqual({ brokerId: 'admin_001', isFallback: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd delivery/backend && npx vitest run src/__tests__/lead-assignment.test.ts`
Expected: FAIL — `Cannot find module '../lib/lead-assignment'`

- [ ] **Step 3: Implement**

`delivery/backend/src/lib/lead-assignment.ts`:

```typescript
export interface PickBrokerInput {
  explicitBrokerId?: string;
  distributionType: 'MANUAL' | 'ROUND_ROBIN';
  brokerPool: string[];
  fallbackBrokerId?: string;
}

export interface PickBrokerResult {
  brokerId: string | undefined;
  isFallback: boolean;
}

export function pickBroker(input: PickBrokerInput): PickBrokerResult {
  if (input.explicitBrokerId) {
    return { brokerId: input.explicitBrokerId, isFallback: false };
  }

  if (input.distributionType === 'ROUND_ROBIN' && input.brokerPool.length > 0) {
    const randomIndex = Math.floor(Math.random() * input.brokerPool.length);
    return { brokerId: input.brokerPool[randomIndex], isFallback: false };
  }

  if (input.fallbackBrokerId) {
    return { brokerId: input.fallbackBrokerId, isFallback: true };
  }

  return { brokerId: undefined, isFallback: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd delivery/backend && npx vitest run src/__tests__/lead-assignment.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire `public-forms.routes.ts` to use it**

In `delivery/backend/src/routes/public-forms.routes.ts`, add the import at the top:

```typescript
import { pickBroker } from '../lib/lead-assignment';
```

Replace lines 42-63 (the inline `assignedBrokerId`/`isFallback` block) with:

```typescript
        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        const { brokerId: assignedBrokerId, isFallback } = pickBroker({
            explicitBrokerId: brokerId,
            distributionType: form.distributionType as 'MANUAL' | 'ROUND_ROBIN',
            brokerPool: form.brokers.map((b) => b.id),
            fallbackBrokerId: admin?.id,
        });
```

Delete the old `let assignedBrokerId = brokerId;` line and the old `let isFallback = false;` declaration and its associated `if (!assignedBrokerId) { ... admin lookup ... }` block that followed (they are now replaced by the block above). The rest of the handler (from `if (!assignedBrokerId) { res.status(500)... }` onward) stays unchanged.

- [ ] **Step 6: Run the full backend test suite to confirm nothing broke**

Run: `cd delivery/backend && npx vitest run src/__tests__/lead-assignment.test.ts src/__tests__/valuation.service.test.ts src/__tests__/property-calculator.test.ts`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add delivery/backend/src/lib/lead-assignment.ts delivery/backend/src/__tests__/lead-assignment.test.ts delivery/backend/src/routes/public-forms.routes.ts
git commit -m "refactor(backend): extract broker round-robin assignment into pure lead-assignment.ts"
```

---

## Backend: new public routes

### Task 4: `POST /api/public/valuation`

**Files:**
- Create: `delivery/backend/src/routes/public-valuation.routes.ts`
- Test: `delivery/backend/src/__tests__/public-valuation.routes.test.ts`
- Modify: `delivery/backend/src/index.ts`

- [ ] **Step 1: Write the failing test (Prisma mocked, no live DB needed)**

`delivery/backend/src/__tests__/public-valuation.routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';
import { publicValuationRouter } from '../routes/public-valuation.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/valuation', publicValuationRouter);
  return app;
}

describe('POST /api/public/valuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400s on missing fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/valuation').send({ district: 'Бостандыкский' });
    expect(res.status).toBe(400);
  });

  it('returns a price range when comparables exist', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([
      { price: 30_000_000, area: 60 },
      { price: 42_000_000, area: 60 },
    ]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/valuation')
      .send({ district: 'Бостандыкский', rooms: 2, area: 60 });

    expect(res.status).toBe(200);
    expect(res.body.comparablesCount).toBe(2);
    expect(res.body.marketValue).toBe(36_000_000);
    expect(res.body.urgentPrice).toBeLessThan(res.body.marketValue);
    expect(res.body.marketPrice).toBeLessThan(res.body.marketValue);
  });

  it('422s when there are no comparables in the district/room combination', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/valuation')
      .send({ district: 'Турксибский', rooms: 4, area: 90 });

    expect(res.status).toBe(422);
    expect(res.body.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-valuation.routes.test.ts`
Expected: FAIL — `Cannot find module '../routes/public-valuation.routes'`

- [ ] **Step 3: Implement the route**

`delivery/backend/src/routes/public-valuation.routes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { computeValuation } from '../lib/valuation.service';

export const publicValuationRouter = Router();

const valuationRequestSchema = z.object({
  district: z.string().min(1),
  rooms: z.number().int().positive(),
  area: z.number().positive(),
});

publicValuationRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { district, rooms, area } = valuationRequestSchema.parse(req.body);

    const comparables = await prisma.crmProperty.findMany({
      where: {
        district,
        rooms,
        funnelStage: { in: ['LEADS', 'SHOWS', 'DEAL', 'SOLD'] },
      },
      select: { price: true, area: true },
    });

    const numericComparables = comparables.map((c) => ({
      price: Number(c.price),
      area: Number(c.area),
    }));

    const result = computeValuation(numericComparables, area);

    if (!result) {
      res.status(422).json({ error: 'Недостаточно данных по этому району' });
      return;
    }

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Public valuation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 4: Register the router**

In `delivery/backend/src/index.ts`, add the import near the other public route import (after line 26, `import { publicFormsRouter } from './routes/public-forms.routes';`):

```typescript
import { publicValuationRouter } from './routes/public-valuation.routes';
```

And add the mount line right after `app.use('/api/public/forms', publicFormsRouter);` (line 129):

```typescript
app.use('/api/public/valuation', publicValuationRouter);
```

- [ ] **Step 5: Install supertest as a dependency if not already present, then run the test**

Run: `cd delivery/backend && npm ls supertest`
Expected: it is already a devDependency (see `package.json` — `supertest": "^7.2.2"`), so no install needed.

Run: `cd delivery/backend && npx vitest run src/__tests__/public-valuation.routes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add delivery/backend/src/routes/public-valuation.routes.ts delivery/backend/src/__tests__/public-valuation.routes.test.ts delivery/backend/src/index.ts
git commit -m "feat(backend): add public valuation endpoint"
```

---

### Task 5: `GET /api/public/properties` and `GET /api/public/properties/:id`

**Files:**
- Create: `delivery/backend/src/routes/public-properties.routes.ts`
- Test: `delivery/backend/src/__tests__/public-properties.routes.test.ts`
- Modify: `delivery/backend/src/index.ts`

- [ ] **Step 1: Write the failing test**

`delivery/backend/src/__tests__/public-properties.routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';
import { publicPropertiesRouter } from '../routes/public-properties.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/properties', publicPropertiesRouter);
  return app;
}

const SAMPLE = {
  id: 'prop_1',
  district: 'Бостандыкский',
  residentialComplex: 'Comfort City',
  address: 'ул. Розыбакиева 100',
  lat: 43.2,
  lng: 76.89,
  rooms: 2,
  area: '60.00',
  price: '36000000.00',
  images: ['https://example.com/1.jpg'],
  floor: 5,
  totalFloors: 9,
  buildingType: 'MONOLITH',
  repairState: 'EURO',
  balconyType: 'LOGGIA',
};

describe('GET /api/public/properties', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists published Almaty properties as cards', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([SAMPLE]);

    const app = buildApp();
    const res = await request(app).get('/api/public/properties');

    expect(res.status).toBe(200);
    expect(res.body.properties).toHaveLength(1);
    expect(res.body.properties[0]).toMatchObject({
      id: 'prop_1',
      district: 'Бостандыкский',
      residentialComplex: 'Comfort City',
    });
    expect(prisma.crmProperty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          funnelStage: 'LEADS',
        }),
      })
    );
  });
});

describe('GET /api/public/properties/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full detail for a published property', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue(SAMPLE);

    const app = buildApp();
    const res = await request(app).get('/api/public/properties/prop_1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'prop_1', floor: 5, totalFloors: 9 });
  });

  it('404s when the property does not exist or is not published', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/public/properties/missing');

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-properties.routes.test.ts`
Expected: FAIL — `Cannot find module '../routes/public-properties.routes'`

- [ ] **Step 3: Implement**

`delivery/backend/src/routes/public-properties.routes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const publicPropertiesRouter = Router();

const CARD_SELECT = {
  id: true,
  district: true,
  residentialComplex: true,
  address: true,
  lat: true,
  lng: true,
  rooms: true,
  area: true,
  price: true,
  images: true,
};

const DETAIL_SELECT = {
  ...CARD_SELECT,
  floor: true,
  totalFloors: true,
  buildingType: true,
  repairState: true,
  balconyType: true,
};

function serializeCard(property: any) {
  return {
    ...property,
    area: Number(property.area),
    price: Number(property.price),
  };
}

// GET /api/public/properties?city=Алматы&district=...
publicPropertiesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { city = 'Алматы', district } = req.query;

    const where: any = {
      city: city as string,
      funnelStage: 'LEADS',
      publishedAt: { not: null },
    };
    if (district) {
      where.district = district as string;
    }

    const properties = await prisma.crmProperty.findMany({
      where,
      select: CARD_SELECT,
      orderBy: { publishedAt: 'desc' },
    });

    res.json({ properties: properties.map(serializeCard) });
  } catch (error) {
    console.error('Public properties list error:', error);
    res.status(500).json({ error: 'Ошибка получения списка объектов' });
  }
});

// GET /api/public/properties/:id
publicPropertiesRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const property = await prisma.crmProperty.findFirst({
      where: { id, funnelStage: 'LEADS', publishedAt: { not: null } },
      select: DETAIL_SELECT,
    });

    if (!property) {
      res.status(404).json({ error: 'Объявление не найдено' });
      return;
    }

    res.json(serializeCard(property));
  } catch (error) {
    console.error('Public property detail error:', error);
    res.status(500).json({ error: 'Ошибка получения объявления' });
  }
});
```

Note: this route filters `funnelStage: 'LEADS'` specifically (not the wider set used by the valuation route in Task 4). Rationale: the valuation route wants every comparable ever sold or being marketed (to have enough data points); the public catalog should only ever show objects a broker is *actively* marketing right now (`LEADS`) — an object in `SHOWS`/`DEAL`/`SOLD` should not still appear as "for sale" in the buyer-facing catalog.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-properties.routes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Register the router**

In `delivery/backend/src/index.ts`, add the import after the valuation import:

```typescript
import { publicPropertiesRouter } from './routes/public-properties.routes';
```

Add the mount line after `app.use('/api/public/valuation', publicValuationRouter);`:

```typescript
app.use('/api/public/properties', publicPropertiesRouter);
```

- [ ] **Step 6: Commit**

```bash
git add delivery/backend/src/routes/public-properties.routes.ts delivery/backend/src/__tests__/public-properties.routes.test.ts delivery/backend/src/index.ts
git commit -m "feat(backend): add public property catalog endpoints"
```

---

### Task 6: `POST /api/public/viewing-requests`

**Files:**
- Create: `delivery/backend/src/routes/public-viewing-requests.routes.ts`
- Test: `delivery/backend/src/__tests__/public-viewing-requests.routes.test.ts`
- Modify: `delivery/backend/src/index.ts`

- [ ] **Step 1: Write the failing test**

`delivery/backend/src/__tests__/public-viewing-requests.routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: { findUnique: vi.fn() },
    viewingRequest: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicViewingRequestsRouter } from '../routes/public-viewing-requests.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/viewing-requests', publicViewingRequestsRouter);
  return app;
}

describe('POST /api/public/viewing-requests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s on missing fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/viewing-requests').send({ propertyId: 'p1' });
    expect(res.status).toBe(400);
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .post('/api/public/viewing-requests')
      .send({ propertyId: 'missing', name: 'Аружан', phone: '+77001234567' });
    expect(res.status).toBe(404);
  });

  it('creates a viewing request for an existing property', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.viewingRequest.create as any).mockResolvedValue({ id: 'vr_1' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/viewing-requests')
      .send({ propertyId: 'p1', name: 'Аружан', phone: '+77001234567' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true });
    expect(prisma.viewingRequest.create).toHaveBeenCalledWith({
      data: { propertyId: 'p1', name: 'Аружан', phone: '+77001234567' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-viewing-requests.routes.test.ts`
Expected: FAIL — `Cannot find module '../routes/public-viewing-requests.routes'`

- [ ] **Step 3: Implement**

`delivery/backend/src/routes/public-viewing-requests.routes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const publicViewingRequestsRouter = Router();

const viewingRequestSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
});

publicViewingRequestsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId, name, phone } = viewingRequestSchema.parse(req.body);

    const property = await prisma.crmProperty.findUnique({ where: { id: propertyId } });
    if (!property) {
      res.status(404).json({ error: 'Объявление не найдено' });
      return;
    }

    await prisma.viewingRequest.create({ data: { propertyId, name, phone } });

    res.status(201).json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Viewing request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-viewing-requests.routes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Register the router**

In `delivery/backend/src/index.ts`, add the import after the properties import:

```typescript
import { publicViewingRequestsRouter } from './routes/public-viewing-requests.routes';
```

Add the mount line after the properties mount:

```typescript
app.use('/api/public/viewing-requests', publicViewingRequestsRouter);
```

- [ ] **Step 6: Commit**

```bash
git add delivery/backend/src/routes/public-viewing-requests.routes.ts delivery/backend/src/__tests__/public-viewing-requests.routes.test.ts delivery/backend/src/index.ts
git commit -m "feat(backend): add public viewing-request intake endpoint"
```

---

### Task 7: Structured field mapping in `public-forms.routes.ts`

Today, `POST /api/public/forms/:id/submit` dumps every field into `Seller.managerComment` as raw text (see `delivery/backend/src/routes/public-forms.routes.ts:118-121`). The `/otsenka` wizard (Task 11) will submit a computed `expectedPrice` — capture it on the structured `Seller.expectedPrice` field too, not just in the text dump.

**Files:**
- Modify: `delivery/backend/src/routes/public-forms.routes.ts`
- Test: `delivery/backend/src/__tests__/public-forms.routes.test.ts` (new — this router had no dedicated unit test before)

- [ ] **Step 1: Write the failing test**

`delivery/backend/src/__tests__/public-forms.routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    leadForm: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    seller: { findFirst: vi.fn(), create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicFormsRouter } from '../routes/public-forms.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/forms', publicFormsRouter);
  return app;
}

describe('POST /api/public/forms/:id/submit — structured fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes expectedPrice onto the Seller when the form includes it', async () => {
    (prisma.leadForm.findUnique as any).mockResolvedValue({
      id: 'form_1',
      title: 'Мастер оценки — Алматы',
      isActive: true,
      distributionType: 'ROUND_ROBIN',
      brokers: [{ id: 'broker_1' }],
    });
    (prisma.seller.findFirst as any).mockResolvedValue(null);
    (prisma.seller.create as any).mockResolvedValue({ id: 'seller_1' });
    (prisma.notification.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/public/forms/form_1/submit').send({
      name: 'Аружан',
      phone: '+77001234567',
      expectedPrice: '36000000',
    });

    expect(res.status).toBe(200);
    expect(prisma.seller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expectedPrice: 36000000,
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-forms.routes.test.ts`
Expected: FAIL — `expectedPrice` not present in the `seller.create` call (assertion failure), because the current handler only writes it into `managerComment`.

- [ ] **Step 3: Implement the structured mapping**

In `delivery/backend/src/routes/public-forms.routes.ts`, after the existing field extraction block (`const typeVal = ...`, around line 116), add:

```typescript
        const expectedPriceVal =
            normalizedData['expectedprice'] ||
            normalizedData['ожидаемая цена'] ||
            normalizedData['expected_price'];

        const parsedExpectedPrice = expectedPriceVal ? Number(expectedPriceVal) : undefined;
```

Then, in the `prisma.seller.create` call's `data` object (around line 133-142), add the field:

```typescript
                data: {
                    brokerId: assignedBrokerId,
                    firstName,
                    lastName,
                    phone: phoneVal,
                    source: `FORM: ${form.title}`,
                    expectedPrice: parsedExpectedPrice,
                    managerComment: `Данные формы:\n${fullNoteContent}\n\n${isFallback ? '[WARNING: No brokers assigned, sent to Admin]' : ''}\n${brokerId ? '[PERSONAL LINK]' : ''}`,
                    funnelStage: 'CONTACT', // Start stage of Seller Funnel
                }
```

(`typeVal` and `budgetVal` were already extracted but unused by the original code — leave them as-is; they are out of scope for this change.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-forms.routes.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add delivery/backend/src/routes/public-forms.routes.ts delivery/backend/src/__tests__/public-forms.routes.test.ts
git commit -m "feat(backend): map expectedPrice onto Seller in public lead-form submission"
```

---

### Task 8: `POST /api/public/property-leads` (the "Добавить квартиру" intake)

Creates a `Seller` (funnel stage `CONTACT`) and a draft `CrmProperty` (funnel stage `CREATED`) in one transaction, from the 4-step public wizard in Task 12.

**Files:**
- Create: `delivery/backend/src/routes/public-property-leads.routes.ts`
- Test: `delivery/backend/src/__tests__/public-property-leads.routes.test.ts`
- Modify: `delivery/backend/src/index.ts`

- [ ] **Step 1: Write the failing test**

`delivery/backend/src/__tests__/public-property-leads.routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    seller: { create: vi.fn() },
    crmProperty: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicPropertyLeadsRouter } from '../routes/public-property-leads.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/property-leads', publicPropertyLeadsRouter);
  return app;
}

const VALID_BODY = {
  district: 'Бостандыкский',
  residentialComplex: 'Comfort City',
  address: 'ул. Розыбакиева',
  houseNumber: '100',
  price: 36_000_000,
  negotiable: true,
  moveInReady: false,
  furnished: false,
  hasAppliances: false,
  rooms: 2,
  area: 60,
  contactName: 'Аружан',
  contactPhone: '+77001234567',
};

describe('POST /api/public/property-leads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s on missing required fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/property-leads').send({ district: 'Бостандыкский' });
    expect(res.status).toBe(400);
  });

  it('creates a Seller and a draft CrmProperty, assigns to an available admin, and returns sellerId', async () => {
    (prisma.user.findFirst as any).mockResolvedValue({ id: 'admin_001' });
    (prisma.seller.create as any).mockResolvedValue({ id: 'seller_1' });
    (prisma.crmProperty.create as any).mockResolvedValue({ id: 'crmprop_1' });
    (prisma.notification.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/public/property-leads').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, sellerId: 'seller_1' });

    expect(prisma.seller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          brokerId: 'admin_001',
          firstName: 'Аружан',
          phone: '+77001234567',
          funnelStage: 'CONTACT',
          source: 'Форма: Добавить квартиру',
        }),
      })
    );

    expect(prisma.crmProperty.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          district: 'Бостандыкский',
          residentialComplex: 'Comfort City',
          rooms: 2,
          price: 36_000_000,
          funnelStage: 'CREATED',
          sellerId: 'seller_1',
          brokerId: 'admin_001',
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-property-leads.routes.test.ts`
Expected: FAIL — `Cannot find module '../routes/public-property-leads.routes'`

- [ ] **Step 3: Implement**

`delivery/backend/src/routes/public-property-leads.routes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { pickBroker } from '../lib/lead-assignment';

export const publicPropertyLeadsRouter = Router();

const propertyLeadSchema = z.object({
  district: z.string().min(1),
  residentialComplex: z.string().min(1),
  address: z.string().min(1),
  houseNumber: z.string().min(1),
  price: z.number().positive(),
  negotiable: z.boolean(),
  moveInReady: z.boolean(),
  furnished: z.boolean(),
  hasAppliances: z.boolean(),
  rooms: z.number().int().positive(),
  area: z.number().positive(),
  contactName: z.string().min(1),
  contactPhone: z.string().min(1),
  photoUrls: z.array(z.string()).optional(),
});

publicPropertyLeadsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = propertyLeadSchema.parse(req.body);

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const { brokerId, isFallback } = pickBroker({
      distributionType: 'MANUAL',
      brokerPool: [],
      fallbackBrokerId: admin?.id,
    });

    if (!brokerId) {
      res.status(500).json({ error: 'No broker available to assign lead' });
      return;
    }

    const nameParts = data.contactName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const seller = await prisma.seller.create({
      data: {
        brokerId,
        firstName,
        lastName,
        phone: data.contactPhone,
        source: 'Форма: Добавить квартиру',
        funnelStage: 'CONTACT',
      },
    });

    const fullAddress = `${data.address}, д. ${data.houseNumber}`;

    const property = await prisma.crmProperty.create({
      data: {
        district: data.district,
        residentialComplex: data.residentialComplex,
        address: fullAddress,
        rooms: data.rooms,
        area: data.area,
        floor: 0,
        totalFloors: 0,
        yearBuilt: new Date().getFullYear(),
        price: data.price,
        images: data.photoUrls ?? [],
        funnelStage: 'CREATED',
        sellerId: seller.id,
        brokerId,
      },
    });

    await prisma.notification.create({
      data: {
        userId: brokerId,
        type: 'DEAL',
        title: 'Новая заявка на продажу',
        message: `${firstName} ${lastName} хочет продать квартиру: ${data.residentialComplex}, ${data.district}.${isFallback ? ' [Назначено автоматически]' : ''}`,
        isRead: false,
      },
    });

    res.json({ success: true, sellerId: seller.id, crmPropertyId: property.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Property lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Note: `floor`, `totalFloors`, and `yearBuilt` are required (non-nullable) on `CrmProperty` but the 4-step public wizard (Task 12) does not collect them — they are filled with placeholder values (`0`, `0`, current year) for the broker to correct during the `INTERVIEW` stage, consistent with how `CrmProperty` today already treats `CREATED`-stage objects as incomplete drafts.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd delivery/backend && npx vitest run src/__tests__/public-property-leads.routes.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Register the router**

In `delivery/backend/src/index.ts`, add the import after the viewing-requests import:

```typescript
import { publicPropertyLeadsRouter } from './routes/public-property-leads.routes';
```

Add the mount line after the viewing-requests mount:

```typescript
app.use('/api/public/property-leads', publicPropertyLeadsRouter);
```

- [ ] **Step 6: Commit**

```bash
git add delivery/backend/src/routes/public-property-leads.routes.ts delivery/backend/src/__tests__/public-property-leads.routes.test.ts delivery/backend/src/index.ts
git commit -m "feat(backend): add public property-lead intake endpoint (Добавить квартиру)"
```

---

### Task 9: Almaty seed script

Populates comparables for Task 4's valuation and cards for Task 5's catalog. This step requires a live `DATABASE_URL` to actually run — it is written now and executed whenever the implementer (or the user) has a database available; it is not part of the automated test suite.

**Files:**
- Create: `delivery/backend/prisma/seed-almaty.ts`
- Modify: `delivery/backend/package.json`

- [ ] **Step 1: Write the seed script**

`delivery/backend/prisma/seed-almaty.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AlmatySeedRecord {
  district: string;
  residentialComplex: string;
  address: string;
  lat: number;
  lng: number;
  rooms: number;
  area: number;
  price: number;
}

// Representative data — districts, complexes and price ranges are illustrative,
// standing in for real Almaty market data until a real listings source is provided
// (see docs/superpowers/specs/2026-07-27-casa-procasa-integration-design.md).
const RECORDS: AlmatySeedRecord[] = [
  { district: 'Бостандыкский', residentialComplex: 'Comfort City', address: 'ул. Розыбакиева 100', lat: 43.2015, lng: 76.8930, rooms: 1, area: 42, price: 25_000_000 },
  { district: 'Бостандыкский', residentialComplex: 'Comfort City', address: 'ул. Розыбакиева 100', lat: 43.2015, lng: 76.8930, rooms: 2, area: 60, price: 36_000_000 },
  { district: 'Бостандыкский', residentialComplex: 'Comfort City', address: 'ул. Розыбакиева 100', lat: 43.2015, lng: 76.8930, rooms: 3, area: 85, price: 49_000_000 },
  { district: 'Бостандыкский', residentialComplex: 'Green Residence', address: 'ул. Тимирязева 50', lat: 43.2100, lng: 76.9050, rooms: 2, area: 58, price: 38_500_000 },
  { district: 'Бостандыкский', residentialComplex: 'Green Residence', address: 'ул. Тимирязева 50', lat: 43.2100, lng: 76.9050, rooms: 3, area: 90, price: 55_000_000 },
  { district: 'Алмалинский', residentialComplex: 'Central Park', address: 'ул. Абылай хана 45', lat: 43.2570, lng: 76.9280, rooms: 1, area: 40, price: 28_000_000 },
  { district: 'Алмалинский', residentialComplex: 'Central Park', address: 'ул. Абылай хана 45', lat: 43.2570, lng: 76.9280, rooms: 2, area: 62, price: 42_000_000 },
  { district: 'Алмалинский', residentialComplex: 'Достар', address: 'ул. Гоголя 30', lat: 43.2530, lng: 76.9420, rooms: 3, area: 88, price: 58_000_000 },
  { district: 'Алмалинский', residentialComplex: 'Достар', address: 'ул. Гоголя 30', lat: 43.2530, lng: 76.9420, rooms: 1, area: 38, price: 27_500_000 },
  { district: 'Медеуский', residentialComplex: 'Botanica', address: 'ул. Курмангазы 120', lat: 43.2220, lng: 76.9550, rooms: 2, area: 65, price: 45_000_000 },
  { district: 'Медеуский', residentialComplex: 'Botanica', address: 'ул. Курмангазы 120', lat: 43.2220, lng: 76.9550, rooms: 3, area: 95, price: 68_000_000 },
  { district: 'Медеуский', residentialComplex: 'Kok-Tobe View', address: 'ул. Достык 200', lat: 43.2300, lng: 76.9700, rooms: 2, area: 70, price: 52_000_000 },
  { district: 'Ауэзовский', residentialComplex: 'Аксай Тау', address: 'мкр. Аксай-4 12', lat: 43.2390, lng: 76.8540, rooms: 1, area: 39, price: 18_500_000 },
  { district: 'Ауэзовский', residentialComplex: 'Аксай Тау', address: 'мкр. Аксай-4 12', lat: 43.2390, lng: 76.8540, rooms: 2, area: 56, price: 24_000_000 },
  { district: 'Ауэзовский', residentialComplex: 'Шаль', address: 'ул. Шаляпина 15', lat: 43.2280, lng: 76.8650, rooms: 3, area: 80, price: 32_000_000 },
  { district: 'Наурызбайский', residentialComplex: 'Golden City', address: 'мкр. Шугыла 5', lat: 43.1980, lng: 76.8180, rooms: 2, area: 55, price: 20_000_000 },
  { district: 'Наурызбайский', residentialComplex: 'Golden City', address: 'мкр. Шугыла 5', lat: 43.1980, lng: 76.8180, rooms: 3, area: 78, price: 27_000_000 },
  { district: 'Турксибский', residentialComplex: 'Северное Сияние', address: 'ул. Пугачева 8', lat: 43.3050, lng: 76.9020, rooms: 1, area: 40, price: 16_500_000 },
  { district: 'Турксибский', residentialComplex: 'Северное Сияние', address: 'ул. Пугачева 8', lat: 43.3050, lng: 76.9020, rooms: 2, area: 58, price: 22_000_000 },
  { district: 'Жетысуский', residentialComplex: 'Мирас', address: 'ул. Радостовца 200', lat: 43.2790, lng: 76.8340, rooms: 2, area: 54, price: 19_500_000 },
  { district: 'Жетысуский', residentialComplex: 'Мирас', address: 'ул. Радостовца 200', lat: 43.2790, lng: 76.8340, rooms: 3, area: 76, price: 26_000_000 },
  { district: 'Алатауский', residentialComplex: 'Изумрудный Квартал', address: 'мкр. Кундызды 3', lat: 43.3020, lng: 76.8010, rooms: 1, area: 41, price: 15_000_000 },
  { district: 'Алатауский', residentialComplex: 'Изумрудный Квартал', address: 'мкр. Кундызды 3', lat: 43.3020, lng: 76.8010, rooms: 2, area: 57, price: 19_000_000 },
];

async function main() {
  const broker = await prisma.user.findFirst({ where: { role: 'BROKER' } });
  if (!broker) {
    throw new Error('No BROKER user found — run the base seed.sql first');
  }

  for (const record of RECORDS) {
    const seller = await prisma.seller.create({
      data: {
        brokerId: broker.id,
        firstName: 'Продавец',
        lastName: record.residentialComplex,
        phone: `+7700${Math.floor(1000000 + Math.random() * 8999999)}`,
        source: 'Almaty seed dataset',
        funnelStage: 'CONTRACT_SIGNING',
      },
    });

    await prisma.crmProperty.create({
      data: {
        district: record.district,
        residentialComplex: record.residentialComplex,
        address: record.address,
        lat: record.lat,
        lng: record.lng,
        rooms: record.rooms,
        area: record.area,
        floor: Math.min(5, record.rooms + 2),
        totalFloors: 9,
        yearBuilt: 2015,
        price: record.price,
        marketPrice: record.price,
        images: [],
        funnelStage: 'LEADS',
        publishedAt: new Date(),
        sellerId: seller.id,
        brokerId: broker.id,
      },
    });
  }

  console.log(`Seeded ${RECORDS.length} Almaty CrmProperty records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add an npm script**

In `delivery/backend/package.json`, add this line inside `"scripts"`, right after `"db:seed:production": "tsx src/prisma/seed.production.ts",`:

```json
    "db:seed:almaty": "tsx prisma/seed-almaty.ts",
```

- [ ] **Step 3: Verify the script type-checks (no DB required for this check)**

Run: `cd delivery/backend && npx tsc --noEmit prisma/seed-almaty.ts`
Expected: no type errors. (If `tsc --noEmit` on a single file complains about missing project config, instead run the whole-project check: `npx tsc --noEmit`.)

- [ ] **Step 4: Run it for real, only if `DATABASE_URL` is configured and reachable**

Run: `cd delivery/backend && npm run db:seed:almaty`
Expected: `Seeded 23 Almaty CrmProperty records.` — if there is no reachable database in this environment, skip this step; it is the user's or a later deploy's responsibility to run it against the real pro-casa Postgres instance.

- [ ] **Step 5: Commit**

```bash
git add delivery/backend/prisma/seed-almaty.ts delivery/backend/package.json
git commit -m "feat(backend): add representative Almaty seed dataset for valuation and catalog"
```

---

## Frontend: API client and `/otsenka` rewire

### Task 10: `procasa-client.ts`

**Files:**
- Create: `lib/api/procasa-client.ts`
- Test: `lib/api/__tests__/procasa-client.test.ts`
- Modify: `.env.example` at repo root (create if absent)

- [ ] **Step 1: Write the failing test**

`lib/api/__tests__/procasa-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getValuation, getProperties, getProperty, submitViewingRequest, submitPropertyLead, submitLeadForm } from "../procasa-client";

const originalFetch = global.fetch;

describe("procasa-client", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("getValuation posts to /api/public/valuation and returns parsed JSON on success", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ marketValue: 36_000_000, urgentPrice: 32_400_000, marketPrice: 33_480_000, comparablesCount: 2 }),
    });

    const result = await getValuation({ district: "Бостандыкский", rooms: 2, area: 60 });

    expect(result).toEqual({ status: "ready", marketValue: 36_000_000, urgentPrice: 32_400_000, marketPrice: 33_480_000, comparablesCount: 2 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/valuation"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getValuation returns insufficient_data on a 422", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "no data" }) });

    const result = await getValuation({ district: "Турксибский", rooms: 4, area: 120 });

    expect(result).toEqual({ status: "insufficient_data" });
  });

  it("getProperties fetches the catalog list", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ properties: [{ id: "p1" }] }) });

    const result = await getProperties();

    expect(result).toEqual([{ id: "p1" }]);
  });

  it("getProperty fetches a single property or null on 404", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    const result = await getProperty("missing");

    expect(result).toBeNull();
  });

  it("submitViewingRequest posts and returns true on success", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    const result = await submitViewingRequest({ propertyId: "p1", name: "Аружан", phone: "+7700" });

    expect(result).toBe(true);
  });

  it("submitPropertyLead posts and returns sellerId on success", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, sellerId: "s1" }) });

    const result = await submitPropertyLead({
      district: "Бостандыкский",
      residentialComplex: "Comfort City",
      address: "ул. Розыбакиева",
      houseNumber: "100",
      price: 36_000_000,
      negotiable: true,
      moveInReady: false,
      furnished: false,
      hasAppliances: false,
      rooms: 2,
      area: 60,
      contactName: "Аружан",
      contactPhone: "+7700",
    });

    expect(result).toEqual({ success: true, sellerId: "s1" });
  });

  it("submitLeadForm posts form data to the given formId", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, sellerId: "s1" }) });

    const result = await submitLeadForm("form_1", { name: "Аружан", phone: "+7700", expectedPrice: "36000000" });

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/forms/form_1/submit"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/api/__tests__/procasa-client.test.ts`
Expected: FAIL — `Cannot find module '../procasa-client'`

- [ ] **Step 3: Implement**

`lib/api/procasa-client.ts`:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_PROCASA_API_URL ?? "http://localhost:3001";

export interface ValuationRequest {
  district: string;
  rooms: number;
  area: number;
}

export type ValuationResponse =
  | {
      status: "ready";
      marketValue: number;
      urgentPrice: number;
      marketPrice: number;
      comparablesCount: number;
    }
  | { status: "insufficient_data" };

export async function getValuation(request: ValuationRequest): Promise<ValuationResponse> {
  const res = await fetch(`${API_BASE_URL}/api/public/valuation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    return { status: "insufficient_data" };
  }

  const data = await res.json();
  return { status: "ready", ...data };
}

export interface PropertyCard {
  id: string;
  district: string;
  residentialComplex: string;
  address: string;
  lat: number;
  lng: number;
  rooms: number;
  area: number;
  price: number;
  images: string[];
}

export interface PropertyDetail extends PropertyCard {
  floor: number;
  totalFloors: number;
  buildingType: string;
  repairState: string;
  balconyType: string | null;
}

export async function getProperties(district?: string): Promise<PropertyCard[]> {
  const url = new URL(`${API_BASE_URL}/api/public/properties`);
  if (district) url.searchParams.set("district", district);

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  return data.properties;
}

export async function getProperty(id: string): Promise<PropertyDetail | null> {
  const res = await fetch(`${API_BASE_URL}/api/public/properties/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export interface ViewingRequestInput {
  propertyId: string;
  name: string;
  phone: string;
}

export async function submitViewingRequest(input: ViewingRequestInput): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/public/viewing-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.ok;
}

export interface PropertyLeadInput {
  district: string;
  residentialComplex: string;
  address: string;
  houseNumber: string;
  price: number;
  negotiable: boolean;
  moveInReady: boolean;
  furnished: boolean;
  hasAppliances: boolean;
  rooms: number;
  area: number;
  contactName: string;
  contactPhone: string;
  photoUrls?: string[];
}

export type PropertyLeadResult =
  | { success: true; sellerId: string }
  | { success: false };

export async function submitPropertyLead(input: PropertyLeadInput): Promise<PropertyLeadResult> {
  const res = await fetch(`${API_BASE_URL}/api/public/property-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return { success: false };
  return res.json();
}

export async function submitLeadForm(formId: string, formData: Record<string, string>): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/public/forms/${formId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
  return res.ok;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/api/__tests__/procasa-client.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Document the env var**

Create (or append to, if it exists) `.env.example` at the repository root:

```
NEXT_PUBLIC_PROCASA_API_URL=http://localhost:3001
NEXT_PUBLIC_OTSENKA_FORM_ID=
```

- [ ] **Step 6: Commit**

```bash
git add lib/api/procasa-client.ts lib/api/__tests__/procasa-client.test.ts .env.example
git commit -m "feat(frontend): add HTTP client for the pro-casa public API"
```

---

### Task 11: Rewire `/otsenka` onto the real API

Replaces `lib/mock/*` usage. District replaces free-text address matching — the "адрес не найден" branch goes away since a district is always explicitly chosen (per design doc §3).

**Files:**
- Modify: `components/wizard/OtsenkaWizard.tsx`
- Modify: `components/wizard/AddressConfirmStep.tsx` → rename to `components/wizard/DistrictStep.tsx`
- Modify: `components/wizard/ParamsStep.tsx`
- Modify: `components/wizard/ResultStep.tsx`
- Modify: `components/wizard/ContactStep.tsx`
- Delete: `lib/mock/addresses.ts`, `lib/mock/valuation.ts`, `lib/mock/types.ts`
- Test: `components/wizard/__tests__/OtsenkaWizard.test.tsx` (update existing tests to match)

- [ ] **Step 1: Check what the existing wizard tests assert, to know what must still pass or be intentionally changed**

Run: `npx vitest run components/wizard/__tests__ --reporter=verbose`
Expected: current suite passes (baseline). Read the output test names before proceeding — Steps below replace address-matching assertions with district-selection assertions and mock-valuation assertions with API-call assertions.

- [ ] **Step 2: Replace `AddressConfirmStep` with `DistrictStep`**

Delete `components/wizard/AddressConfirmStep.tsx` and its test, create `components/wizard/DistrictStep.tsx`:

```typescript
"use client";

const ALMATY_DISTRICTS = [
  "Алмалинский",
  "Ауэзовский",
  "Бостандыкский",
  "Медеуский",
  "Наурызбайский",
  "Турксибский",
  "Жетысуский",
  "Алатауский",
] as const;

export interface DistrictStepValue {
  district: string;
  residentialComplex: string;
}

interface DistrictStepProps {
  initialComplex: string;
  onConfirm: (value: DistrictStepValue) => void;
}

export function DistrictStep({ initialComplex, onConfirm }: DistrictStepProps) {
  return (
    <form
      className="rounded-card bg-white p-8 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const district = String(formData.get("district") ?? "");
        const residentialComplex = String(formData.get("residentialComplex") ?? "");
        if (!district || !residentialComplex) return;
        onConfirm({ district, residentialComplex });
      }}
    >
      <h2 className="text-2xl font-semibold">Где находится квартира?</h2>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="district">
        Район
      </label>
      <select
        id="district"
        name="district"
        aria-label="Район"
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
        defaultValue=""
        required
      >
        <option value="" disabled>
          Выберите район
        </option>
        {ALMATY_DISTRICTS.map((district) => (
          <option key={district} value={district}>
            {district}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm text-ink/70" htmlFor="residentialComplex">
        ЖК / адрес
      </label>
      <input
        id="residentialComplex"
        name="residentialComplex"
        type="text"
        required
        defaultValue={initialComplex}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <button
        type="submit"
        className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark"
      >
        Продолжить
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Update `ParamsStep` — no behavior change needed, just confirm the type import stays local**

`components/wizard/ParamsStep.tsx` currently imports `RepairCondition`/`ValuationParams` from `@/lib/mock/types` (line 4), which is being deleted in Step 6. Replace that import line:

```typescript
import { useState, type FormEvent } from "react";
```

Add the types directly in this file (right after the imports, before `REPAIR_OPTIONS`):

```typescript
export type RepairCondition = "fresh_repair" | "good_livable" | "cosmetic" | "needs_repair";

export interface ValuationParams {
  rooms: number;
  areaM2: number;
  floor: number;
  totalFloors: number;
  repairCondition: RepairCondition;
}
```

No other changes to this file are needed — its form fields and submit handler are unchanged.

- [ ] **Step 4: Update `ResultStep` to consume the real API response shape**

`components/wizard/ResultStep.tsx` — replace the whole file:

```typescript
"use client";

import type { ValuationResponse } from "@/lib/api/procasa-client";
import { formatTenge } from "@/lib/format";

interface ResultStepProps {
  valuation: ValuationResponse;
  onContinue: () => void;
}

export function ResultStep({ valuation, onContinue }: ResultStepProps) {
  if (valuation.status === "insufficient_data") {
    return (
      <div className="rounded-card bg-white p-8 shadow-sm">
        <span className="inline-block rounded-full bg-ink/5 px-3 py-1 text-sm text-ink/60">
          Данных пока недостаточно
        </span>
        <h2 className="mt-4 text-2xl font-semibold">
          Пока не можем точно оценить эту квартиру
        </h2>
        <p className="mt-2 text-ink/70">
          В этом районе ещё мало сравнимых объявлений. Наш эксперт свяжется с
          вами, чтобы сделать оценку вручную.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark"
        >
          Оставить контакты
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="rounded-card bg-white p-8 shadow-sm">
        <span className="inline-block rounded-full bg-ink/5 px-3 py-1 text-sm text-ink/60">
          Срочная продажа
        </span>
        <p className="mt-4 text-3xl font-semibold">{formatTenge(valuation.urgentPrice)}</p>
        <p className="mt-2 text-sm text-ink/60">Выкуп в течение нескольких дней</p>
      </div>

      <div className="rounded-card bg-accent-light p-8 shadow-sm ring-2 ring-accent">
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm text-white">
          Рыночная продажа
        </span>
        <p className="mt-4 text-3xl font-semibold">{formatTenge(valuation.marketPrice)}</p>
        <p className="mt-2 text-sm text-ink/60">Максимальная цена, дольше по срокам</p>
      </div>

      <p className="sm:col-span-2 text-xs text-ink/50">
        Оценка основана на {valuation.comparablesCount} сравнимых объектах в этом районе.
      </p>

      <button
        type="button"
        onClick={onContinue}
        className="sm:col-span-2 mt-2 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark"
      >
        Продолжить
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Update `ContactStep` to submit to the real lead form**

`components/wizard/ContactStep.tsx` — the form fields stay the same; only the submit wiring in the parent (`OtsenkaWizard.tsx`, Step 7) changes. No edits needed to this file.

- [ ] **Step 6: Delete the mock layer**

```bash
git rm lib/mock/addresses.ts lib/mock/valuation.ts lib/mock/types.ts
git rm components/wizard/AddressConfirmStep.tsx
git rm components/wizard/__tests__/AddressConfirmStep.test.tsx 2>/dev/null || true
```

(If `lib/mock/__tests__` contains tests for `addresses.ts`/`valuation.ts`, remove those too: `git rm lib/mock/__tests__/addresses.test.ts lib/mock/__tests__/valuation.test.ts 2>/dev/null || true`.)

- [ ] **Step 7: Rewrite `OtsenkaWizard.tsx`**

Replace the whole file:

```typescript
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getValuation, submitLeadForm, type ValuationResponse } from "@/lib/api/procasa-client";
import type { ValuationParams } from "./ParamsStep";
import { DistrictStep, type DistrictStepValue } from "./DistrictStep";
import { ParamsStep } from "./ParamsStep";
import { ResultStep } from "./ResultStep";
import { ContactStep, type ContactInfo } from "./ContactStep";
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

const OTSENKA_FORM_ID = process.env.NEXT_PUBLIC_OTSENKA_FORM_ID ?? "";

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const initialComplex = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [location, setLocation] = useState<DistrictStepValue | null>(null);
  const [params, setParams] = useState<ValuationParams | null>(null);
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [submitted, setSubmitted] = useState<ContactInfo | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress current={step} />

      {step === 1 && (
        <DistrictStep
          initialComplex={initialComplex}
          onConfirm={(value) => {
            setLocation(value);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <ParamsStep
          onSubmit={async (submittedParams: ValuationParams) => {
            setParams(submittedParams);
            const result = await getValuation({
              district: location!.district,
              rooms: submittedParams.rooms,
              area: submittedParams.areaM2,
            });
            setValuation(result);
            setStep(3);
          }}
        />
      )}

      {step === 3 && valuation && (
        <ResultStep valuation={valuation} onContinue={() => setStep(4)} />
      )}

      {step === 4 && !submitted && (
        <ContactStep
          onSubmit={async (contact) => {
            setSubmitted(contact);
            if (OTSENKA_FORM_ID) {
              await submitLeadForm(OTSENKA_FORM_ID, {
                name: contact.name,
                phone: contact.phone,
                district: location?.district ?? "",
                residentialComplex: location?.residentialComplex ?? "",
                rooms: String(params?.rooms ?? ""),
                area: String(params?.areaM2 ?? ""),
                expectedPrice:
                  valuation?.status === "ready" ? String(valuation.marketPrice) : "",
              });
            }
          }}
        />
      )}

      {step === 4 && submitted && (
        <div className="rounded-card bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">Спасибо, {submitted.name}!</h2>
          <p className="mt-2 text-ink/70">
            Мы свяжемся с вами по номеру {submitted.phone} в ближайшее время.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Update the wizard test suite**

Read the current `components/wizard/__tests__` directory (`components/wizard/__tests__/OtsenkaWizard.test.tsx` and any per-step test files) and adjust:
- Replace any `matchAddress`/`calculateValuation` mocks with `vi.mock("@/lib/api/procasa-client", ...)` mocking `getValuation` and `submitLeadForm`.
- Replace assertions about the "адрес не найден" / manual-district-select branch (that behavior no longer exists — district selection is now always explicit via `DistrictStep`).
- Keep assertions about the overall 4-step flow (params → result → contact → thank-you) — those still apply.

Since the exact current test file contents will be read live by the implementer, no single fixed diff is prescribed here; the acceptance bar is: **all wizard tests pass, and there is at least one test asserting `getValuation` is called with the selected district/rooms/area, and one asserting the insufficient-data (422) branch still renders the "Данных пока недостаточно" message.**

- [ ] **Step 9: Run the full frontend test suite**

Run: `npx vitest run`
Expected: all tests PASS, zero references to `lib/mock` remain (`grep -r "lib/mock" --include=*.tsx --include=*.ts .` returns nothing outside of this plan file).

- [ ] **Step 10: Manually verify in the browser**

Run: `npm run dev`, open `http://localhost:3000/otsenka`, and walk through: district select → params → result (requires the backend running with `DATABASE_URL` set and Task 9's seed applied, otherwise expect the "Данных пока недостаточно" branch) → contact → thank-you. Check the browser console for errors at each step.

- [ ] **Step 11: Commit**

```bash
git add components/wizard lib/api components/wizard/__tests__
git commit -m "feat(frontend): rewire /otsenka onto the real pro-casa valuation and lead-form API"
```

---

## Frontend: catalog and seller intake

### Task 12: `/catalog` and `/catalog/[id]`

**Files:**
- Create: `components/catalog/PropertyCard.tsx`
- Create: `components/catalog/CatalogMap.tsx`
- Create: `components/catalog/ViewingRequestForm.tsx`
- Create: `app/catalog/page.tsx`
- Create: `app/catalog/[id]/page.tsx`
- Test: `components/catalog/__tests__/PropertyCard.test.tsx`
- Test: `components/catalog/__tests__/ViewingRequestForm.test.tsx`

- [ ] **Step 1: Write the failing test for `PropertyCard`**

`components/catalog/__tests__/PropertyCard.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropertyCard } from "../PropertyCard";

const SAMPLE = {
  id: "p1",
  district: "Бостандыкский",
  residentialComplex: "Comfort City",
  address: "ул. Розыбакиева 100",
  lat: 43.2,
  lng: 76.89,
  rooms: 2,
  area: 60,
  price: 36_000_000,
  images: [],
};

describe("PropertyCard", () => {
  it("renders price, complex name, district, rooms and area", () => {
    render(<PropertyCard property={SAMPLE} />);
    expect(screen.getByText(/36 000 000/)).toBeInTheDocument();
    expect(screen.getByText("Comfort City")).toBeInTheDocument();
    expect(screen.getByText(/Бостандыкский/)).toBeInTheDocument();
    expect(screen.getByText(/2 комн/)).toBeInTheDocument();
    expect(screen.getByText(/60 м/)).toBeInTheDocument();
  });

  it("links to the property detail page", () => {
    render(<PropertyCard property={SAMPLE} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/catalog/p1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/catalog/__tests__/PropertyCard.test.tsx`
Expected: FAIL — `Cannot find module '../PropertyCard'`

- [ ] **Step 3: Implement `PropertyCard`**

`components/catalog/PropertyCard.tsx`:

```typescript
import Link from "next/link";
import type { PropertyCard as PropertyCardData } from "@/lib/api/procasa-client";
import { formatTenge } from "@/lib/format";

interface PropertyCardProps {
  property: PropertyCardData;
}

export function PropertyCard({ property }: PropertyCardProps) {
  return (
    <Link
      href={`/catalog/${property.id}`}
      className="block rounded-card bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <p className="text-xl font-semibold">{formatTenge(property.price)}</p>
      <p className="mt-1 font-medium">{property.residentialComplex}</p>
      <p className="text-sm text-ink/60">
        {property.district}, {property.address}
      </p>
      <p className="mt-2 text-sm text-ink/70">
        {property.rooms} комн · {property.area} м²
      </p>
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/catalog/__tests__/PropertyCard.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for `ViewingRequestForm`**

`components/catalog/__tests__/ViewingRequestForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewingRequestForm } from "../ViewingRequestForm";

vi.mock("@/lib/api/procasa-client", () => ({
  submitViewingRequest: vi.fn().mockResolvedValue(true),
}));

import { submitViewingRequest } from "@/lib/api/procasa-client";

describe("ViewingRequestForm", () => {
  it("submits name, phone and propertyId, then shows a confirmation", async () => {
    const user = userEvent.setup();
    render(<ViewingRequestForm propertyId="p1" />);

    await user.type(screen.getByLabelText("Имя"), "Аружан");
    await user.type(screen.getByLabelText("Телефон"), "+77001234567");
    fireEvent.click(screen.getByRole("button", { name: /записаться на просмотр/i }));

    await waitFor(() => {
      expect(submitViewingRequest).toHaveBeenCalledWith({
        propertyId: "p1",
        name: "Аружан",
        phone: "+77001234567",
      });
    });
    expect(await screen.findByText(/заявка отправлена/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run components/catalog/__tests__/ViewingRequestForm.test.tsx`
Expected: FAIL — `Cannot find module '../ViewingRequestForm'`

- [ ] **Step 7: Implement `ViewingRequestForm`**

`components/catalog/ViewingRequestForm.tsx`:

```typescript
"use client";

import { useState, type FormEvent } from "react";
import { submitViewingRequest } from "@/lib/api/procasa-client";

interface ViewingRequestFormProps {
  propertyId: string;
}

export function ViewingRequestForm({ propertyId }: ViewingRequestFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submitViewingRequest({ propertyId, name, phone });
    if (ok) setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-card bg-accent-light p-4 text-ink">
        Заявка отправлена, мы свяжемся с вами для согласования времени просмотра.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Записаться на просмотр</h3>

      <label className="mt-4 block text-sm text-ink/70" htmlFor="viewing-name">
        Имя
      </label>
      <input
        id="viewing-name"
        aria-label="Имя"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="viewing-phone">
        Телефон
      </label>
      <input
        id="viewing-phone"
        aria-label="Телефон"
        type="tel"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <button
        type="submit"
        className="mt-4 w-full rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark"
      >
        Записаться на просмотр
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run components/catalog/__tests__/ViewingRequestForm.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 9: Implement `CatalogMap` (client-only, degrades gracefully without an API key)**

`components/catalog/CatalogMap.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import type { PropertyCard as PropertyCardData } from "@/lib/api/procasa-client";
import { formatTenge } from "@/lib/format";

interface CatalogMapProps {
  properties: PropertyCardData[];
}

const TWOGIS_API_KEY = process.env.NEXT_PUBLIC_2GIS_API_KEY;
const ALMATY_CENTER: [number, number] = [76.9286, 43.2380];

export function CatalogMap({ properties }: CatalogMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TWOGIS_API_KEY || !containerRef.current) return;

    let map: any;
    let destroyed = false;

    import("@2gis/mapgl").then(({ load }) => {
      load().then((mapglAPI) => {
        if (destroyed || !containerRef.current) return;
        map = new mapglAPI.Map(containerRef.current, {
          center: ALMATY_CENTER,
          zoom: 11,
          key: TWOGIS_API_KEY,
        });

        for (const property of properties) {
          new mapglAPI.Marker(map, {
            coordinates: [property.lng, property.lat],
            label: { text: formatTenge(property.price) },
          });
        }
      });
    });

    return () => {
      destroyed = true;
      map?.destroy?.();
    };
  }, [properties]);

  if (!TWOGIS_API_KEY) {
    return (
      <div className="flex h-64 items-center justify-center rounded-card bg-ink/5 text-sm text-ink/60">
        Карта недоступна (не задан NEXT_PUBLIC_2GIS_API_KEY)
      </div>
    );
  }

  return <div ref={containerRef} className="h-96 w-full rounded-card" data-testid="catalog-map" />;
}
```

Add `@2gis/mapgl` as a dependency: in `package.json`, add to `"dependencies"` after `"react-dom": "18.3.1",`:

```json
    "@2gis/mapgl": "^1.51.0",
```

Run: `npm install`

Append the new env var to `.env.example` at the repository root (it already has `NEXT_PUBLIC_PROCASA_API_URL` and `NEXT_PUBLIC_OTSENKA_FORM_ID` from Task 10):

```
NEXT_PUBLIC_2GIS_API_KEY=
```

Note: `CatalogMap` deliberately has no test — it is a thin client-only wrapper around a third-party map SDK that does not run in jsdom; its behavior (does the map render, are markers placed correctly) can only be verified by hand in a real browser (Task 12, Step 12). The map's absence-of-key fallback path (the `if (!TWOGIS_API_KEY)` branch) is the only branch worth a test, and it is exercised implicitly by every other test in this suite running without a `NEXT_PUBLIC_2GIS_API_KEY` set.

- [ ] **Step 10: Implement `app/catalog/page.tsx`**

```typescript
import { getProperties } from "@/lib/api/procasa-client";
import { PropertyCard } from "@/components/catalog/PropertyCard";
import { CatalogMap } from "@/components/catalog/CatalogMap";

export default async function CatalogPage() {
  const properties = await getProperties();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Квартиры в Алматы</h1>

      <div className="mt-6">
        <CatalogMap properties={properties} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>

      {properties.length === 0 && (
        <p className="mt-6 text-ink/60">Пока нет опубликованных объявлений.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 11: Implement `app/catalog/[id]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { getProperty } from "@/lib/api/procasa-client";
import { ViewingRequestForm } from "@/components/catalog/ViewingRequestForm";
import { formatTenge } from "@/lib/format";

interface PropertyPageProps {
  params: { id: string };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const property = await getProperty(params.id);

  if (!property) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-3xl font-semibold">{formatTenge(property.price)}</p>
      <h1 className="mt-2 text-2xl font-semibold">{property.residentialComplex}</h1>
      <p className="text-ink/60">
        {property.district}, {property.address}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-card bg-white p-6 shadow-sm">
        <div>
          <dt className="text-sm text-ink/60">Комнат</dt>
          <dd className="text-lg">{property.rooms}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink/60">Площадь</dt>
          <dd className="text-lg">{property.area} м²</dd>
        </div>
        <div>
          <dt className="text-sm text-ink/60">Этаж</dt>
          <dd className="text-lg">
            {property.floor} из {property.totalFloors}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink/60">Ремонт</dt>
          <dd className="text-lg">{property.repairState}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <ViewingRequestForm propertyId={property.id} />
      </div>
    </main>
  );
}
```

- [ ] **Step 12: Manually verify in the browser**

Run: `npm run dev`, open `http://localhost:3000/catalog` (expect either seeded property cards + map, or the empty-state message if the backend/DB is unavailable), click into a card, submit the viewing-request form, check the browser console at each step for errors.

- [ ] **Step 13: Run the full test suite**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 14: Commit**

```bash
git add components/catalog app/catalog package.json package-lock.json
git commit -m "feat(frontend): add public property catalog with map, cards and viewing-request form"
```

---

### Task 13: `/prodat` — seller landing and "Добавить квартиру" wizard

**Files:**
- Create: `components/property-wizard/LocationStep.tsx`
- Create: `components/property-wizard/PriceStep.tsx`
- Create: `components/property-wizard/DetailsStep.tsx`
- Create: `components/property-wizard/PhotosStep.tsx`
- Create: `components/property-wizard/PropertyLeadWizard.tsx`
- Create: `app/prodat/page.tsx`
- Test: `components/property-wizard/__tests__/PropertyLeadWizard.test.tsx`

- [ ] **Step 1: Write the failing integration test for the whole wizard**

`components/property-wizard/__tests__/PropertyLeadWizard.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyLeadWizard } from "../PropertyLeadWizard";

vi.mock("@/lib/api/procasa-client", () => ({
  submitPropertyLead: vi.fn().mockResolvedValue({ success: true, sellerId: "s1" }),
}));

import { submitPropertyLead } from "@/lib/api/procasa-client";

describe("PropertyLeadWizard", () => {
  it("walks through all 4 steps and submits the collected data", async () => {
    const user = userEvent.setup();
    render(<PropertyLeadWizard />);

    // Step 1: location
    await user.selectOptions(screen.getByLabelText("Район"), "Бостандыкский");
    await user.type(screen.getByLabelText("ЖК"), "Comfort City");
    await user.type(screen.getByLabelText("Адрес"), "ул. Розыбакиева");
    await user.type(screen.getByLabelText("Номер дома"), "100");
    fireEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // Step 2: price
    await user.type(screen.getByLabelText("Цена продажи"), "36000000");
    fireEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // Step 3: details
    await user.type(screen.getByLabelText("Количество комнат"), "2");
    await user.type(screen.getByLabelText("Площадь, м²"), "60");
    fireEvent.click(screen.getByRole("button", { name: /продолжить/i }));

    // Step 4: photos + contact
    await user.type(screen.getByLabelText("Имя"), "Аружан");
    await user.type(screen.getByLabelText("Телефон"), "+77001234567");
    fireEvent.click(screen.getByRole("button", { name: /отправить/i }));

    await waitFor(() => {
      expect(submitPropertyLead).toHaveBeenCalledWith(
        expect.objectContaining({
          district: "Бостандыкский",
          residentialComplex: "Comfort City",
          address: "ул. Розыбакиева",
          houseNumber: "100",
          price: 36_000_000,
          rooms: 2,
          area: 60,
          contactName: "Аружан",
          contactPhone: "+77001234567",
        })
      );
    });

    expect(await screen.findByText(/заявка принята/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/property-wizard/__tests__/PropertyLeadWizard.test.tsx`
Expected: FAIL — `Cannot find module '../PropertyLeadWizard'`

- [ ] **Step 3: Implement `LocationStep`**

`components/property-wizard/LocationStep.tsx`:

```typescript
"use client";

const ALMATY_DISTRICTS = [
  "Алмалинский",
  "Ауэзовский",
  "Бостандыкский",
  "Медеуский",
  "Наурызбайский",
  "Турксибский",
  "Жетысуский",
  "Алатауский",
] as const;

export interface LocationStepValue {
  district: string;
  residentialComplex: string;
  address: string;
  houseNumber: string;
}

interface LocationStepProps {
  onSubmit: (value: LocationStepValue) => void;
}

export function LocationStep({ onSubmit }: LocationStepProps) {
  return (
    <form
      className="rounded-card bg-white p-8 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit({
          district: String(formData.get("district") ?? ""),
          residentialComplex: String(formData.get("residentialComplex") ?? ""),
          address: String(formData.get("address") ?? ""),
          houseNumber: String(formData.get("houseNumber") ?? ""),
        });
      }}
    >
      <h2 className="text-2xl font-semibold">Шаг 1 из 4</h2>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="district">
        Район
      </label>
      <select
        id="district"
        name="district"
        aria-label="Район"
        required
        defaultValue=""
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      >
        <option value="" disabled>
          Выберите район
        </option>
        {ALMATY_DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm text-ink/70" htmlFor="residentialComplex">
        ЖК
      </label>
      <input id="residentialComplex" name="residentialComplex" aria-label="ЖК" required
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3" />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="address">
        Адрес
      </label>
      <input id="address" name="address" aria-label="Адрес" required
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3" />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="houseNumber">
        Номер дома
      </label>
      <input id="houseNumber" name="houseNumber" aria-label="Номер дома" required
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3" />

      <button type="submit" className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark">
        Продолжить
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Implement `PriceStep`**

`components/property-wizard/PriceStep.tsx`:

```typescript
"use client";

import { useState } from "react";

export interface PriceStepValue {
  price: number;
  negotiable: boolean;
  moveInReady: boolean;
}

interface PriceStepProps {
  onSubmit: (value: PriceStepValue) => void;
}

export function PriceStep({ onSubmit }: PriceStepProps) {
  const [price, setPrice] = useState(0);
  const [negotiable, setNegotiable] = useState(false);
  const [moveInReady, setMoveInReady] = useState(false);

  return (
    <form
      className="rounded-card bg-white p-8 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ price, negotiable, moveInReady });
      }}
    >
      <h2 className="text-2xl font-semibold">Шаг 2 из 4</h2>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="price">
        Цена продажи
      </label>
      <input
        id="price"
        aria-label="Цена продажи"
        type="number"
        min={0}
        required
        value={price || ""}
        onChange={(e) => setPrice(Number(e.target.value))}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 flex items-center justify-between text-sm text-ink/70">
        Торг возможен
        <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
      </label>

      <label className="mt-4 flex items-center justify-between text-sm text-ink/70">
        Можно заселиться сразу
        <input type="checkbox" checked={moveInReady} onChange={(e) => setMoveInReady(e.target.checked)} />
      </label>

      <button type="submit" className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark">
        Продолжить
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Implement `DetailsStep`**

`components/property-wizard/DetailsStep.tsx`:

```typescript
"use client";

import { useState } from "react";

export interface DetailsStepValue {
  rooms: number;
  area: number;
  furnished: boolean;
  hasAppliances: boolean;
}

interface DetailsStepProps {
  onSubmit: (value: DetailsStepValue) => void;
}

export function DetailsStep({ onSubmit }: DetailsStepProps) {
  const [rooms, setRooms] = useState(0);
  const [area, setArea] = useState(0);
  const [furnished, setFurnished] = useState(false);
  const [hasAppliances, setHasAppliances] = useState(false);

  return (
    <form
      className="rounded-card bg-white p-8 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ rooms, area, furnished, hasAppliances });
      }}
    >
      <h2 className="text-2xl font-semibold">Шаг 3 из 4</h2>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="rooms">
        Количество комнат
      </label>
      <input
        id="rooms"
        aria-label="Количество комнат"
        type="number"
        min={1}
        required
        value={rooms || ""}
        onChange={(e) => setRooms(Number(e.target.value))}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="area">
        Площадь, м²
      </label>
      <input
        id="area"
        aria-label="Площадь, м²"
        type="number"
        min={1}
        required
        value={area || ""}
        onChange={(e) => setArea(Number(e.target.value))}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 flex items-center justify-between text-sm text-ink/70">
        С мебелью
        <input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} />
      </label>

      <label className="mt-4 flex items-center justify-between text-sm text-ink/70">
        С техникой
        <input type="checkbox" checked={hasAppliances} onChange={(e) => setHasAppliances(e.target.checked)} />
      </label>

      <button type="submit" className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark">
        Продолжить
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Implement `PhotosStep`**

`components/property-wizard/PhotosStep.tsx`:

```typescript
"use client";

import { useState, type FormEvent } from "react";

export interface PhotosStepValue {
  contactName: string;
  contactPhone: string;
  photoUrls: string[];
}

interface PhotosStepProps {
  onSubmit: (value: PhotosStepValue) => void;
}

export function PhotosStep({ onSubmit }: PhotosStepProps) {
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ contactName, contactPhone, photoUrls });
  }

  // Photo upload is out of scope for this wizard's automated tests (file input
  // + object URLs are not meaningfully testable in jsdom); the file input
  // stores selected filenames as placeholder photoUrls until a public upload
  // endpoint is wired up (tracked separately from this plan).
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;
    setPhotoUrls(Array.from(files).map((f) => f.name));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold">Шаг 4 из 4</h2>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="photos">
        Фотографии
      </label>
      <input
        id="photos"
        aria-label="Фотографии"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="mt-2 w-full"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="contactName">
        Имя
      </label>
      <input
        id="contactName"
        aria-label="Имя"
        required
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="contactPhone">
        Телефон
      </label>
      <input
        id="contactPhone"
        aria-label="Телефон"
        type="tel"
        required
        value={contactPhone}
        onChange={(e) => setContactPhone(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <button type="submit" className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark">
        Отправить
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Implement `PropertyLeadWizard`**

`components/property-wizard/PropertyLeadWizard.tsx`:

```typescript
"use client";

import { useState } from "react";
import { submitPropertyLead } from "@/lib/api/procasa-client";
import { LocationStep, type LocationStepValue } from "./LocationStep";
import { PriceStep, type PriceStepValue } from "./PriceStep";
import { DetailsStep, type DetailsStepValue } from "./DetailsStep";
import { PhotosStep, type PhotosStepValue } from "./PhotosStep";

type WizardStep = 1 | 2 | 3 | 4;

export function PropertyLeadWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [location, setLocation] = useState<LocationStepValue | null>(null);
  const [price, setPrice] = useState<PriceStepValue | null>(null);
  const [details, setDetails] = useState<DetailsStepValue | null>(null);
  const [done, setDone] = useState(false);

  async function handlePhotosSubmit(photos: PhotosStepValue) {
    if (!location || !price || !details) return;

    await submitPropertyLead({
      district: location.district,
      residentialComplex: location.residentialComplex,
      address: location.address,
      houseNumber: location.houseNumber,
      price: price.price,
      negotiable: price.negotiable,
      moveInReady: price.moveInReady,
      furnished: details.furnished,
      hasAppliances: details.hasAppliances,
      rooms: details.rooms,
      area: details.area,
      contactName: photos.contactName,
      contactPhone: photos.contactPhone,
      photoUrls: photos.photoUrls,
    });

    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-card bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold">Заявка принята!</h2>
        <p className="mt-2 text-ink/70">
          Наш брокер свяжется с вами, чтобы согласовать дальнейшие шаги.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {step === 1 && (
        <LocationStep
          onSubmit={(value) => {
            setLocation(value);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <PriceStep
          onSubmit={(value) => {
            setPrice(value);
            setStep(3);
          }}
        />
      )}
      {step === 3 && (
        <DetailsStep
          onSubmit={(value) => {
            setDetails(value);
            setStep(4);
          }}
        />
      )}
      {step === 4 && <PhotosStep onSubmit={handlePhotosSubmit} />}
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run components/property-wizard/__tests__/PropertyLeadWizard.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 9: Implement `/prodat` landing page**

`app/prodat/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { PropertyLeadWizard } from "@/components/property-wizard/PropertyLeadWizard";

export default function ProdatPage() {
  const [showWizard, setShowWizard] = useState(false);

  if (showWizard) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <PropertyLeadWizard />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold">
        Меньше звонков. Больше просмотров. Больше сделок.
      </h1>
      <p className="mt-4 text-ink/70">
        Покупатели записываются на просмотр через CASA — вы только показываете квартиру.
      </p>

      <button
        type="button"
        onClick={() => setShowWizard(true)}
        className="mt-6 w-full rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark"
      >
        Добавить квартиру
      </button>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Как это работает</h2>
        <ol className="mt-4 flex flex-col gap-4">
          <li>
            <p className="font-medium">1. Добавьте квартиру</p>
            <p className="text-sm text-ink/60">Заполните основную информацию</p>
          </li>
          <li>
            <p className="font-medium">2. CASA проверит объявление</p>
            <p className="text-sm text-ink/60">Подготовим публикацию</p>
          </li>
          <li>
            <p className="font-medium">3. Покупатели записываются</p>
            <p className="text-sm text-ink/60">Без звонков вам напрямую</p>
          </li>
          <li>
            <p className="font-medium">4. Переходите к сделке</p>
            <p className="text-sm text-ink/60">CASA сопровождает процесс</p>
          </li>
        </ol>
      </section>
    </main>
  );
}
```

- [ ] **Step 10: Manually verify in the browser**

Run: `npm run dev`, open `http://localhost:3000/prodat`, click "Добавить квартиру", walk through all 4 steps with representative data, submit, confirm the "Заявка принята!" screen shows. Check the browser console for errors at each step.

- [ ] **Step 11: Run the full test suite one last time**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add components/property-wizard app/prodat
git commit -m "feat(frontend): add /prodat seller landing and Добавить квартиру wizard"
```

---

## Final step: push

- [ ] **Push all commits**

```bash
git push origin master
```

The user has explicitly authorized commits and pushes for this work without asking again each time — push once all 13 tasks are committed, and after every subsequent task if working incrementally.
