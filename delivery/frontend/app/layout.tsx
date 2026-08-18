// NB: Railway crm-сервис деплоит по watch-paths, завязанным на app/**. Правки
// только в components/** авто-деплой пропускает (SKIPPED). Если меняете лишь
// компоненты — троньте любой файл под app/, иначе прод не обновится.
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ReactQueryProvider } from "@/components/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

const SITE_URL = "https://pro.casa.kz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CASA Pro — CRM для риелторов и застройщиков Казахстана",
    template: "%s | CASA Pro",
  },
  description:
    "CASA Pro — CRM для агентств недвижимости и застройщиков по всему Казахстану. Клиенты, сделки, новостройки, шахматки квартир и ипотека в одной системе. Астана, Алматы, Шымкент.",
  applicationName: "CASA Pro",
  keywords: [
    "CRM недвижимость",
    "CRM для риелторов",
    "CRM для застройщиков",
    "недвижимость Казахстан",
    "автоматизация агентства недвижимости",
    "шахматка новостройки",
    "учёт сделок недвижимость",
    "Астана",
    "Алматы",
  ],
  authors: [{ name: "CASA" }],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    siteName: "CASA Pro",
    locale: "ru_KZ",
    url: SITE_URL,
    title: "CASA Pro — CRM для риелторов и застройщиков Казахстана",
    description:
      "Клиенты, сделки, новостройки, шахматки квартир и ипотека в одной системе. Для агентств и застройщиков по всему Казахстану.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "CASA Pro — CRM для недвижимости" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CASA Pro — CRM для риелторов и застройщиков Казахстана",
    description:
      "Клиенты, сделки, новостройки, шахматки квартир и ипотека в одной системе. Для агентств и застройщиков Казахстана.",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#15325B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          {children}
          <Toaster />
          {/* Sonner был нигде не смонтирован — десятки страниц звали toast из
              'sonner' вхолостую. Монтируем один раз здесь. */}
          <SonnerToaster richColors position="top-right" />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
