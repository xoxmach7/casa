export default function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[#141f3a] py-28 sm:py-36"
    >
      {/* Faint architectural line pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, transparent 48%, rgba(255,255,255,0.6) 49%, rgba(255,255,255,0.6) 50%, transparent 51%), linear-gradient(45deg, transparent 48%, rgba(255,255,255,0.6) 49%, rgba(255,255,255,0.6) 50%, transparent 51%)",
          backgroundSize: '64px 64px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full border border-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-[280px] w-[280px] rounded-full border border-white/10"
      />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h1 className="text-balance text-3xl font-medium leading-tight text-white/90 sm:text-4xl md:text-5xl">
          CASA Pro —<br className="hidden sm:block" /> закрытая B2B-платформа для{' '}
          <span className="font-bold text-white">риелторов, ипотечных</span>{' '}
          брокеров и застройщиков.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base text-slate-300 sm:text-lg">
          Объекты, ипотека и сделки — в одной системе.
        </p>

        <a
          href="#contact"
          className="mt-10 inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-[#14213d]"
        >
          Запросить доступ
        </a>
      </div>
    </section>
  );
}
