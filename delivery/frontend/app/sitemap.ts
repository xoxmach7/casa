import type { MetadataRoute } from "next";

const SITE_URL = "https://pro.casa.kz";

// Публичные маркетинговые маршруты. Кабинет (/dashboard) не индексируется.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-16");
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/zastroishchikam`, lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}
