# Casa: лендинг + мастер оценки квартиры (`/otsenka`) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать первый увеличение интерфейса Casa: публичный лендинг с
вводом адреса и четырёхшаговый мастер оценки квартиры (`/otsenka`), который
показывает срочную и рыночную цену на mock-данных.

**Architecture:** Next.js (App Router) + TypeScript + Tailwind CSS. Бизнес-логика
(сопоставление адреса, расчёт цены) изолирована в `lib/mock/` за типизированным
интерфейсом, который позже заменяется на реальные API-вызовы без изменения
компонентов. UI-шаги мастера — презентационные компоненты (данные и колбэки
через props), состояние визарда живёт в одном клиентском компоненте-оболочке.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Tailwind CSS 3, Vitest +
React Testing Library для тестов.

Спека: `../specs/2026-07-26-casa-valuation-interface-design.md`

---

### Task 1: Инициализация Next.js + Tailwind проекта

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`

- [ ] **Step 1: Создать `package.json`**

```json
{
  "name": "casa",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "@types/node": "20.14.9",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "tailwindcss": "3.4.4",
    "postcss": "8.4.38",
    "autoprefixer": "10.4.19",
    "vitest": "1.6.0",
    "@vitejs/plugin-react": "4.3.1",
    "jsdom": "24.1.0",
    "@testing-library/react": "14.3.1",
    "@testing-library/jest-dom": "6.4.6",
    "@testing-library/user-event": "14.5.2"
  }
}
```

- [ ] **Step 2: Создать `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Создать `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 4: Создать `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Создать `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Создать `tailwind.config.ts` с токенами дизайна**

Зелёный акцент (деньги/рост), крупный радиус скругления, шрифт Inter.

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#16a34a",
          dark: "#15803d",
          light: "#dcfce7",
        },
        ink: "#1c1c1c",
        surface: "#faf9f7",
      },
      borderRadius: {
        card: "20px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 7: Создать `.gitignore`**

```
node_modules
.next
.env*.local
```

- [ ] **Step 8: Создать `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Создать `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Casa — оценка и продажа квартиры",
  description: "Узнайте срочную и рыночную цену вашей квартиры за пару минут",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} font-sans bg-surface text-ink`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Создать временный `app/page.tsx`**

Плейсхолдер — будет заменён в Task 5 на настоящий лендинг.

```tsx
export default function LandingPage() {
  return <main className="p-10">Casa</main>;
}
```

- [ ] **Step 11: Установить зависимости**

Run: `npm install`
Expected: пакеты установлены без ошибок, создана папка `node_modules/`.

- [ ] **Step 12: Проверить сборку**

Run: `npm run build`
Expected: `✓ Compiled successfully`, маршрут `/` присутствует в выводе.

- [ ] **Step 13: Коммит**

```bash
git add package.json tsconfig.json next-env.d.ts next.config.mjs postcss.config.mjs tailwind.config.ts .gitignore app/
git commit -m "chore: scaffold Next.js + Tailwind project"
```

---

### Task 2: Mock-слой — типы и `matchAddress` (TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `lib/mock/types.ts`
- Create: `lib/mock/addresses.ts`
- Test: `lib/mock/__tests__/addresses.test.ts`

- [ ] **Step 1: Создать `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

- [ ] **Step 2: Создать `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Создать `lib/mock/types.ts`**

Общие типы для mock-слоя: результат сопоставления адреса, параметры и
результат расчёта оценки.

```ts
export type BuildingClass = "economy" | "comfort" | "comfort_plus" | "business";

export type AddressMatchResult =
  | {
      status: "matched";
      residentialComplex: string;
      district: string;
      address: string;
      buildingClass: BuildingClass;
    }
  | { status: "not_found" };

export type RepairCondition =
  | "fresh_repair"
  | "good_livable"
  | "cosmetic"
  | "needs_repair";

export interface ValuationParams {
  rooms: number;
  areaM2: number;
  floor: number;
  totalFloors: number;
  repairCondition: RepairCondition;
}

export type ValuationResult =
  | {
      status: "ready";
      instantPrice: number;
      marketPrice: number;
      basePricePerM2: number;
    }
  | { status: "insufficient_data" };
```

- [ ] **Step 4: Написать падающий тест для `matchAddress`**

Создать `lib/mock/__tests__/addresses.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchAddress } from "../addresses";

describe("matchAddress", () => {
  it("matches a known address regardless of comma and case formatting", () => {
    const result = matchAddress("жошы хана, 27");
    expect(result).toEqual({
      status: "matched",
      residentialComplex: "Prime Garden",
      district: "Есиль",
      address: "жошы хана, 27",
      buildingClass: "comfort_plus",
    });
  });

  it("returns not_found for an address with no match", () => {
    expect(matchAddress("несуществующая улица 1")).toEqual({
      status: "not_found",
    });
  });
});
```

- [ ] **Step 5: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — файл `../addresses` не существует / `matchAddress` не найден.

- [ ] **Step 6: Реализовать `lib/mock/addresses.ts`**

Данные основаны на реальной выборке из Casa Airtable System (ЖК Prime
Garden, Жошы хана 27, Есиль; и ЖК с отсутствующими данными по ценам —
для проверки состояния «недостаточно данных»).

```ts
import type { AddressMatchResult, BuildingClass } from "./types";

interface ResidentialComplexSeed {
  name: string;
  district: string;
  buildingClass: BuildingClass;
  aliases: string[];
  pricePerM2ByRooms: Partial<Record<number, number>>;
}

export const RESIDENTIAL_COMPLEXES: ResidentialComplexSeed[] = [
  {
    name: "Prime Garden",
    district: "Есиль",
    buildingClass: "comfort_plus",
    aliases: ["Жошы хана 27", "Жошы хана, 27"],
    pricePerM2ByRooms: { 1: 820000, 2: 856957, 3: 885994 },
  },
  {
    name: "Хайвил Астана блок А",
    district: "Сарайшык",
    buildingClass: "comfort",
    aliases: ["Ташенова 8", "Ташенова, 8"],
    pricePerM2ByRooms: {},
  },
];

function normalize(input: string): string {
  return input.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();
}

export function matchAddress(input: string): AddressMatchResult {
  const normalized = normalize(input);
  const complex = RESIDENTIAL_COMPLEXES.find((candidate) =>
    candidate.aliases.some((alias) => normalize(alias) === normalized)
  );

  if (!complex) {
    return { status: "not_found" };
  }

  return {
    status: "matched",
    residentialComplex: complex.name,
    district: complex.district,
    address: input.trim(),
    buildingClass: complex.buildingClass,
  };
}
```

- [ ] **Step 7: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS — 2 теста в `addresses.test.ts` зелёные.

- [ ] **Step 8: Коммит**

```bash
git add vitest.config.ts vitest.setup.ts lib/mock/types.ts lib/mock/addresses.ts lib/mock/__tests__/addresses.test.ts
git commit -m "feat: add address matching mock layer"
```

---

### Task 3: Mock-слой — `calculateValuation` (TDD)

**Files:**
- Create: `lib/mock/valuation.ts`
- Test: `lib/mock/__tests__/valuation.test.ts`

- [ ] **Step 1: Написать падающий тест**

Формула подтверждена заказчиком: срочная продажа = ×0.90, рыночная = ×0.93
от базовой стоимости (цена за м² по ЖК и комнатности × площадь).

Создать `lib/mock/__tests__/valuation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateValuation } from "../valuation";

describe("calculateValuation", () => {
  it("returns instant (x0.90) and market (x0.93) prices for a known complex and room count", () => {
    const result = calculateValuation("Prime Garden", {
      rooms: 2,
      areaM2: 61,
      floor: 7,
      totalFloors: 9,
      repairCondition: "fresh_repair",
    });

    expect(result).toEqual({
      status: "ready",
      basePricePerM2: 856957,
      instantPrice: Math.round(856957 * 61 * 0.9),
      marketPrice: Math.round(856957 * 61 * 0.93),
    });
  });

  it("returns insufficient_data when the complex has no price for that room count", () => {
    const result = calculateValuation("Хайвил Астана блок А", {
      rooms: 4,
      areaM2: 161.8,
      floor: 9,
      totalFloors: 10,
      repairCondition: "good_livable",
    });

    expect(result).toEqual({ status: "insufficient_data" });
  });

  it("returns insufficient_data for an unknown complex name", () => {
    const result = calculateValuation("Неизвестный ЖК", {
      rooms: 2,
      areaM2: 50,
      floor: 3,
      totalFloors: 9,
      repairCondition: "cosmetic",
    });

    expect(result).toEqual({ status: "insufficient_data" });
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `../valuation` не существует / `calculateValuation` не найден.

- [ ] **Step 3: Реализовать `lib/mock/valuation.ts`**

```ts
import { RESIDENTIAL_COMPLEXES } from "./addresses";
import type { ValuationParams, ValuationResult } from "./types";

export const INSTANT_SALE_MULTIPLIER = 0.9;
export const MARKET_SALE_MULTIPLIER = 0.93;

export function calculateValuation(
  residentialComplexName: string,
  params: ValuationParams
): ValuationResult {
  const complex = RESIDENTIAL_COMPLEXES.find(
    (candidate) => candidate.name === residentialComplexName
  );
  const pricePerM2 = complex?.pricePerM2ByRooms[params.rooms];

  if (!pricePerM2) {
    return { status: "insufficient_data" };
  }

  const baseValue = pricePerM2 * params.areaM2;

  return {
    status: "ready",
    basePricePerM2: pricePerM2,
    instantPrice: Math.round(baseValue * INSTANT_SALE_MULTIPLIER),
    marketPrice: Math.round(baseValue * MARKET_SALE_MULTIPLIER),
  };
}
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS — все 3 теста в `valuation.test.ts` зелёные.

- [ ] **Step 5: Коммит**

```bash
git add lib/mock/valuation.ts lib/mock/__tests__/valuation.test.ts
git commit -m "feat: add valuation calculation mock layer"
```

---

### Task 4: Форматирование цены + Hero-секция лендинга (TDD)

**Files:**
- Create: `lib/format.ts`
- Test: `lib/__tests__/format.test.ts`
- Create: `components/landing/Hero.tsx`
- Test: `components/landing/__tests__/Hero.test.tsx`

- [ ] **Step 1: Написать падающий тест для `formatTenge`**

Создать `lib/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatTenge } from "../format";

describe("formatTenge", () => {
  it("appends the tenge symbol and groups thousands", () => {
    const result = formatTenge(47046957);
    expect(result.endsWith("₸")).toBe(true);
    expect(result).not.toBe("47046957 ₸");
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `../format` не существует.

- [ ] **Step 3: Реализовать `lib/format.ts`**

```ts
export function formatTenge(amount: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ₸`;
}
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Написать падающий тест для `Hero`**

Создать `components/landing/__tests__/Hero.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Hero } from "../Hero";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("Hero", () => {
  it("navigates to /otsenka with the entered address on submit", async () => {
    pushMock.mockClear();
    render(<Hero />);

    await userEvent.type(
      screen.getByLabelText("Адрес квартиры"),
      "Жошы хана 27"
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Оценить бесплатно" })
    );

    expect(pushMock).toHaveBeenCalledWith(
      `/otsenka?address=${encodeURIComponent("Жошы хана 27")}`
    );
  });
});
```

- [ ] **Step 6: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `../Hero` не существует.

- [ ] **Step 7: Реализовать `components/landing/Hero.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function Hero() {
  const router = useRouter();
  const [address, setAddress] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    router.push(`/otsenka?address=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold sm:text-5xl">
        Узнайте цену вашей квартиры за пару минут
      </h1>
      <p className="mt-4 text-lg text-ink/70">
        Срочная продажа или рыночная цена — решаете вы. Мы посчитаем оба варианта.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <input
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Введите адрес квартиры"
          aria-label="Адрес квартиры"
          className="w-full max-w-md rounded-full border border-ink/10 px-6 py-4 sm:w-96"
        />
        <button
          type="submit"
          className="rounded-full bg-accent px-8 py-4 text-white transition hover:bg-accent-dark"
        >
          Оценить бесплатно
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 8: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Коммит**

```bash
git add lib/format.ts lib/__tests__/format.test.ts components/landing/Hero.tsx components/landing/__tests__/Hero.test.tsx
git commit -m "feat: add price formatting and landing Hero component"
```

---

### Task 5: Остальные секции лендинга и сборка страницы `/`

Статичные презентационные блоки без интерактивности — тестов не требуют.

**Files:**
- Create: `components/landing/HowItWorks.tsx`
- Create: `components/landing/TrustSection.tsx`
- Create: `components/landing/Footer.tsx`
- Modify: `app/page.tsx`
- Test: `app/__tests__/page.test.tsx`

- [ ] **Step 1: Создать `components/landing/HowItWorks.tsx`**

```tsx
const STEPS = [
  {
    title: "Введите адрес",
    description: "Укажите адрес квартиры и основные параметры.",
  },
  {
    title: "Получите две цены",
    description: "Срочная продажа — быстрее, рыночная — выгоднее. Решать вам.",
  },
  {
    title: "Продайте на своих условиях",
    description:
      "Мы берём на себя фотосъёмку, документы и поиск покупателя.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-center text-3xl font-semibold">Как это работает</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="rounded-card bg-white p-6 shadow-sm">
            <span className="text-sm text-accent-dark">{index + 1}</span>
            <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
            <p className="mt-2 text-ink/70">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Создать `components/landing/TrustSection.tsx`**

```tsx
export function TrustSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-card bg-white p-10 text-center shadow-sm">
        <p className="text-2xl font-semibold">Первые продавцы уже с нами</p>
        <p className="mt-2 text-ink/70">
          Реальные кейсы и отзывы появятся здесь после запуска.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Создать `components/landing/Footer.tsx`**

```tsx
export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-6 py-10 text-sm text-ink/50">
      <p>© {new Date().getFullYear()} Casa. Оценка и продажа квартир в Астане.</p>
    </footer>
  );
}
```

- [ ] **Step 4: Написать падающий тест для страницы лендинга**

Создать `app/__tests__/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LandingPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("LandingPage", () => {
  it("renders the hero heading and how-it-works section", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("Узнайте цену вашей квартиры за пару минут")
    ).toBeInTheDocument();
    expect(screen.getByText("Как это работает")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `app/page.tsx` пока рендерит только заглушку «Casa».

- [ ] **Step 6: Заменить `app/page.tsx` на полную сборку лендинга**

```tsx
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TrustSection } from "@/components/landing/TrustSection";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <TrustSection />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 7: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Коммит**

```bash
git add components/landing/HowItWorks.tsx components/landing/TrustSection.tsx components/landing/Footer.tsx app/page.tsx app/__tests__/page.test.tsx
git commit -m "feat: assemble landing page"
```

---

### Task 6: Мастер оценки — оболочка и Шаг 1 (подтверждение адреса) (TDD)

**Files:**
- Create: `components/wizard/WizardProgress.tsx`
- Create: `components/wizard/AddressConfirmStep.tsx`
- Test: `components/wizard/__tests__/AddressConfirmStep.test.tsx`
- Create: `components/wizard/OtsenkaWizard.tsx`
- Create: `app/otsenka/page.tsx`

- [ ] **Step 1: Создать `components/wizard/WizardProgress.tsx`**

```tsx
const STEPS = ["Адрес", "Параметры", "Результат", "Контакты"] as const;

export function WizardProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center gap-3 text-sm text-ink/50">
      {STEPS.map((label, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3 | 4;
        return (
          <li
            key={label}
            className={stepNumber === current ? "font-semibold text-accent-dark" : ""}
          >
            {index + 1}. {label}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Написать падающий тест для `AddressConfirmStep`**

Создать `components/wizard/__tests__/AddressConfirmStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AddressConfirmStep } from "../AddressConfirmStep";

describe("AddressConfirmStep", () => {
  it("calls onConfirm with the match when the user confirms a found address", async () => {
    const onConfirm = vi.fn();
    const match = {
      status: "matched" as const,
      residentialComplex: "Prime Garden",
      district: "Есиль",
      address: "Жошы хана 27",
      buildingClass: "comfort_plus" as const,
    };

    render(
      <AddressConfirmStep address="Жошы хана 27" match={match} onConfirm={onConfirm} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Это мой дом, продолжить" })
    );

    expect(onConfirm).toHaveBeenCalledWith(match);
  });

  it("lets the user pick a district manually when the address is not found", async () => {
    const onConfirm = vi.fn();

    render(
      <AddressConfirmStep
        address="Неизвестная 1"
        match={{ status: "not_found" }}
        onConfirm={onConfirm}
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("Район"), "Есиль");

    expect(onConfirm).toHaveBeenCalledWith({
      status: "matched",
      residentialComplex: "уточняется",
      district: "Есиль",
      address: "Неизвестная 1",
      buildingClass: "comfort",
    });
  });
});
```

- [ ] **Step 3: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `../AddressConfirmStep` не существует.

- [ ] **Step 4: Реализовать `components/wizard/AddressConfirmStep.tsx`**

```tsx
"use client";

import type { AddressMatchResult } from "@/lib/mock/types";

const DISTRICTS = ["Есиль", "Байконур", "Сарыарка", "Сарайшык", "Нура"] as const;

interface AddressConfirmStepProps {
  address: string;
  match: AddressMatchResult;
  onConfirm: (match: Extract<AddressMatchResult, { status: "matched" }>) => void;
}

export function AddressConfirmStep({ address, match, onConfirm }: AddressConfirmStepProps) {
  if (match.status === "matched") {
    return (
      <div className="rounded-card bg-white p-8 shadow-sm">
        <p className="text-sm text-ink/60">Мы нашли ваш дом</p>
        <h2 className="mt-2 text-2xl font-semibold">{match.residentialComplex}</h2>
        <p className="mt-1 text-ink/70">
          {match.address}, район {match.district}
        </p>
        <button
          type="button"
          onClick={() => onConfirm(match)}
          className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark"
        >
          Это мой дом, продолжить
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-white p-8 shadow-sm">
      <p className="text-sm text-ink/60">
        Не удалось точно определить дом по адресу «{address}»
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Выберите район вручную</h2>
      <select
        id="manual-district"
        aria-label="Район"
        className="mt-6 w-full rounded-full border border-ink/10 px-4 py-3"
        defaultValue=""
        onChange={(event) => {
          const district = event.target.value;
          if (!district) return;
          onConfirm({
            status: "matched",
            residentialComplex: "уточняется",
            district,
            address,
            buildingClass: "comfort",
          });
        }}
      >
        <option value="" disabled>
          Выберите район
        </option>
        {DISTRICTS.map((district) => (
          <option key={district} value={district}>
            {district}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 5: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS — оба теста в `AddressConfirmStep.test.tsx` зелёные.

- [ ] **Step 6: Создать оболочку визарда `components/wizard/OtsenkaWizard.tsx`**

Пока задействует только Шаг 1 — остальные шаги подключаются в Task 7–9.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { matchAddress } from "@/lib/mock/addresses";
import type { AddressMatchResult } from "@/lib/mock/types";
import { AddressConfirmStep } from "./AddressConfirmStep";
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [match, setMatch] = useState<AddressMatchResult | null>(null);

  useEffect(() => {
    setMatch(matchAddress(address));
  }, [address]);

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress current={step} />

      {step === 1 && match && (
        <AddressConfirmStep
          address={address}
          match={match}
          onConfirm={(confirmed) => {
            setMatch(confirmed);
            setStep(2);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Создать `app/otsenka/page.tsx`**

`useSearchParams` в App Router требует границы `Suspense`.

```tsx
import { Suspense } from "react";
import { OtsenkaWizard } from "@/components/wizard/OtsenkaWizard";

export default function OtsenkaPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Suspense fallback={null}>
        <OtsenkaWizard />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 8: Проверить сборку**

Run: `npm run build`
Expected: `✓ Compiled successfully`, маршрут `/otsenka` присутствует в выводе.

- [ ] **Step 9: Коммит**

```bash
git add components/wizard/WizardProgress.tsx components/wizard/AddressConfirmStep.tsx components/wizard/__tests__/AddressConfirmStep.test.tsx components/wizard/OtsenkaWizard.tsx app/otsenka/page.tsx
git commit -m "feat: add otsenka wizard shell and address confirm step"
```

---

### Task 7: Мастер оценки — Шаг 2 (параметры квартиры) (TDD)

**Files:**
- Create: `components/wizard/ParamsStep.tsx`
- Test: `components/wizard/__tests__/ParamsStep.test.tsx`
- Modify: `components/wizard/OtsenkaWizard.tsx`

- [ ] **Step 1: Написать падающий тест для `ParamsStep`**

Создать `components/wizard/__tests__/ParamsStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ParamsStep } from "../ParamsStep";

describe("ParamsStep", () => {
  it("submits the entered parameters", async () => {
    const onSubmit = vi.fn();
    render(<ParamsStep onSubmit={onSubmit} />);

    await userEvent.clear(screen.getByLabelText("Количество комнат"));
    await userEvent.type(screen.getByLabelText("Количество комнат"), "3");
    await userEvent.clear(screen.getByLabelText("Площадь, м²"));
    await userEvent.type(screen.getByLabelText("Площадь, м²"), "94");
    await userEvent.selectOptions(
      screen.getByLabelText("Состояние ремонта"),
      "fresh_repair"
    );

    await userEvent.click(screen.getByRole("button", { name: "Рассчитать цену" }));

    expect(onSubmit).toHaveBeenCalledWith({
      rooms: 3,
      areaM2: 94,
      floor: 5,
      totalFloors: 9,
      repairCondition: "fresh_repair",
    });
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `../ParamsStep` не существует.

- [ ] **Step 3: Реализовать `components/wizard/ParamsStep.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import type { RepairCondition, ValuationParams } from "@/lib/mock/types";

const REPAIR_OPTIONS: { value: RepairCondition; label: string }[] = [
  { value: "fresh_repair", label: "Свежий ремонт" },
  { value: "good_livable", label: "Хорошее жилое состояние" },
  { value: "cosmetic", label: "Косметический ремонт" },
  { value: "needs_repair", label: "Требует ремонта" },
];

interface ParamsStepProps {
  onSubmit: (params: ValuationParams) => void;
}

export function ParamsStep({ onSubmit }: ParamsStepProps) {
  const [rooms, setRooms] = useState(2);
  const [areaM2, setAreaM2] = useState(60);
  const [floor, setFloor] = useState(5);
  const [totalFloors, setTotalFloors] = useState(9);
  const [repairCondition, setRepairCondition] = useState<RepairCondition>("good_livable");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ rooms, areaM2, floor, totalFloors, repairCondition });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold">Параметры квартиры</h2>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="rooms">
        Количество комнат
      </label>
      <input
        id="rooms"
        type="number"
        min={1}
        max={6}
        value={rooms}
        onChange={(event) => setRooms(Number(event.target.value))}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="area">
        Площадь, м²
      </label>
      <input
        id="area"
        type="number"
        min={10}
        value={areaM2}
        onChange={(event) => setAreaM2(Number(event.target.value))}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="floor">
        Этаж
      </label>
      <input
        id="floor"
        type="number"
        min={1}
        value={floor}
        onChange={(event) => setFloor(Number(event.target.value))}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="total-floors">
        Этажность дома
      </label>
      <input
        id="total-floors"
        type="number"
        min={1}
        value={totalFloors}
        onChange={(event) => setTotalFloors(Number(event.target.value))}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="repair">
        Состояние ремонта
      </label>
      <select
        id="repair"
        value={repairCondition}
        onChange={(event) => setRepairCondition(event.target.value as RepairCondition)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      >
        {REPAIR_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark"
      >
        Рассчитать цену
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Подключить Шаг 2 в `OtsenkaWizard`**

Заменить содержимое `components/wizard/OtsenkaWizard.tsx` на:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { matchAddress } from "@/lib/mock/addresses";
import { calculateValuation } from "@/lib/mock/valuation";
import type {
  AddressMatchResult,
  ValuationParams,
  ValuationResult,
} from "@/lib/mock/types";
import { AddressConfirmStep } from "./AddressConfirmStep";
import { ParamsStep } from "./ParamsStep";
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [match, setMatch] = useState<AddressMatchResult | null>(null);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);

  useEffect(() => {
    setMatch(matchAddress(address));
  }, [address]);

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress current={step} />

      {step === 1 && match && (
        <AddressConfirmStep
          address={address}
          match={match}
          onConfirm={(confirmed) => {
            setMatch(confirmed);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <ParamsStep
          onSubmit={(params: ValuationParams) => {
            const complexName =
              match?.status === "matched" ? match.residentialComplex : "";
            setValuation(calculateValuation(complexName, params));
            setStep(3);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Проверить сборку**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Коммит**

```bash
git add components/wizard/ParamsStep.tsx components/wizard/__tests__/ParamsStep.test.tsx components/wizard/OtsenkaWizard.tsx
git commit -m "feat: add valuation params step"
```

---

### Task 8: Мастер оценки — Шаг 3 (результат: две цены) (TDD)

**Files:**
- Create: `components/wizard/ResultStep.tsx`
- Test: `components/wizard/__tests__/ResultStep.test.tsx`
- Modify: `components/wizard/OtsenkaWizard.tsx`

- [ ] **Step 1: Написать падающий тест для `ResultStep`**

Создать `components/wizard/__tests__/ResultStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ResultStep } from "../ResultStep";
import { formatTenge } from "@/lib/format";

describe("ResultStep", () => {
  it("shows both prices when valuation is ready", async () => {
    const onContinue = vi.fn();
    render(
      <ResultStep
        valuation={{
          status: "ready",
          basePricePerM2: 856957,
          instantPrice: Math.round(856957 * 61 * 0.9),
          marketPrice: Math.round(856957 * 61 * 0.93),
        }}
        onContinue={onContinue}
      />
    );

    expect(
      screen.getByText(formatTenge(Math.round(856957 * 61 * 0.9)))
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatTenge(Math.round(856957 * 61 * 0.93)))
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Продолжить" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("shows an insufficient data message when valuation is not ready", () => {
    render(
      <ResultStep valuation={{ status: "insufficient_data" }} onContinue={vi.fn()} />
    );

    expect(
      screen.getByText("Пока не можем точно оценить эту квартиру")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `../ResultStep` не существует.

- [ ] **Step 3: Реализовать `components/wizard/ResultStep.tsx`**

```tsx
"use client";

import type { ValuationResult } from "@/lib/mock/types";
import { formatTenge } from "@/lib/format";

interface ResultStepProps {
  valuation: ValuationResult;
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
          В этом доме ещё мало сравнимых объявлений. Наш эксперт свяжется с
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
        <p className="mt-4 text-3xl font-semibold">{formatTenge(valuation.instantPrice)}</p>
        <p className="mt-2 text-sm text-ink/60">Выкуп в течение нескольких дней</p>
      </div>

      <div className="rounded-card bg-accent-light p-8 shadow-sm ring-2 ring-accent">
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm text-white">
          Рыночная продажа
        </span>
        <p className="mt-4 text-3xl font-semibold">{formatTenge(valuation.marketPrice)}</p>
        <p className="mt-2 text-sm text-ink/60">Максимальная цена, дольше по срокам</p>
      </div>

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

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Подключить Шаг 3 в `OtsenkaWizard`**

Заменить содержимое `components/wizard/OtsenkaWizard.tsx` на:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { matchAddress } from "@/lib/mock/addresses";
import { calculateValuation } from "@/lib/mock/valuation";
import type {
  AddressMatchResult,
  ValuationParams,
  ValuationResult,
} from "@/lib/mock/types";
import { AddressConfirmStep } from "./AddressConfirmStep";
import { ParamsStep } from "./ParamsStep";
import { ResultStep } from "./ResultStep";
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [match, setMatch] = useState<AddressMatchResult | null>(null);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);

  useEffect(() => {
    setMatch(matchAddress(address));
  }, [address]);

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress current={step} />

      {step === 1 && match && (
        <AddressConfirmStep
          address={address}
          match={match}
          onConfirm={(confirmed) => {
            setMatch(confirmed);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <ParamsStep
          onSubmit={(params: ValuationParams) => {
            const complexName =
              match?.status === "matched" ? match.residentialComplex : "";
            setValuation(calculateValuation(complexName, params));
            setStep(3);
          }}
        />
      )}

      {step === 3 && valuation && (
        <ResultStep valuation={valuation} onContinue={() => setStep(4)} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Проверить сборку**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Коммит**

```bash
git add components/wizard/ResultStep.tsx components/wizard/__tests__/ResultStep.test.tsx components/wizard/OtsenkaWizard.tsx
git commit -m "feat: add valuation result step"
```

---

### Task 9: Мастер оценки — Шаг 4 (контакты) и интеграционный тест всего флоу (TDD)

**Files:**
- Create: `components/wizard/ContactStep.tsx`
- Test: `components/wizard/__tests__/ContactStep.test.tsx`
- Modify: `components/wizard/OtsenkaWizard.tsx`
- Test: `components/wizard/__tests__/OtsenkaWizard.test.tsx`

- [ ] **Step 1: Написать падающий тест для `ContactStep`**

Создать `components/wizard/__tests__/ContactStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ContactStep } from "../ContactStep";

describe("ContactStep", () => {
  it("does not submit without consent", async () => {
    const onSubmit = vi.fn();
    render(<ContactStep onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Имя"), "Алибек");
    await userEvent.type(screen.getByLabelText("Телефон"), "+77009170103");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits name and phone once consent is checked", async () => {
    const onSubmit = vi.fn();
    render(<ContactStep onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Имя"), "Алибек");
    await userEvent.type(screen.getByLabelText("Телефон"), "+77009170103");
    await userEvent.click(
      screen.getByLabelText("Согласен(а) на обработку персональных данных")
    );
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Алибек",
      phone: "+77009170103",
    });
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npm test`
Expected: FAIL — `../ContactStep` не существует.

- [ ] **Step 3: Реализовать `components/wizard/ContactStep.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";

export interface ContactInfo {
  name: string;
  phone: string;
}

interface ContactStepProps {
  onSubmit: (contact: ContactInfo) => void;
}

export function ContactStep({ onSubmit }: ContactStepProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) return;
    onSubmit({ name, phone });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold">Оставьте контакты</h2>
      <p className="mt-2 text-ink/70">
        Мы свяжемся с вами, чтобы обсудить дальнейшие шаги.
      </p>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="name">
        Имя
      </label>
      <input
        id="name"
        type="text"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="phone">
        Телефон
      </label>
      <input
        id="phone"
        type="tel"
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 flex items-start gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1"
        />
        Согласен(а) на обработку персональных данных
      </label>

      <button
        type="submit"
        disabled={!consent}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        Отправить
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Подключить Шаг 4 в `OtsenkaWizard`**

Заменить содержимое `components/wizard/OtsenkaWizard.tsx` на финальную
версию со всеми четырьмя шагами:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { matchAddress } from "@/lib/mock/addresses";
import { calculateValuation } from "@/lib/mock/valuation";
import type {
  AddressMatchResult,
  ValuationParams,
  ValuationResult,
} from "@/lib/mock/types";
import { AddressConfirmStep } from "./AddressConfirmStep";
import { ParamsStep } from "./ParamsStep";
import { ResultStep } from "./ResultStep";
import { ContactStep, type ContactInfo } from "./ContactStep";
import { WizardProgress } from "./WizardProgress";

type WizardStep = 1 | 2 | 3 | 4;

export function OtsenkaWizard() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";

  const [step, setStep] = useState<WizardStep>(1);
  const [match, setMatch] = useState<AddressMatchResult | null>(null);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [submitted, setSubmitted] = useState<ContactInfo | null>(null);

  useEffect(() => {
    setMatch(matchAddress(address));
  }, [address]);

  return (
    <div className="flex flex-col gap-8">
      <WizardProgress current={step} />

      {step === 1 && match && (
        <AddressConfirmStep
          address={address}
          match={match}
          onConfirm={(confirmed) => {
            setMatch(confirmed);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <ParamsStep
          onSubmit={(params: ValuationParams) => {
            const complexName =
              match?.status === "matched" ? match.residentialComplex : "";
            setValuation(calculateValuation(complexName, params));
            setStep(3);
          }}
        />
      )}

      {step === 3 && valuation && (
        <ResultStep valuation={valuation} onContinue={() => setStep(4)} />
      )}

      {step === 4 && !submitted && (
        <ContactStep onSubmit={(contact) => setSubmitted(contact)} />
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

- [ ] **Step 6: Написать интеграционный тест всего флоу**

Создать `components/wizard/__tests__/OtsenkaWizard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { OtsenkaWizard } from "../OtsenkaWizard";
import { formatTenge } from "@/lib/format";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ address: "Жошы хана 27" }),
}));

describe("OtsenkaWizard", () => {
  it("walks through all four steps for a known address", async () => {
    render(<OtsenkaWizard />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Это мой дом, продолжить" })
    );

    await userEvent.clear(screen.getByLabelText("Количество комнат"));
    await userEvent.type(screen.getByLabelText("Количество комнат"), "2");
    await userEvent.clear(screen.getByLabelText("Площадь, м²"));
    await userEvent.type(screen.getByLabelText("Площадь, м²"), "61");
    await userEvent.click(screen.getByRole("button", { name: "Рассчитать цену" }));

    expect(
      screen.getByText(formatTenge(Math.round(856957 * 61 * 0.9)))
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatTenge(Math.round(856957 * 61 * 0.93)))
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    await userEvent.type(screen.getByLabelText("Имя"), "Алибек");
    await userEvent.type(screen.getByLabelText("Телефон"), "+77009170103");
    await userEvent.click(
      screen.getByLabelText("Согласен(а) на обработку персональных данных")
    );
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(screen.getByText("Спасибо, Алибек!")).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Запустить все тесты и убедиться, что они проходят**

Run: `npm test`
Expected: PASS — все тесты проекта зелёные, включая `OtsenkaWizard.test.tsx`.

- [ ] **Step 8: Проверить сборку**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 9: Коммит**

```bash
git add components/wizard/ContactStep.tsx components/wizard/__tests__/ContactStep.test.tsx components/wizard/OtsenkaWizard.tsx components/wizard/__tests__/OtsenkaWizard.test.tsx
git commit -m "feat: add contact step and complete otsenka wizard flow"
```

---

### Task 10: Ручная проверка в браузере

Автотесты покрывают логику; этот шаг — визуальная проверка реального рендера
(стили, переходы между шагами, отсутствие ошибок в консоли).

**Files:** нет изменений кода — только проверка.

- [ ] **Step 1: Запустить dev-сервер**

Run: `npm run dev`
Expected: сервер стартует на `http://localhost:3000` без ошибок в терминале.

- [ ] **Step 2: Проверить лендинг**

Открыть `http://localhost:3000`. Убедиться: заголовок Hero, блок «Как это
работает» из трёх карточек, зелёный акцентный цвет на кнопке видны, поле
адреса кликабельно.

- [ ] **Step 3: Пройти флоу с известным адресом**

Ввести `Жошы хана 27` в поле адреса и отправить форму. Убедиться: переход на
`/otsenka?address=%D0%96%D0%BE%D1%88%D1%8B%20%D1%85%D0%B0%D0%BD%D0%B0%2027`,
на Шаге 1 показана карточка «Prime Garden, район Есиль».

- [ ] **Step 4: Пройти Шаги 2–3**

Нажать «Это мой дом, продолжить», заполнить параметры (2 комнаты, 61 м²),
нажать «Рассчитать цену». Убедиться: показаны две карточки — «Срочная
продажа» и «Рыночная продажа» с корректно отформатированными суммами в ₸,
карточка «Рыночная продажа» визуально выделена (зелёный фон/обводка).

- [ ] **Step 5: Пройти Шаг 4**

Нажать «Продолжить», заполнить имя и телефон, отметить согласие, нажать
«Отправить». Убедиться: показан экран благодарности с именем и телефоном.

- [ ] **Step 6: Проверить сценарий «адрес не найден»**

Вернуться на лендинг, ввести произвольный несуществующий адрес. Убедиться:
на Шаге 1 показан селект выбора района, выбор района переводит на Шаг 2.

- [ ] **Step 7: Проверить консоль браузера**

Открыть DevTools → Console на каждом шаге. Убедиться: нет ошибок и
warning'ов (кроме стандартных Next.js dev-сообщений).

- [ ] **Step 8: Остановить dev-сервер**

Остановить процесс `npm run dev` (Ctrl+C или закрыть фоновую задачу).

Изменений кода на этом шаге нет — коммит не требуется.
