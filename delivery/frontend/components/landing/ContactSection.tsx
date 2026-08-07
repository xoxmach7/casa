'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '@/hooks/use-toast';

const ROLES = ['Застройщик', 'Риелтор / брокер', 'Ипотечный специалист'];

export default function ContactSection() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [submitted, setSubmitted] = useState(false);

  // Note: this is not yet wired to a backend — submitting just confirms the
  // request client-side. Needs a real destination (email/CRM lead) before
  // this can be trusted to actually reach anyone.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setSubmitted(true);
    toast({
      title: 'Заявка отправлена',
      description: 'Мы свяжемся с вами в ближайшее время.',
    });
    setName('');
    setPhone('');
    setRole(ROLES[0]);
  }

  return (
    <section id="contact" className="relative overflow-hidden bg-[#141f3a] py-24 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full border border-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 h-[280px] w-[280px] rounded-full border border-white/10"
      />

      <div className="relative mx-auto max-w-xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Запросите доступ к CASA Pro</h2>
        <p className="mt-3 text-[15px] text-slate-300">
          Оставьте контакты и команда CASA свяжется с вами
        </p>

        <form onSubmit={handleSubmit} className="mt-9 space-y-3 text-left">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              required
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-full border border-white/20 bg-white/5 px-4 text-sm text-white placeholder:text-slate-400 outline-none focus:border-white/50"
            />
            <input
              type="tel"
              required
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-full border border-white/20 bg-white/5 px-4 text-sm text-white placeholder:text-slate-400 outline-none focus:border-white/50"
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 w-full rounded-full border border-white/20 bg-white/5 px-4 text-sm text-white outline-none focus:border-white/50 [&>option]:text-slate-900"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="mt-2 w-full rounded-full border border-white/70 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-[#14213d]"
          >
            Запросить доступ
          </button>

          {submitted && (
            <p className="pt-1 text-center text-xs text-slate-400">
              Спасибо! Мы свяжемся с вами в ближайшее время.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
