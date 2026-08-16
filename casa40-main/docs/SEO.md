# SEO / GEO — casa40 (casa.kz)

Что уже сделано (в коде, готово к проду):

- **Мета + Open Graph** в `index.html` (title/description/keywords/canonical/robots, OG+Twitter, self-hosted `og-image.jpg`, `lang=ru`, `og:locale=ru_KZ`).
- **JSON-LD в статике** (`RealEstateAgent` + `WebSite`): `areaServed` = страна KZ + города (Астана, Алматы, Шымкент, Караганда, Актобе). Видно краулерам и AI **без выполнения JS**.
- **Пер-страничные теги** через `react-helmet-async` + `components/Seo.tsx` на `/novostroyki`, `/sell`, `/property/:id`, `/novostroyki/:id`.
- `robots.txt` (Sitemap + Host, закрыт `/admin`, разрешены AI-краулеры), `sitemap.xml`, `site.webmanifest`.

## Осталось под production (по приоритету)

1. **SSR / пререндер (главный рычаг).** Сайт — client-SPA: без JS краулер видит пустой `#root`. Google рендерит JS, но с задержкой; Яндекс/часть AI — хуже. Варианты: пререндер маркетинговых маршрутов на билде (`vite-plugin-prerender`/`react-snap`) или переезд на SSR-фреймворк. Даёт максимум к индексации листингов.
2. **Динамический sitemap.** Сейчас `sitemap.xml` статический (3 маршрута). URL объявлений (`/property/:id`, `/novostroyki/:id`) нужно генерировать на билде/по крону из БД.
3. **City-лендинги** (`/astana`, `/almaty`, …) — hub-and-spoke под запросы «квартиры в <город>». Это то, что снимает потолок одного города.
4. **Verification** в Google Search Console + Bing Webmaster + IndexNow после выката на VPS + Cloudflare.
5. **hreflang** — только если появится казахская версия (`kk`). Сейчас контент ru-only, hreflang не нужен.

## Данные для подтверждения у заказчика

- Финальные домены: `casa.kz` (публичный), `pro.casa.kz` (CRM/лендинг).
- Точный адрес офиса (для `PostalAddress.streetAddress` в схеме) — сейчас только город/страна/телефон.
- Планируется ли казахская версия сайта (влияет на hreflang).
