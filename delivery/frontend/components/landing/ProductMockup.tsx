import { ChevronDown, SlidersHorizontal } from 'lucide-react';

const FILTERS = ['Поиск ЖК...', 'Все районы', 'Любой статус', 'Любой класс'];

function CatalogCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#14213d]">Каталог новостроек</p>
        <p className="text-[11px] text-slate-400">Жилые комплексы от проверенных застройщиков</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500"
          >
            {f}
            <ChevronDown className="h-2.5 w-2.5" />
          </span>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-1 text-[10px] font-medium text-[#2f5fdb]">
        <SlidersHorizontal className="h-3 w-3" />
        Больше фильтров
      </div>

      <div className="grid grid-cols-2 gap-2">
        {['Каталог', 'Ипотека'].map((label) => (
          <div key={label} className="overflow-hidden rounded-xl border border-slate-100">
            <div className="flex h-14 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-[10px] font-medium text-slate-400">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-0.5 text-sm font-semibold text-[#14213d]">Ипотека</p>
      <p className="mb-3 text-[11px] text-slate-400">Расчёт ипотеки для новостройки</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2.5">
          <div>
            <p className="mb-1 text-[10px] text-slate-400">Калькулятор ипотеки</p>
            <p className="text-[9px] text-slate-400">Первоначальный взнос и калькулятор в комнате</p>
          </div>
          <div className="space-y-1 text-[10px] text-slate-500">
            <p>○ % от стоимости</p>
            <p>○ Фиксированная сумма</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">Стоимость недвижимости</p>
            <div className="mt-0.5 h-6 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600">
              52 100 000 ₸
            </div>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">Первоначальный взнос</p>
            <div className="mt-1 h-1 rounded-full bg-slate-200">
              <div className="h-1 w-1/5 rounded-full bg-[#2f5fdb]" />
            </div>
            <p className="mt-0.5 text-[9px] text-slate-500">20% / 10 420 000 ₸</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">Срок кредита</p>
            <div className="mt-1 h-1 rounded-full bg-slate-200">
              <div className="h-1 w-3/4 rounded-full bg-[#2f5fdb]" />
            </div>
            <p className="mt-0.5 text-[9px] text-slate-500">20 лет</p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-[#f3f6fd] p-3">
          <div>
            <p className="text-[9px] text-slate-500">Ежемесячный платёж</p>
            <p className="mt-1 text-lg font-bold text-[#14213d]">217 084 ₸</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[8px] text-slate-400">Сумма кредита</p>
              <p className="text-[10px] font-semibold text-slate-600">28 000 000 ₸</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-400">Ставка</p>
              <p className="text-[10px] font-semibold text-slate-600">24 100 ₸</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[8px] text-slate-400">Общая сумма выплат</p>
            <p className="text-[10px] font-semibold text-slate-600">52 100 088 ₸</p>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="mt-3 rounded-md bg-[#14213d] py-1.5 text-[9px] font-medium text-white"
          >
            Сохранить расчёт
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductMockup() {
  return (
    <div aria-hidden className="space-y-4">
      <CatalogCard />
      <MortgageCard />
    </div>
  );
}
