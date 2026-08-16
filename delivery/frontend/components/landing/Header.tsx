'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '#about', label: 'О проекте' },
  { href: '#features', label: 'Возможности' },
  { href: '#how-it-works', label: 'Как это работает' },
  { href: '#why-us', label: 'Преимущества' },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="#top" className="flex items-center gap-2 text-[#141f3a]">
          <img src="/casa-logo-navy.png" alt="CASA Pro" className="h-9 w-auto" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-[#141f3a]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-[#141f3a]">
            Войти
          </Link>
          <a
            href="#contact"
            className="rounded-full bg-[#141f3a] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1c2f56]"
          >
            Запросить доступ
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
          className="flex h-9 w-9 items-center justify-center rounded-md text-slate-700 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-6 md:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#141f3a]"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              Войти
            </Link>
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-[#141f3a] px-5 py-2.5 text-center text-sm font-semibold text-white"
            >
              Запросить доступ
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
