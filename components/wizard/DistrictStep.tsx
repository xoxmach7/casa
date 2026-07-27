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
