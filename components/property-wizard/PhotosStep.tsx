"use client";

import { useState, type FormEvent } from "react";

export interface PhotosStepValue {
  contactName: string;
  contactPhone: string;
  photoUrls: string[];
}

interface PhotosStepProps {
  onSubmit: (value: PhotosStepValue) => void;
}

export function PhotosStep({ onSubmit }: PhotosStepProps) {
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ contactName, contactPhone, photoUrls });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;
    setPhotoUrls(Array.from(files).map((f) => f.name));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold">Шаг 4 из 4</h2>

      <label className="mt-6 block text-sm text-ink/70" htmlFor="photos">
        Фотографии
      </label>
      <input
        id="photos"
        aria-label="Фотографии"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="mt-2 w-full"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="contactName">
        Имя
      </label>
      <input
        id="contactName"
        aria-label="Имя"
        required
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <label className="mt-4 block text-sm text-ink/70" htmlFor="contactPhone">
        Телефон
      </label>
      <input
        id="contactPhone"
        aria-label="Телефон"
        type="tel"
        required
        value={contactPhone}
        onChange={(e) => setContactPhone(e.target.value)}
        className="mt-2 w-full rounded-full border border-ink/10 px-4 py-3"
      />

      <button type="submit" className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark">
        Отправить
      </button>
    </form>
  );
}
