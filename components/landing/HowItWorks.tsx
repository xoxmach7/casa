const STEPS = [
  {
    title: "Введите адрес",
    description: "Укажите адрес квартиры и основные параметры.",
  },
  {
    title: "Получите две цены",
    description: "Срочная продажа — быстрее, рыночная — выгоднее. Решать вам.",
  },
  {
    title: "Продайте на своих условиях",
    description:
      "Мы берём на себя фотосъёмку, документы и поиск покупателя.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-center text-3xl font-semibold">Как это работает</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="rounded-card bg-white p-6 shadow-sm">
            <span className="text-sm text-accent-dark">{index + 1}</span>
            <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
            <p className="mt-2 text-ink/70">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
