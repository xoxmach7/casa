"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function Hero() {
  const router = useRouter();
  const [address, setAddress] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    router.push(`/otsenka?address=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold sm:text-5xl">
        Узнайте цену вашей квартиры за пару минут
      </h1>
      <p className="mt-4 text-lg text-ink/70">
        Срочная продажа или рыночная цена — решаете вы. Мы посчитаем оба варианта.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <input
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Введите адрес квартиры"
          aria-label="Адрес квартиры"
          className="w-full max-w-md rounded-full border border-ink/10 px-6 py-4 sm:w-96"
        />
        <button
          type="submit"
          className="rounded-full bg-accent px-8 py-4 text-white transition hover:bg-accent-dark"
        >
          Оценить бесплатно
        </button>
      </form>
    </section>
  );
}
