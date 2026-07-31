"use client";

import { useState, type FormEvent } from "react";

export interface ContactInfo {
  name: string;
  phone: string;
}

interface ContactStepProps {
  onSubmit: (contact: ContactInfo) => void;
  submitting?: boolean;
}

export function ContactStep({ onSubmit, submitting = false }: ContactStepProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) return;
    onSubmit({ name, phone });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold">Оставьте контакты</h2>
      <p className="mt-2 text-ink/70">
        Мы свяжемся с вами, чтобы обсудить дальнейшие шаги.
      </p>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="name">
        Имя
      </label>
      <input
        id="name"
        type="text"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="phone">
        Телефон
      </label>
      <input
        id="phone"
        type="tel"
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 flex items-start gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1"
        />
        Согласен(а) на обработку персональных данных
      </label>

      <button
        type="submit"
        disabled={!consent || submitting}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Отправка..." : "Отправить"}
      </button>
    </form>
  );
}
