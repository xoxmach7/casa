export default function GptHero() {
  return (
    <section id="top" className="bg-white py-28 sm:py-40">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <span className="inline-flex items-center rounded-full border border-neutral-200 px-3.5 py-1 text-[12px] font-medium text-neutral-500">
          Закрытая B2B-платформа
        </span>

        <h1 className="mt-7 text-balance text-4xl font-medium leading-[1.15] tracking-tight text-neutral-900 sm:text-5xl md:text-6xl">
          Продажи недвижимости
          <br className="hidden sm:block" /> без хаоса в таблицах
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-balance text-base leading-relaxed text-neutral-500 sm:text-lg">
          CASA Pro объединяет риелторов, ипотечных брокеров и застройщиков — объекты, ипотека и сделки в одной системе.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#contact"
            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
          >
            Запросить доступ
          </a>
          <a
            href="#about"
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-7 py-3.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
          >
            Как это работает
          </a>
        </div>
      </div>
    </section>
  );
}
