/**
 * CASA Pro — публичная страница ипотечного заключения по одноразовой ссылке.
 *
 * RELEASE GATE 1.0: выдача заключения клиенту ОТКЛЮЧЕНА.
 *
 * MASTER v1.2 относит клиентское заключение к релизу 1.3; текущая очередь — 1.0.
 * M06 запрещает публиковать numeric КДН и принимаемый банком доход, а вердикты
 * программ (1.1) и сценарии (1.2) в 1.0 не существуют как утверждённая
 * функциональность. Прежняя версия страницы показывала всё перечисленное —
 * поэтому она снята, а не «почищена частично».
 *
 * Токены и история заключений НЕ удалены: закрыта только выдача пользователю.
 * Предыдущая реализация целиком доступна в истории git и будет пересобрана в
 * 1.3 поверх реального calculation_snapshot, а не поверх демо-payload.
 */

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Заключение недоступно — CASA",
  robots: { index: false, follow: false },
};

export default function MortgageConclusionUnavailablePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
        </div>

        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Ипотечное заключение недоступно
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Ипотечное заключение по этой версии больше недоступно.
          Обратитесь к вашему специалисту CASA — он предоставит актуальный расчёт.
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          Ссылка остаётся действительной: ваши данные не удалены.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          На главную
        </Link>
      </section>
    </main>
  );
}
