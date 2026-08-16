import { Helmet } from "react-helmet-async";

const SITE_URL = "https://casa.kz";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

interface SeoProps {
  /** Заголовок вкладки/выдачи (без « | CASA» — добавляется автоматически). */
  title: string;
  description: string;
  /** Путь страницы для canonical, напр. "/novostroyki". */
  path?: string;
  image?: string;
  /** true → закрыть страницу от индексации (напр. служебные экраны). */
  noindex?: boolean;
}

/**
 * Пер-страничные SEO-теги для SPA (title/description/canonical/OG).
 * Статические org/website-схемы и дефолты живут в index.html.
 */
export function Seo({ title, description, path = "/", image, noindex }: SeoProps) {
  const fullTitle = title.includes("CASA") ? title : `${title} | CASA`;
  const url = `${SITE_URL}${path}`;
  // og:image должен быть абсолютным; относительные пути из бэкенда достраиваем.
  const ogImage = !image
    ? DEFAULT_IMAGE
    : image.startsWith("http")
      ? image
      : `${SITE_URL}${image.startsWith("/") ? "" : "/"}${image}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}

export default Seo;
