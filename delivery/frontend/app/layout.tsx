import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Casa Pro - CRM для недвижимости",
  description: "Управление клиентами, проектами и продажами недвижимости",
  icons: {
    icon: "/2.png",
  },
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
