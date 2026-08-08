'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitLandingLead } from '@/lib/submit-landing-lead';

const ROLES = ['Застройщик', 'Риелтор / брокер', 'Ипотечный специалист'];

export default function GptContactSection() {
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
      await submitLandingLead({ name, phone, role, source: 'gpt-taste' });
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
    <section id="contact" className="border-t border-neutral-200 bg-neutral-950 py-24 sm:py-32">
      <div className="mx-auto max-w-lg px-5 text-center sm:px-8">
        <h2 className="text-2xl font-medium tracking-tight text-white sm:text-3xl">Запросите доступ к CASA Pro</h2>
        <p className="mt-3 text-[15px] text-neutral-400">Оставьте контакты и команда CASA свяжется с вами</p>

        <form onSubmit={handleSubmit} className="mt-9 space-y-3 text-left">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              required
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-full border border-neutral-700 bg-transparent px-4 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white"
            />
            <input
              type="tel"
              required
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-full border border-neutral-700 bg-transparent px-4 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white"
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 w-full rounded-full border border-neutral-700 bg-transparent px-4 text-sm text-white outline-none focus:border-white [&>option]:text-neutral-900"
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
            className="mt-2 w-full rounded-full bg-white py-3.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-50"
          >
            {isSubmitting ? 'Отправляем…' : 'Запросить доступ'}
          </button>

          {submitted && (
            <p className="pt-1 text-center text-xs text-neutral-500">
              Спасибо! Мы свяжемся с вами в ближайшее время.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
