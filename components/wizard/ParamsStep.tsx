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
