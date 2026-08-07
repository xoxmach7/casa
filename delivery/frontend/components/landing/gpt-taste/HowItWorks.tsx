const STEPS = [
  'Застройщик добавляет жилые комплексы и квартиры.',
  'Партнёры получают актуальный каталог.',
  'Риелтор отправляет клиента на фиксацию.',
  'Застройщик подтверждает фиксацию.',
  'Клиент бронирует квартиру и выходит на сделку.',
  'CASA Pro фиксирует статус сделки и выплату комиссии.',
];

export default function GptHowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-neutral-200 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-xl px-5 text-center sm:px-8">
        <h2 className="text-2xl font-medium tracking-tight text-neutral-900 sm:text-3xl">Как это работает</h2>
        <p className="mt-2 text-[13px] font-medium text-neutral-400">6 простых шагов</p>

        <ol className="mt-10 space-y-0 text-left">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-4 border-t border-neutral-200 py-4 first:border-t-0">
              <span className="shrink-0 text-sm font-medium text-neutral-300">{String(i + 1).padStart(2, '0')}</span>
              <p className="text-[15px] leading-relaxed text-neutral-700">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
