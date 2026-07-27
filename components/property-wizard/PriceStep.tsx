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
