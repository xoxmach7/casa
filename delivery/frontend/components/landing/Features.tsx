import { Check } from 'lucide-react';
import { typo } from '@/lib/typography';

const DEVELOPER_ITEMS = [
  'Управляйте каталогом ЖК, квартирами, ценами, планировками и остатками в одном кабинете.',
  'Получайте заявки от проверенных агентов недвижимости и ипотечных специалистов.',
  'Контролируйте фиксации клиентов, бронирования и весь путь сделки.',
  'Отслеживайте выплаты партнёрам, историю сделок и аналитику продаж.',
];

const BROKER_ITEMS = [
  'Ищите актуальные квартиры вторичного рынка и квартиры в новостройках.',
  'Следите за подтверждёнными этапами сделки и статусом своего вознаграждения.',
  'Получите предварительную оценку бюджета, допустимого платежа и ипотечного сценария.',
];

function FeatureCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-7 sm:p-8">
      <h3 className="text-lg font-bold text-[#141f3a]">{typo(title)}</h3>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white">
              <Check className="h-3 w-3 text-[#2f5fdb]" strokeWidth={3} />
            </span>
            <span className="text-[15px] leading-relaxed text-slate-600">{typo(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Features() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-12 text-2xl font-bold text-[#141f3a] sm:text-3xl">Возможности</h2>

        <div className="grid gap-6 md:grid-cols-2">
          <FeatureCard title="Для застройщика" items={DEVELOPER_ITEMS} />
          <FeatureCard title="Для брокера/риелтора" items={BROKER_ITEMS} />
        </div>
      </div>
    </section>
  );
}
