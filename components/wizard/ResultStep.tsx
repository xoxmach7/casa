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

      <p className="sm:col-span-2 text-xs text-ink/50">
        Точный расчёт также учитывает этаж и состояние ремонта — эксперт
        уточнит его при следующем шаге.
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
