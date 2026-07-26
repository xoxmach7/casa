import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Casa — оценка и продажа квартиры",
  description: "Узнайте срочную и рыночную цену вашей квартиры за пару минут",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} font-sans bg-surface text-ink`}>
        {children}
      </body>
    </html>
  );
}
