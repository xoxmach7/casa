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
