import { ChevronsDown } from 'lucide-react';
import { typo } from '@/lib/typography';

const STEPS = [
  'Застройщик добавляет жилые комплексы и квартиры.',
  'Партнёры получают актуальный каталог.',
  'Агент отправляет клиента на фиксацию.',
  'Застройщик подтверждает фиксацию.',
  'Клиент бронирует квартиру и выходит на сделку.',
  'CASA Pro фиксирует статус сделки и выплату комиссии.',
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-gradient-to-b from-[#eef3fc] to-[#dbe6f8] py-12 sm:py-14"
    >
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-[#15325B] sm:text-3xl">Как это работает</h2>

        {/* Подпись принадлежит списку, а не заголовку — поэтому она стоит
            вплотную к шагам, а воздух остаётся над ней. */}
        <p className="mt-10 text-lg font-semibold text-[#15325B] sm:text-xl">6 простых шагов:</p>

        <ol className="mt-4 flex flex-col items-center">
          {STEPS.map((step, i) => (
            <li key={step} className="flex flex-col items-center">
              <p className="max-w-md text-[15px] font-medium text-[#15325B]">{typo(step)}</p>
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
