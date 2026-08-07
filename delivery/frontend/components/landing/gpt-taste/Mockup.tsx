import { ChevronDown, SlidersHorizontal } from 'lucide-react';

const FILTERS = ['Поиск ЖК...', 'Все районы', 'Любой статус', 'Любой класс'];

function CatalogCard() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900">Каталог новостроек</p>
        <p className="text-[11px] text-neutral-400">Проверенные застройщики</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-500"
          >
            {f}
            <ChevronDown className="h-2.5 w-2.5" />
          </span>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-1 text-[10px] font-medium text-neutral-900">
        <SlidersHorizontal className="h-3 w-3" />
        Больше фильтров
      </div>

      <div className="grid grid-cols-2 gap-2">
        {['Каталог', 'Ипотека'].map((label) => (
          <div key={label} className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="flex h-14 items-center justify-center bg-neutral-50 text-[10px] font-medium text-neutral-400">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MortgageCard() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="mb-0.5 text-sm font-semibold text-neutral-900">Ипотека</p>
      <p className="mb-3 text-[11px] text-neutral-400">Расчёт ипотеки для новостройки</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2.5">
          <div>
            <p className="text-[9px] text-neutral-400">Стоимость недвижимости</p>
            <div className="mt-0.5 h-6 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] font-medium text-neutral-600">
              52 100 000 ₸
            </div>
          </div>
          <div>
            <p className="text-[9px] text-neutral-400">Первоначальный взнос</p>
            <div className="mt-1 h-1 rounded-full bg-neutral-200">
              <div className="h-1 w-1/5 rounded-full bg-neutral-900" />
            </div>
            <p className="mt-0.5 text-[9px] text-neutral-500">20% / 10 420 000 ₸</p>
          </div>
          <div>
            <p className="text-[9px] text-neutral-400">Срок кредита</p>
            <div className="mt-1 h-1 rounded-full bg-neutral-200">
              <div className="h-1 w-3/4 rounded-full bg-neutral-900" />
            </div>
            <p className="mt-0.5 text-[9px] text-neutral-500">20 лет</p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-neutral-50 p-3">
          <div>
            <p className="text-[9px] text-neutral-500">Ежемесячный платёж</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">217 084 ₸</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[8px] text-neutral-400">Сумма кредита</p>
              <p className="text-[10px] font-semibold text-neutral-600">28 000 000 ₸</p>
            </div>
            <div>
              <p className="text-[8px] text-neutral-400">Ставка</p>
              <p className="text-[10px] font-semibold text-neutral-600">24 100 ₸</p>
            </div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="mt-3 rounded-md bg-neutral-900 py-1.5 text-[9px] font-medium text-white"
          >
            Сохранить расчёт
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GptMockup() {
  return (
    <div aria-hidden className="space-y-4">
      <CatalogCard />
      <MortgageCard />
    </div>
  );
}
