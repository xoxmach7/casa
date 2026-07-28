"use client";

import { useState } from "react";
import { ALMATY_DISTRICTS } from "@/lib/districts";
import { submitBuyerLead } from "@/lib/api/procasa-client";

const ROOM_OPTIONS = [1, 2, 3, 4] as const;

export function BuyerPreferencesForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [rooms, setRooms] = useState<number[]>([]);
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  function toggleRoom(value: number) {
    setRooms((current) =>
      current.includes(value) ? current.filter((r) => r !== value) : [...current, value]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");

    const result = await submitBuyerLead({
      name,
      phone,
      district: district || undefined,
      rooms: rooms.length > 0 ? rooms : undefined,
      minBudget: minBudget ? Number(minBudget) : undefined,
      maxBudget: maxBudget ? Number(maxBudget) : undefined,
    });

    setStatus(result.success ? "success" : "error");
  }

  if (status === "success") {
    return (
      <div className="rounded-card bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold">Заявка принята!</p>
        <p className="mt-2 text-ink/70">
          Мы уведомим вас, как только появится объект по вашим критериям.
        </p>
      </div>
    );
  }

  return (
    <form className="rounded-card bg-white p-8 shadow-sm" onSubmit={handleSubmit}>
      <h2 className="text-2xl font-semibold">Не нашли то, что искали?</h2>
      <p className="mt-2 text-ink/70">
        Оставьте критерии поиска — мы уведомим вас о новых объектах.
      </p>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="buyer-name">
        Имя
      </label>
      <input
        id="buyer-name"
        aria-label="Имя"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="buyer-phone">
        Телефон
      </label>
      <input
        id="buyer-phone"
        aria-label="Телефон"
        type="tel"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="buyer-district">
        Район
      </label>
      <select
        id="buyer-district"
        aria-label="Район"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      >
        <option value="">Любой район</option>
        {ALMATY_DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <p className="mt-4 text-sm text-ink/70">Количество комнат</p>
      <div className="mt-2 flex gap-2">
        {ROOM_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={rooms.includes(value)}
            onClick={() => toggleRoom(value)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              rooms.includes(value)
                ? "border-accent bg-accent text-white"
                : "border-ink/10 text-ink/70"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-4">
        <div className="flex-1">
          <label className="block text-sm text-ink/70" htmlFor="buyer-min-budget">
            Бюджет от
          </label>
          <input
            id="buyer-min-budget"
            aria-label="Бюджет от"
            type="number"
            min={0}
            value={minBudget}
            onChange={(e) => setMinBudget(e.target.value)}
            className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-ink/70" htmlFor="buyer-max-budget">
            Бюджет до
          </label>
          <input
            id="buyer-max-budget"
            aria-label="Бюджет до"
            type="number"
            min={0}
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
          />
        </div>
      </div>

      {status === "error" && (
        <p className="mt-4 text-sm text-red-600">
          Не удалось отправить заявку. Попробуйте ещё раз.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark disabled:opacity-50"
      >
        {status === "submitting" ? "Отправка..." : "Уведомить меня"}
      </button>
    </form>
  );
}
