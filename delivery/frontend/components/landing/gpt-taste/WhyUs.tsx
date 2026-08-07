import { Building2, ShieldCheck, UsersRound, Workflow, Percent } from 'lucide-react';

const ITEMS = [
  { icon: Building2, label: 'Актуальный каталог новостроек' },
  { icon: UsersRound, label: 'Проверенные партнеры' },
  { icon: ShieldCheck, label: 'Контроль фиксаций клиентов' },
  { icon: Workflow, label: 'Автоматизация работы отдела продаж' },
  { icon: Percent, label: 'Контроль комиссий и выплат' },
];

export default function GptWhyUs() {
  return (
    <section id="why-us" className="border-t border-neutral-200 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <h2 className="text-center text-2xl font-medium tracking-tight text-neutral-900 sm:text-3xl">
          Почему пользователи выбирают нас
        </h2>

        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-5">
          {ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center bg-white p-6 text-center">
              <Icon className="h-5 w-5 text-neutral-900" strokeWidth={1.5} />
              <p className="mt-4 text-[13px] font-medium leading-relaxed text-neutral-600">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
