import { Building2, ShieldCheck, UsersRound, Workflow, Percent } from 'lucide-react';

const ITEMS = [
  { icon: Building2, label: 'Актуальный каталог новостроек' },
  { icon: UsersRound, label: 'Проверенные партнеры' },
  { icon: ShieldCheck, label: 'Контроль фиксаций клиентов' },
  { icon: Workflow, label: 'Автоматизация работы отдела продаж' },
  { icon: Percent, label: 'Контроль комиссий и выплат' },
];

export default function WhyUs() {
  return (
    <section id="why-us" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-[#14213d] sm:text-3xl">
          Почему пользователи выбирают нас
        </h2>

        <div className="mt-12 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-6 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7edfb]">
                <Icon className="h-5 w-5 text-[#2f5fdb]" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
