import type { MetadataRoute } from "next";

const SITE_URL = "https://pro.casa.kz";

// Индексируем только публичные маркетинговые страницы. Рабочее приложение
// (кабинет, вход, формы, короткие ссылки) закрыто от поисковиков.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/login", "/forms", "/s"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
