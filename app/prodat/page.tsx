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
