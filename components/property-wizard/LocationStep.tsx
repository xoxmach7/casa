"use client";

import { ALMATY_DISTRICTS } from "@/lib/districts";

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
