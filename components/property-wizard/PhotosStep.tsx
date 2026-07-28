"use client";

import { useState, type FormEvent } from "react";
import { uploadPhotos } from "@/lib/api/procasa-client";

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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ contactName, contactPhone, photoUrls });
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(false);
    const urls = await uploadPhotos(Array.from(files));
    setUploading(false);

    if (urls.length === 0) {
      setUploadError(true);
      return;
    }

    setPhotoUrls(urls);
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
      {uploading && <p className="mt-2 text-sm text-ink/60">Загрузка фото…</p>}
      {uploadError && (
        <p className="mt-2 text-sm text-red-700">
          Не удалось загрузить фото. Можно отправить заявку без них или попробовать ещё раз.
        </p>
      )}
      {!uploading && !uploadError && photoUrls.length > 0 && (
        <p className="mt-2 text-sm text-ink/60">Загружено фото: {photoUrls.length}</p>
      )}

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

      <button
        type="submit"
        disabled={uploading}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        Отправить
      </button>
    </form>
  );
}
