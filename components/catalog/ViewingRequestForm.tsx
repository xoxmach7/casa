"use client";

import { useState, type FormEvent } from "react";
import { submitViewingRequest } from "@/lib/api/procasa-client";

interface ViewingRequestFormProps {
  propertyId: string;
}

export function ViewingRequestForm({ propertyId }: ViewingRequestFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submitViewingRequest({ propertyId, name, phone });
    if (ok) setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-card bg-accent-light p-4 text-ink">
        Заявка отправлена, мы свяжемся с вами для согласования времени просмотра.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Записаться на просмотр</h3>

      <label className="mt-4 block text-sm text-ink/70" htmlFor="viewing-name">
        Имя
      </label>
      <input
        id="viewing-name"
        aria-label="Имя"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="viewing-phone">
        Телефон
      </label>
      <input
        id="viewing-phone"
        aria-label="Телефон"
        type="tel"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <button
        type="submit"
        className="mt-4 w-full rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark"
      >
        Записаться на просмотр
      </button>
    </form>
  );
}
