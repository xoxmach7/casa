'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitLandingLead } from '@/lib/submit-landing-lead';
import { typo } from '@/lib/typography';

const ROLES = ['Застройщик', 'Риелтор / брокер', 'Ипотечный специалист'];

export default function ContactSection() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitLandingLead({ name, phone, role, source: 'landing' });
      setSubmitted(true);
      toast({
        title: 'Заявка отправлена',
        description: 'Мы свяжемся с вами в ближайшее время.',
      });
      setName('');
      setPhone('');
      setRole(ROLES[0]);
    } catch {
      toast({
        title: 'Не удалось отправить заявку',
        description: 'Попробуйте ещё раз чуть позже.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="contact" className="relative overflow-hidden bg-[#141f3a] py-24 sm:py-28">
      <div className="relative mx-auto max-w-xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          {typo('Запросите доступ к CASA Pro')}
        </h2>
        <p className="mt-3 text-[15px] text-slate-300">
          {typo('Оставьте контакты и команда CASA свяжется с вами')}
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
            disabled={isSubmitting}
            className="mt-2 w-full rounded-full border border-white/70 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-[#141f3a] disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-white"
          >
            {isSubmitting ? 'Отправляем…' : 'Запросить доступ'}
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
