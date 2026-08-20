"use client";

/**
 * CASA Pro Ипотека — публичная печатная страница клиентского заключения (AC-014).
 * Открывается по одноразовой защищённой ссылке (без авторизации). Мобильная.
 *
 * Показывает клиенту: параметры расчёта, рекомендованный шаг, доступные программы,
 * подходящие квартиры, плюсы, ограничения и следующие шаги.
 * НЕ показывает ИИН, документы и внутренние заметки — их нет в публичном payload.
 *
 * Если заключение не удалось загрузить — рендерится встроенный demo-payload
 * (с заметным бейджем «демо»), чтобы страница всегда что-то показывала.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Printer,
  Check,
  AlertTriangle,
  ShieldCheck,
  Building2,
  ArrowRight,
  Home,
} from "lucide-react";
import { API_URL } from "@/lib/config";

// ─── Типы публичного payload ────────────────────────────────────────────────

type Delta = { label: string; before: number | string; after: number | string };

type SelectedScenario = {
  title: string;
  summary: string;
  deltas: Delta[];
  monthlySaving?: number;
  cashRequired?: number;
} | null;

type ProgramVerdict =
  | "eligible_by_known_rules"
  | "potentially_eligible"
  | "not_eligible"
  | "insufficient_data"
  | "manual_bank_confirmation_required";

type Program = {
  programName: string;
  bank: string;
  rate: number;
  verdict: ProgramVerdict | string;
  note: string;
};

type PropertyFit =
  | "fits_now"
  | "fits_after_selected_scenario"
  | "does_not_fit"
  | string;

type PropertyItem = {
  developmentName: string;
  address: string;
  rooms: number;
  area: number;
  price: number;
  monthlyPayment: number;
  fit: PropertyFit;
};

type Conclusion = {
  token: string;
  version: number | string;
  createdAt: string;
  expiresAt: string;
  demo: boolean;
  client: { displayName: string };
  summary: {
    propertyPrice: number;
    downPayment: number;
    loanAmount: number;
    monthlyPayment: number;
    kdn: number;
    rate: number;
    termMonths: number;
    acceptedIncome: number;
  };
  selectedScenario: SelectedScenario;
  programs: Program[];
  properties: PropertyItem[];
  pros: string[];
  limitations: string[];
  nextSteps: string[];
};

// ─── Встроенный demo-payload (fallback) ─────────────────────────────────────

function buildDemoPayload(token: string): Conclusion {
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    token: token || "demo",
    version: 1,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    demo: true,
    client: { displayName: "Айгерим К." },
    summary: {
      propertyPrice: 35_000_000,
      downPayment: 7_000_000,
      loanAmount: 28_000_000,
      monthlyPayment: 245_000,
      kdn: 38,
      rate: 18.5,
      termMonths: 240,
      acceptedIncome: 650_000,
    },
    selectedScenario: {
      title: "Увеличить первоначальный взнос на 1 500 000 ₸",
      summary:
        "С увеличенным взносом снижается сумма кредита, ежемесячный платёж и КДН — расчёт проходит по нескольким банкам.",
      deltas: [
        { label: "Первоначальный взнос", before: "7 000 000 ₸", after: "8 500 000 ₸" },
        { label: "Сумма кредита", before: "28 000 000 ₸", after: "26 500 000 ₸" },
        { label: "Ежемесячный платёж", before: "245 000 ₸", after: "232 000 ₸" },
        { label: "КДН", before: "38%", after: "35%" },
      ],
      monthlySaving: 13_000,
      cashRequired: 1_500_000,
    },
    programs: [
      {
        programName: "Стандартная ипотека",
        bank: "Halyk Bank",
        rate: 18.5,
        verdict: "eligible_by_known_rules",
        note: "По известным правилам расчёт проходит: КДН и доход в пределах требований.",
      },
      {
        programName: "7-20-25",
        bank: "Отбасы банк",
        rate: 7.0,
        verdict: "potentially_eligible",
        note: "Возможно подойдёт при отсутствии другого жилья в собственности — требуется проверка.",
      },
      {
        programName: "Наурыз",
        bank: "Государственная программа",
        rate: 9.0,
        verdict: "manual_bank_confirmation_required",
        note: "Требуется ручное подтверждение банком по условиям программы.",
      },
      {
        programName: "Льготная (многодетные)",
        bank: "Отбасы банк",
        rate: 5.0,
        verdict: "not_eligible",
        note: "Не проходит по формальным критериям программы.",
      },
    ],
    properties: [
      {
        developmentName: "ЖК «Асыл Арман»",
        address: "г. Алматы, ул. Розыбакиева, 320",
        rooms: 2,
        area: 62,
        price: 34_500_000,
        monthlyPayment: 241_000,
        fit: "fits_now",
      },
      {
        developmentName: "ЖК «Green Park»",
        address: "г. Алматы, пр. Аль-Фараби, 15",
        rooms: 2,
        area: 58,
        price: 33_000_000,
        monthlyPayment: 231_000,
        fit: "fits_after_selected_scenario",
      },
      {
        developmentName: "ЖК «Комфорт Сити»",
        address: "г. Алматы, ул. Сатпаева, 90",
        rooms: 3,
        area: 78,
        price: 41_000_000,
        monthlyPayment: 287_000,
        fit: "does_not_fit",
      },
    ],
    pros: [
      "Стабильный подтверждённый доход выше требуемого минимума",
      "КДН в пределах нормы по нескольким банкам",
      "Достаточный первоначальный взнос для стандартной программы",
    ],
    limitations: [
      "Часть льготных программ требует отсутствия жилья в собственности",
      "Итоговая ставка зависит от решения конкретного банка",
    ],
    nextSteps: [
      "Согласовать выбранный вариант со специалистом CASA",
      "Подготовить документы для подачи заявки в банк",
      "Записаться на просмотр подходящих квартир",
    ],
  };
}

// ─── Справочники подписей ───────────────────────────────────────────────────

const VERDICT_LABEL: Record<string, string> = {
  eligible_by_known_rules: "Проходит по известным правилам",
  potentially_eligible: "Возможно подходит",
  not_eligible: "Не проходит",
  insufficient_data: "Недостаточно данных",
  manual_bank_confirmation_required: "Требуется подтверждение банка",
};

// Цветовая схема плашки вердикта: [фон, рамка, текст]
const VERDICT_TONE: Record<string, string> = {
  eligible_by_known_rules: "bg-emerald-50 border-emerald-200 text-emerald-700",
  potentially_eligible: "bg-amber-50 border-amber-200 text-amber-700",
  not_eligible: "bg-red-50 border-red-200 text-red-700",
  insufficient_data: "bg-slate-100 border-slate-200 text-slate-600",
  manual_bank_confirmation_required: "bg-blue-50 border-blue-200 text-blue-700",
};

const FIT_LABEL: Record<string, string> = {
  fits_now: "Подходит сейчас",
  fits_after_selected_scenario: "Подойдёт после рекомендованного шага",
  does_not_fit: "Не подходит",
};

const FIT_TONE: Record<string, string> = {
  fits_now: "bg-emerald-50 text-emerald-700",
  fits_after_selected_scenario: "bg-amber-50 text-amber-700",
  does_not_fit: "bg-red-50 text-red-700",
};

// ─── Форматирование ─────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat("ru-RU");

function tenge(value: number): string {
  return `${nf.format(value)} ₸`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Страница ────────────────────────────────────────────────────────────────

export default function MortgageConclusionPage() {
  const params = useParams();
  const token = String(params?.token ?? "");

  const [data, setData] = useState<Conclusion | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_URL}/public/mortgage/conclusion/${token}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Conclusion;
        if (cancelled) return;
        setData(json);
        setIsDemo(Boolean(json?.demo));
      } catch {
        // Любая ошибка сети/статуса → показываем встроенный demo-payload.
        if (cancelled) return;
        setData(buildDemoPayload(token));
        setIsDemo(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading || !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Загрузка заключения…</p>
      </main>
    );
  }

  const s = data.summary;

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-800 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-[800px]">
        {/* Панель действий (скрывается при печати) */}
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          {isDemo ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" /> Демо-режим
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#15325B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#15325B]/90"
          >
            <Printer className="h-4 w-4" /> Печать / Сохранить PDF
          </button>
        </div>

        {/* Карточка заключения */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
          {/* Шапка */}
          <div className="flex items-start gap-3 bg-[#15325B] px-6 py-5 text-white">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">
              C
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">CASA Pro</p>
              <p className="text-sm text-white/80">Предварительное ипотечное заключение</p>
            </div>
            <ShieldCheck className="ml-auto mt-0.5 h-5 w-5 shrink-0 text-white/60" />
          </div>

          <div className="space-y-6 p-6">
            {/* Клиент и даты */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Клиент</p>
                <p className="text-lg font-semibold text-slate-800">{data.client.displayName}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Дата составления: {formatDate(data.createdAt)}</p>
                <p>Ссылка действует до: {formatDate(data.expiresAt)}</p>
              </div>
            </div>

            {/* Дисклеймер */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Предварительное заключение CASA. Окончательное решение принимает банк.
            </div>

            {/* Демо-плашка внутри печатной области */}
            {isDemo && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Демонстрационные данные. Это пример оформления заключения — цифры и программы носят
                  иллюстративный характер.
                </span>
              </div>
            )}

            {/* Блок «Параметры» */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Параметры расчёта
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Param label="Стоимость жилья" value={tenge(s.propertyPrice)} />
                <Param label="Первоначальный взнос" value={tenge(s.downPayment)} />
                <Param label="Сумма кредита" value={tenge(s.loanAmount)} />
                <Param label="Ежемесячный платёж" value={tenge(s.monthlyPayment)} />
                <Param label="Ставка" value={`${s.rate}%`} />
                <Param label="Срок" value={`${s.termMonths} мес.`} />
                <Param label="КДН" value={`${s.kdn}%`} />
                <Param label="Принимаемый доход" value={tenge(s.acceptedIncome)} />
              </div>
            </section>

            {/* Блок «Рекомендованный шаг» */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Рекомендованный шаг
              </h2>
              {data.selectedScenario ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-800">{data.selectedScenario.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{data.selectedScenario.summary}</p>

                  {data.selectedScenario.deltas.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {data.selectedScenario.deltas.map((d) => (
                        <div
                          key={d.label}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <span className="w-full text-slate-500 sm:w-48">{d.label}</span>
                          <span className="text-slate-400 line-through">{d.before}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold text-[#15325B]">{d.after}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(data.selectedScenario.monthlySaving != null ||
                    data.selectedScenario.cashRequired != null) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.selectedScenario.monthlySaving != null && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          Экономия: {tenge(data.selectedScenario.monthlySaving)} / мес.
                        </span>
                      )}
                      {data.selectedScenario.cashRequired != null && (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                          Потребуется внести: {tenge(data.selectedScenario.cashRequired)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Текущий вариант принят — дополнительных изменений не требуется.
                </div>
              )}
            </section>

            {/* Блок «Программы» */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Ипотечные программы
              </h2>
              <div className="space-y-2">
                {data.programs.map((p, i) => {
                  const tone =
                    VERDICT_TONE[p.verdict] ?? "bg-slate-100 border-slate-200 text-slate-600";
                  const label = VERDICT_LABEL[p.verdict] ?? "Требует уточнения";
                  return (
                    <div
                      key={`${p.programName}-${i}`}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">{p.programName}</p>
                          <p className="text-sm text-slate-500">
                            {p.bank} · ставка {p.rate}%
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${tone}`}
                        >
                          {label}
                        </span>
                      </div>
                      {p.note && <p className="mt-2 text-sm text-slate-600">{p.note}</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Блок «Подходящие квартиры» */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Подходящие квартиры
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.properties.map((pr, i) => {
                  const fitTone = FIT_TONE[pr.fit] ?? "bg-slate-100 text-slate-600";
                  const fitLabel = FIT_LABEL[pr.fit] ?? "Требует уточнения";
                  return (
                    <div
                      key={`${pr.developmentName}-${i}`}
                      className="flex flex-col rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start gap-2">
                        <Home className="mt-0.5 h-4 w-4 shrink-0 text-[#15325B]" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">{pr.developmentName}</p>
                          <p className="text-xs text-slate-500">{pr.address}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        <span className="text-slate-500">Комнат</span>
                        <span className="text-right font-medium text-slate-700">{pr.rooms}</span>
                        <span className="text-slate-500">Площадь</span>
                        <span className="text-right font-medium text-slate-700">{pr.area} м²</span>
                        <span className="text-slate-500">Цена</span>
                        <span className="text-right font-medium text-slate-700">{tenge(pr.price)}</span>
                        <span className="text-slate-500">Платёж</span>
                        <span className="text-right font-medium text-slate-700">
                          {tenge(pr.monthlyPayment)}
                        </span>
                      </div>
                      <span
                        className={`mt-3 inline-block self-start rounded-full px-3 py-1 text-xs font-medium ${fitTone}`}
                      >
                        {fitLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Плюсы / Ограничения / Следующие шаги */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Плюсы */}
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Плюсы
                </h2>
                <ul className="space-y-2">
                  {data.pros.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Ограничения */}
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Ограничения
                </h2>
                <ul className="space-y-2">
                  {data.limitations.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Следующие шаги */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Следующие шаги
              </h2>
              <ol className="space-y-2">
                {data.nextSteps.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#15325B] text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Подвал */}
            <div className="border-t border-slate-100 pt-4 text-center text-[11px] leading-relaxed text-slate-400">
              <p className="flex items-center justify-center gap-1">
                <Building2 className="h-3 w-3" /> CASA Pro · версия заключения {data.version}
              </p>
              <p className="mt-1">
                Ссылка защищена, действует ограниченное время, без индексации поисковиками.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Вспомогательная ячейка параметра ────────────────────────────────────────

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-800">{value}</p>
    </div>
  );
}
