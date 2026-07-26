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
