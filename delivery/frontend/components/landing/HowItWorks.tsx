import { ChevronsDown } from 'lucide-react';

const STEPS = [
  'Застройщик добавляет жилые комплексы и квартиры.',
  'Партнёры получают актуальный каталог.',
  'Риелтор отправляет клиента на фиксацию.',
  'Застройщик подтверждает фиксацию.',
  'Клиент бронирует квартиру и выходит на сделку.',
  'CASA Pro фиксирует статус сделки и выплату комиссии.',
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-gradient-to-b from-[#eef3fc] to-[#dbe6f8] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-[#14213d] sm:text-3xl">Как это работает</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">6 простых шагов:</p>

        <ol className="mt-10 flex flex-col items-center">
          {STEPS.map((step, i) => (
            <li key={step} className="flex flex-col items-center">
              <p className="max-w-md text-[15px] font-medium text-[#14213d]">{step}</p>
              {i < STEPS.length - 1 && (
                <ChevronsDown aria-hidden className="my-3 h-4 w-4 text-[#2f5fdb]" />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
