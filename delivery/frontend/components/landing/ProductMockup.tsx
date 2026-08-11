import {
  Search,
  ChevronDown,
  SlidersHorizontal,
  Building2,
  LayoutGrid,
  List,
  Map as MapIcon,
  Save,
} from 'lucide-react';

// Декоративный коллаж двух реальных экранов продукта — каталог новостроек и
// калькулятор ипотеки внахлёст, как в Figma-макете секции «О проекте».
// aria-hidden: это иллюстрация, а не интерактив.
//
// Цифры калькулятора сходятся между собой (их читают потенциальные клиенты):
// стоимость 35 000 000, взнос 20% = 7 000 000, кредит 28 000 000, срок 20 лет →
// платёж 217 084/мес, всего выплат 52 100 088, переплата 24 100 088. Меняете
// одно число — пересчитайте остальные.

// Фото-заглушка здания: «небо → корпус» плюс тонкая сетка окон. Самодостаточно,
// без внешних файлов. tone сдвигает оттенок, чтобы карточки не были одинаковыми.
// Градиент «неба→корпуса» задаём inline-стилем, а не Tailwind-классами: JIT не
// генерирует классы, собранные из переменной в рантайме.
const SKY: Record<'a' | 'b' | 'c', string> = {
  a: 'linear-gradient(to bottom, #9fb4d6, #6b83ad 55%, #2c3c5c)',
  b: 'linear-gradient(to bottom, #b9c4d4, #8593a8 55%, #3a4658)',
  c: 'linear-gradient(to bottom, #a7bdc9, #6f8a99 55%, #2f4650)',
};

function BuildingPhoto({ tone }: { tone: 'a' | 'b' | 'c' }) {
  return (
    <div className="relative h-full w-full" style={{ backgroundImage: SKY[tone] }}>
      {/* сетка «окон» */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.7) 0 1px, transparent 1px 11px), repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 9px)',
        }}
      />
      {/* блик неба сверху */}
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent" />
    </div>
  );
}

const PROJECTS = [
  { name: 'Highvill', cls: 'Premium', status: 'Сдан', tone: 'a' as const, statusTone: 'ready' as const },
  { name: 'Nova City', cls: 'Business', status: 'Строится', tone: 'b' as const, statusTone: 'build' as const },
  { name: 'Sensata Park', cls: 'Premium', status: 'Строится', tone: 'c' as const, statusTone: 'build' as const },
];

function CatalogPanel() {
  return (
    <div className="w-[86%] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-16px_rgba(20,31,58,0.28)] sm:p-5">
      {/* заголовок */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-[13px] font-bold text-[#141f3a] sm:text-sm">Каталог новостроек</p>
          <p className="text-[9px] text-slate-400 sm:text-[10px]">
            Жилые комплексы от проверенных застройщиков (5)
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#15325b] px-2 py-1 text-[9px] font-semibold text-white">
            <Building2 className="h-2.5 w-2.5" /> Добавить объект
          </span>
          <span className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5">
            <LayoutGrid className="h-3 w-3 rounded bg-[#15325b] p-[3px] text-white" />
            <List className="h-3 w-3 text-slate-300" />
            <MapIcon className="h-3 w-3 text-slate-300" />
          </span>
        </div>
      </div>

      {/* фильтры */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex flex-1 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[9px] text-slate-400">
          <Search className="h-2.5 w-2.5" /> Поиск ЖК...
        </span>
        {['Все районы', 'Любой статус', 'Любой класс'].map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] text-slate-500"
          >
            {f}
            <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
          </span>
        ))}
      </div>
      <div className="mb-3 flex items-center gap-1 text-[9px] font-medium text-slate-400">
        <SlidersHorizontal className="h-2.5 w-2.5" /> Больше фильтров
      </div>

      {/* карточки ЖК */}
      <div className="grid grid-cols-3 gap-2">
        {PROJECTS.map((p) => (
          <div key={p.name} className="overflow-hidden rounded-xl border border-slate-100">
            <div className="relative h-16">
              <BuildingPhoto tone={p.tone} />
              <span className="absolute left-1.5 top-1.5 rounded-md bg-white/25 px-1.5 py-0.5 text-[8px] font-semibold text-white backdrop-blur-sm">
                {p.cls}
              </span>
              <span
                className={`absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[8px] font-semibold text-white ${
                  p.statusTone === 'ready' ? 'bg-emerald-600' : 'bg-[#15325b]'
                }`}
              >
                {p.status}
              </span>
            </div>
            <div className="px-2 py-1.5">
              <p className="truncate text-[9px] font-semibold text-[#141f3a]">{p.name}</p>
              <p className="text-[8px] text-slate-400">от 28.6 млн ₸</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Radio({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`flex h-2.5 w-2.5 items-center justify-center rounded-full border ${
          checked ? 'border-[#2f5fdb]' : 'border-slate-300'
        }`}
      >
        {checked && <span className="h-1 w-1 rounded-full bg-[#2f5fdb]" />}
      </span>
      <span className={`text-[9px] ${checked ? 'font-medium text-[#141f3a]' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );
}

function Slider({
  label,
  value,
  fill,
  min,
  max,
}: {
  label: string;
  value: string;
  fill: number;
  min: string;
  max: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[9px] text-slate-500">{label}</p>
        <p className="text-[9px] font-semibold text-[#141f3a]">{value}</p>
      </div>
      <div className="relative mt-1.5 h-1 rounded-full bg-slate-200">
        <div className="absolute left-0 top-0 h-1 rounded-full bg-[#2f5fdb]" style={{ width: `${fill}%` }} />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-[#2f5fdb] bg-white shadow-sm"
          style={{ left: `calc(${fill}% - 5px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[7px] text-slate-300">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function MortgagePanel() {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_28px_60px_-20px_rgba(20,31,58,0.45)] sm:p-5">
      {/* заголовок + вкладки */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-[13px] font-bold text-[#141f3a] sm:text-sm">Ипотека</p>
          <p className="text-[9px] text-slate-400 sm:text-[10px]">
            Каталог ипотечных программ и калькулятор
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
          {['Каталог программ', 'Калькулятор', 'Скоринг'].map((t) => (
            <span
              key={t}
              className={`rounded-md px-2 py-1 text-[8px] font-medium ${
                t === 'Калькулятор' ? 'bg-white text-[#141f3a] shadow-sm' : 'text-slate-400'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1.15fr_1fr] gap-3">
        {/* левая колонка — параметры */}
        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] font-semibold text-[#141f3a]">Калькулятор ипотеки</p>
            <p className="text-[8px] text-slate-400">Рассчитайте ежемесячный платёж и переплату</p>
          </div>

          <div>
            <p className="mb-1 text-[9px] font-medium text-slate-500">Вид расчёта</p>
            <div className="space-y-1">
              <Radio checked label="По стоимости недвижимости" />
              <Radio label="По доходу (заработной плате)" />
              <Radio label="По ежемесячному платежу" />
            </div>
          </div>

          <Slider label="Стоимость недвижимости" value="35 000 000 ₸" fill={16} min="5 млн" max="300 млн" />
          <Slider label="Первоначальный взнос" value="20% (7 000 000 ₸)" fill={22} min="0%" max="90%" />
          <Slider label="Срок кредита" value="20 лет" fill={66} min="1 год" max="30 лет" />
        </div>

        {/* правая колонка — результат (тёмная панель) */}
        <div className="flex flex-col rounded-xl bg-[#15325b] p-3 text-white">
          <p className="text-[8px] text-white/60">Ежемесячный платёж</p>
          <p className="mt-0.5 text-lg font-bold leading-none sm:text-xl">217 084 ₸</p>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-2.5">
            <div>
              <p className="text-[7px] text-white/50">Сумма кредита</p>
              <p className="text-[9px] font-semibold">28 000 000 ₸</p>
            </div>
            <div>
              <p className="text-[7px] text-white/50">Переплата</p>
              <p className="text-[9px] font-semibold text-[#f0b429]">24 100 088 ₸</p>
            </div>
          </div>

          <div className="mt-2.5">
            <p className="text-[7px] text-white/50">Общая сумма выплат</p>
            <p className="text-[10px] font-semibold">52 100 088 ₸</p>
          </div>

          <div className="mt-auto pt-3">
            <span className="flex items-center justify-center gap-1 rounded-lg bg-white py-1.5 text-[8px] font-semibold text-[#15325b]">
              <Save className="h-2.5 w-2.5" /> Сохранить расчёт клиенту
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductMockup() {
  return (
    <div aria-hidden className="relative">
      {/* мягкое свечение под коллажем для глубины */}
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-[#dbe6f8]/60 to-transparent blur-2xl" />

      {/* каталог — верхний слой, прижат вправо */}
      <div className="flex justify-end">
        <CatalogPanel />
      </div>

      {/* калькулятор — нижний слой внахлёст, сдвинут влево */}
      <div className="relative z-10 -mt-14 w-[94%] sm:-mt-16">
        <MortgagePanel />
      </div>
    </div>
  );
}
