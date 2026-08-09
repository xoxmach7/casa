import ProductMockup from './ProductMockup';
import { typo } from '@/lib/typography';

const STEPS = [
  'вести актуальный каталог объектов,',
  'принимать и контролировать фиксации клиентов,',
  'сопровождать сделки,',
  'управлять партнёрскими продажами,',
  'получать полную аналитику по каждому этапу — от первой заявки до выплаты вознаграждения.',
];

export default function About() {
  return (
    <section id="about" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <h2 className="text-2xl font-bold text-[#141f3a] sm:text-3xl">О проекте</h2>

          <p className="mt-5 text-[15px] leading-relaxed text-slate-600">
            {typo(
              'CASA Pro — единая система продаж новостроек, которая объединяет застройщиков, агентства недвижимости и ипотечных брокеров.'
            )}
          </p>

          <p className="mt-5 text-[15px] font-medium text-slate-700">Платформа помогает:</p>

          <ol className="mt-3 space-y-2.5">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-[15px] leading-relaxed text-slate-600">
                <span className="shrink-0 font-semibold text-[#141f3a]">{i + 1}.</span>
                {typo(step)}
              </li>
            ))}
          </ol>
        </div>

        <ProductMockup />
      </div>
    </section>
  );
}
