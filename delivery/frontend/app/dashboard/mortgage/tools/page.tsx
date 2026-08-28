"use client";

/**
 * Инструменты брокера — ипотечный калькулятор и стоимость обслуживания по
 * программам банков.
 *
 * Пересобрано на движке M06 вместо прежней версии, которая считала аннуитет в
 * браузере через Math.pow и показывала вердикты программ и балл «вероятности
 * одобрения». Привычный брокеру ввод сохранён: цена, взнос, ставка, срок.
 * Изменился источник числа — теперь считает сервер утверждёнными формулами
 * CALC-F-001/002 в decimal-контексте precision=50.
 *
 * Чего здесь намеренно нет:
 *  - КДН и принимаемого банком дохода (REG-F-001 отключён, нормативные входы
 *    для релиза 1.0 не определены);
 *  - вердиктов «подходит / не подходит» и отбора программ — это Bank Rules,
 *    релиз 1.1, и решение принимает банк, а не CASA;
 *  - балла и «вероятности одобрения» — M06 §17 прямо запрещает отдавать
 *    CASA Score или банковский вердикт как факт.
 *
 * Расчёт здесь — прикидка. Он не создаёт артефакта кейса и не является
 * доказательством: для этого есть расчёт на экране ипотечного кейса.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator, Building2, TriangleAlert, Info, ArrowLeft, Percent, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MortgageCaseApiError } from "@/lib/mortgage/case-api";
import {
  getQuote, getProgramQuotes,
  type Quote, type ProgramQuote, type FormulaView,
} from "@/lib/mortgage/calc-tools-api";

/** Показ денежной строки сервера. Форматирование разрядов — не математика. */
function showMoney(value: string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const [whole, fraction] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}${fraction ? `,${fraction}` : ""} ₸`;
}

const STATUS_TEXT: Record<FormulaView["status"], string> = {
  COMPLETED: "",
  COMPLETED_WITH_LIMITATIONS: "Входы не подтверждены",
  BLOCKED: "Недостаточно данных",
  INVALID_INPUT: "Некорректный ввод",
};

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}>
      {children}
    </section>
  );
}

function NumberField({ label, value, onChange, suffix, step }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string; step?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
        />
        {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

export default function MortgageToolsPage() {
  const [price, setPrice] = useState("30000000");
  const [downPayment, setDownPayment] = useState("5000000");
  const [rate, setRate] = useState("12.5");
  const [termMonths, setTermMonths] = useState(240);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [programs, setPrograms] = useState<ProgramQuote[] | null>(null);
  const [programsDisclaimer, setProgramsDisclaimer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Доля взноса — презентация введённых чисел, не финансовая формула. */
  const downPaymentShare = useMemo(() => {
    const p = Number(price.replace(/\s/g, ""));
    const d = Number(downPayment.replace(/\s/g, ""));
    if (!Number.isFinite(p) || !Number.isFinite(d) || p <= 0) return null;
    return Math.round((d / p) * 100);
  }, [price, downPayment]);

  const calculate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [q, pq] = await Promise.all([
        getQuote({
          target_price: price.replace(/\s/g, ""),
          available_now_down_payment: downPayment.replace(/\s/g, "") || undefined,
          annual_nominal_rate_percent: rate.replace(/\s/g, ""),
          term_months: termMonths,
        }),
        getProgramQuotes({
          target_price: price.replace(/\s/g, ""),
          available_now_down_payment: downPayment.replace(/\s/g, "") || undefined,
          term_months: termMonths,
        }).catch(() => null),
      ]);
      setQuote(q);
      if (pq) { setPrograms(pq.quotes); setProgramsDisclaimer(pq.disclaimer); }
    } catch (e) {
      // Никакого локального пересчёта: ошибка остаётся ошибкой.
      setQuote(null);
      setPrograms(null);
      setError(e instanceof MortgageCaseApiError ? e.message : "Расчёт временно недоступен");
    } finally {
      setBusy(false);
    }
  }, [price, downPayment, rate, termMonths]);

  // Первый расчёт при открытии, чтобы экран не был пустым.
  useEffect(() => { void calculate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ипотечный калькулятор</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Предварительный расчёт по параметрам. Считает сервер по утверждённым формулам.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/mortgage"><ArrowLeft className="mr-1.5 h-4 w-4" />К кейсам</Link>
        </Button>
      </header>

      <Card>
        <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
          <div className="space-y-4">
            <NumberField label="Стоимость жилья" value={price} onChange={setPrice} suffix="₸" />
            <div>
              <NumberField label="Первоначальный взнос" value={downPayment} onChange={setDownPayment} suffix="₸" />
              {downPaymentShare !== null && (
                <p className="mt-1 text-xs text-muted-foreground">{downPaymentShare}% от стоимости</p>
              )}
            </div>
            <NumberField label="Ставка, годовых" value={rate} onChange={setRate} suffix="%" />
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Срок</span>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="range"
                  min={12}
                  max={360}
                  step={12}
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  className="w-full"
                  aria-label="Срок в месяцах"
                />
                <span className="shrink-0 text-sm tabular-nums">
                  {termMonths} мес
                </span>
              </div>
            </div>
            <Button onClick={() => void calculate()} disabled={busy} className="w-full">
              <Calculator className="mr-1.5 h-4 w-4" />
              {busy ? "Считаем…" : "Рассчитать"}
            </Button>
          </div>

          <div className="space-y-3 rounded-lg bg-muted/40 p-4">
            {error && (
              <div className="flex items-start gap-2 text-sm">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                <div>
                  <p className="font-medium text-rose-600 dark:text-rose-400">{error}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Приблизительный расчёт на устройстве не выполняется.
                  </p>
                </div>
              </div>
            )}

            {quote && (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Ежемесячный платёж</p>
                  <p className="text-3xl font-bold tabular-nums">
                    {showMoney(quote.annuity_payment.value)}
                  </p>
                  {STATUS_TEXT[quote.annuity_payment.status] && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {STATUS_TEXT[quote.annuity_payment.status]}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Сумма кредита</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {showMoney(quote.required_financing.value)}
                  </p>
                </div>

                <p className="pt-1 text-[11px] text-muted-foreground">
                  {quote.note}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {quote.annuity_payment.machine_name}/{quote.annuity_payment.formula_version} ·{" "}
                  {quote.engine_version}
                </p>
              </>
            )}
          </div>
        </div>
      </Card>

      {programs && programs.length > 0 && (
        <Card>
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <Building2 className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
            <div>
              <h2 className="text-base font-semibold leading-tight">Программы банков</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Платёж по ставке каждой программы, посчитанный тем же движком.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Банк и программа</th>
                  <th className="px-3 py-2 font-medium"><Percent className="inline h-3.5 w-3.5" /> Ставка</th>
                  <th className="px-3 py-2 font-medium"><Clock className="inline h-3.5 w-3.5" /> Срок</th>
                  <th className="px-3 py-2 font-medium">Мин. взнос</th>
                  <th className="px-5 py-2 text-right font-medium">Платёж в месяц</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((q) => (
                  <tr key={q.program.id} className="border-b border-border/60">
                    <td className="px-5 py-2.5">
                      <p className="font-medium">{q.program.bank_name}</p>
                      <p className="text-xs text-muted-foreground">{q.program.program_name}</p>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{q.program.interest_rate}%</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {q.term_months_used} мес
                      {q.term_capped_by_program && (
                        <span className="block text-[11px] text-muted-foreground">
                          ограничен программой
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{q.program.min_down_payment_percent}%</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                      {showMoney(q.annuity_payment.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            {programsDisclaimer}
          </p>
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">
          Это предварительный расчёт по введённым параметрам. Он не создаёт записи в
          ипотечном кейсе и не является доказательством — для этого откройте кейс клиента.
          Долговая нагрузка, принимаемый банком доход и соответствие требованиям программ
          здесь не оцениваются: это определяет банк.
        </p>
      </div>
    </div>
  );
}
