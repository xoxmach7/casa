import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ChevronDown, ShieldCheck, Phone, MessageCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import CasaHeader from '@/components/CasaHeader';
import Seo from '@/components/Seo';

const faqItems = [
  { q: 'Кто показывает квартиру?', a: 'Собственник. CASA организует запись и сопровождает сделку.' },
  { q: 'Нужно ли отвечать на звонки?', a: 'Нет. Все обращения покупателей принимает CASA.' },
  { q: 'Когда оплачивается комиссия?', a: 'Только если покупатель пришёл через CASA и сделка состоялась.' },
  { q: 'Что входит в услугу?', a: 'Приём обращений, запись на просмотры, сопровождение сделки.' },
];

const SellLanding = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Продать квартиру в Казахстане без звонков"
        description="Продайте квартиру через CASA: без потока звонков, с записью покупателей на просмотр и сопровождением сделки. Астана, Алматы, Шымкент и вся страна."
        path="/sell"
      />
      <CasaHeader variant="sell" />

      <div className="px-4 pb-10">
        {/* Hero */}
        <div className="pt-6 pb-8">
          <h1 className="text-[1.6rem] font-bold text-foreground tracking-tight leading-[1.2] mb-3">
            Меньше звонков.<br />Больше просмотров.<br />Больше сделок.
          </h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
            Покупатели записываются на просмотр через CASA — вы только показываете квартиру.
          </p>
          <button onClick={() => navigate('/sell/add')} className="casa-btn-primary">
            Добавить квартиру
          </button>
        </div>

        {/* How it works */}
        <div id="how-it-works" className="pb-8">
          <h2 className="text-[15px] font-bold text-foreground mb-4">Как это работает</h2>
          <div className="space-y-0">
            {[
              { step: '1', title: 'Добавьте квартиру', desc: 'Заполните основную информацию' },
              { step: '2', title: 'CASA проверит объявление', desc: 'Подготовим публикацию' },
              { step: '3', title: 'Покупатели записываются', desc: 'Без звонков вам напрямую' },
              { step: '4', title: 'Переходите к сделке', desc: 'CASA сопровождает процесс' },
            ].map((item, i, arr) => (
              <div key={item.step} className="flex gap-3.5 py-3.5" style={i < arr.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.5)' } : {}}>
                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-foreground shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground leading-snug">{item.title}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="pb-8">
          <h2 className="text-[15px] font-bold text-foreground mb-3">Условия</h2>
          <div className="casa-card p-5">
            <div className="flex items-baseline gap-2 mb-1">
              <p className="text-[22px] font-bold text-foreground tabular-nums tracking-tight">200 000 ₸</p>
              <p className="text-[12px] text-muted-foreground">за покупателя</p>
            </div>
            <div className="space-y-2 pt-3 border-t border-border/50 mt-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-casa-success shrink-0 mt-0.5" />
                <p className="text-[13px] text-muted-foreground">Оплата только при успешной сделке через CASA</p>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-casa-success shrink-0 mt-0.5" />
                <p className="text-[13px] text-muted-foreground">Вы показываете квартиру сами</p>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-casa-success shrink-0 mt-0.5" />
                <p className="text-[13px] text-muted-foreground">CASA принимает обращения и помогает закрыть сделку</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="pb-8">
          <h2 className="text-[15px] font-bold text-foreground mb-3">Вопросы</h2>
          <div className="casa-card overflow-hidden divide-y divide-border/50">
            {faqItems.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                >
                  <span className="text-[13px] font-medium text-foreground pr-4">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-3.5 -mt-1">
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact / Help block */}
        <div className="pb-8">
          <div className="casa-card p-4 space-y-2.5">
            <p className="text-[13px] font-semibold text-foreground">Есть вопросы?</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">Свяжитесь с нами — поможем разобраться.</p>
            <div className="flex items-center gap-3 pt-1">
              <a href="tel:+77075037160" className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5" />
                8 707 503 71 60
              </a>
              <a href="https://wa.me/77075037160" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-primary transition-colors">
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <button onClick={() => navigate('/sell/add')} className="casa-btn-primary">
          Добавить квартиру
        </button>
      </div>
    </div>
  );
};

export default SellLanding;
