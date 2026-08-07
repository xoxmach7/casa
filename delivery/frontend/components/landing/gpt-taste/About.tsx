import GptMockup from './Mockup';

const STEPS = [
  'вести актуальный каталог объектов,',
  'принимать и контролировать фиксации клиентов,',
  'сопровождать сделки,',
  'управлять партнёрскими продажами,',
  'получать полную аналитику по каждому этапу — от первой заявки до выплаты вознаграждения.',
];

export default function GptAbout() {
  return (
    <section id="about" className="border-t border-neutral-200 bg-white py-24 sm:py-32">
      <div className="mx-auto grid max-w-5xl gap-14 px-5 sm:px-8 md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-neutral-900 sm:text-3xl">О проекте</h2>

          <p className="mt-5 text-[15px] leading-relaxed text-neutral-500">
            CASA Pro — единая система продаж новостроек, которая объединяет застройщиков, агентства недвижимости и
            ипотечных брокеров.
          </p>

          <p className="mt-5 text-[15px] font-medium text-neutral-800">Платформа помогает:</p>

          <ol className="mt-3 space-y-2.5">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-[15px] leading-relaxed text-neutral-500">
                <span className="shrink-0 font-medium text-neutral-900">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <GptMockup />
      </div>
    </section>
  );
}
