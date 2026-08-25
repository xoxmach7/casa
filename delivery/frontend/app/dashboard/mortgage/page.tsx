"use client";

/**
 * CASA Pro Ипотека — рабочий экран по КАНОНИЧЕСКОЙ структуре (M01→M06).
 *
 * Демо-режим 1.1 (выдуманные КДН/принимаемый доход/число программ/сценарии)
 * УДАЛЁН. Экран показывает только то, что разрешено спекой релиза 1.0:
 *  - профиль клиента (M05): available_now_total из источников взноса (UNKNOWN≠0);
 *  - расчёт (M06): required_financing = max(цена − взнос, 0) и аннуитетный платёж
 *    (CALC-F-001/002), со статусом и кодами §19;
 *  - реальная загрузка документов (КИ/ЕНПФ) с распознаванием полей.
 * Банковский/регуляторный КДН (REG-F-001) НЕ считается. Ни одна цифра — не
 * банковское решение; CASA формирует предварительное заключение.
 *
 * Данные клиента/профиля — демо-моки в форме канонических ответов /api/v2/cases.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator, RotateCcw, TriangleAlert, User2, ShieldCheck, FileUp, Wrench, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/config";

// --- Канонический клиентский расчёт M06 (зеркало m06-calc.ts) ---------------

type CalcStatus = "COMPLETED" | "COMPLETED_WITH_LIMITATIONS" | "BLOCKED" | "INVALID_INPUT";
interface CalcResult { value: number | null; status: CalcStatus; codes: string[]; }

function requiredFinancing(P: number | null, A: number | null): CalcResult {
  if (P === null || A === null) return { value: null, status: "BLOCKED", codes: ["MISSING_INPUT"] };
  if (P < 0 || A < 0) return { value: null, status: "INVALID_INPUT", codes: ["NEGATIVE_AMOUNT"] };
  const codes = A >= P ? ["DOWN_PAYMENT_COVERS_TARGET"] : [];
  return { value: Math.max(P - A, 0), status: "COMPLETED", codes };
}

function annuity(P: number | null, aPct: number | null, n: number | null): CalcResult {
  if (P === null || aPct === null || n === null) return { value: null, status: "BLOCKED", codes: ["MISSING_INPUT"] };
  if (!Number.isInteger(n) || n <= 0 || n > 1200) return { value: null, status: "INVALID_INPUT", codes: ["INVALID_TERM"] };
  if (aPct < 0 || aPct > 100) return { value: null, status: "INVALID_INPUT", codes: ["INVALID_RATE"] };
  const r = aPct / 100 / 12;
  let raw: number;
  const codes: string[] = [];
  if (P === 0) raw = 0;
  else if (r === 0) { raw = P / n; codes.push("ZERO_RATE_BRANCH"); }
  else { const f = Math.pow(1 + r, n); raw = (P * r * f) / (f - 1); }
  return { value: raw, status: "COMPLETED", codes };
}

const money = (v: number | null): string =>
  v === null ? "—" : `${new Intl.NumberFormat("ru-RU").format(Math.round(v))} ₸`;

// --- Демо-моки в форме канонических ответов ---------------------------------

type FieldStatus = "VERIFIED" | "DECLARED" | "UNKNOWN";
interface MoneySource { kind: string; amount: number | null; status: FieldStatus; }

const DEMO_CASE = { id: "case-demo", clientName: "Айдос М.", status: "READY_TO_CALCULATE" as const };
const DEMO_DOWN_PAYMENT: MoneySource[] = [
  { kind: "Накопления", amount: 5_000_000, status: "VERIFIED" },
  { kind: "Продажа автомобиля", amount: 2_000_000, status: "DECLARED" },
];
const DEMO_INCOME: MoneySource[] = [
  { kind: "Зарплата (заявлено)", amount: 650_000, status: "DECLARED" },
];

/** Агрегат available_now_total: UNKNOWN/пустая сумма ≠ 0 → агрегат неполон. */
function aggregate(sources: MoneySource[]): { value: number | null; status: FieldStatus; complete: boolean } {
  let sum = 0; let sawDeclared = false; let incomplete = false;
  for (const s of sources) {
    if (s.status === "UNKNOWN" || s.amount === null) { incomplete = true; continue; }
    sum += s.amount; if (s.status === "DECLARED") sawDeclared = true;
  }
  return { value: incomplete ? null : sum, status: incomplete ? "UNKNOWN" : sawDeclared ? "DECLARED" : "VERIFIED", complete: !incomplete };
}

const STATUS_LABEL: Record<CalcStatus, string> = {
  COMPLETED: "Рассчитано",
  COMPLETED_WITH_LIMITATIONS: "Рассчитано (не подтверждено)",
  BLOCKED: "Заблокировано (нет данных)",
  INVALID_INPUT: "Некорректный ввод",
};
const FIELD_LABEL: Record<FieldStatus, string> = { VERIFIED: "подтверждено", DECLARED: "заявлено", UNKNOWN: "неизвестно" };

// --- UI-примитивы -----------------------------------------------------------

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}>{children}</section>;
}
function CardHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-5 py-4">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
function StatusPill({ status }: { status: CalcStatus }) {
  const tone = status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : status === "COMPLETED_WITH_LIMITATIONS" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{STATUS_LABEL[status]}</span>;
}

// --- Страница ---------------------------------------------------------------

const DEFAULTS = { targetPrice: 30_000_000, rate: 12.5, termMonths: 240 };

export default function MortgagePage() {
  const { toast } = useToast();
  const availableNow = useMemo(() => aggregate(DEMO_DOWN_PAYMENT), []);
  const incomeAgg = useMemo(() => aggregate(DEMO_INCOME), []);

  const [targetPrice, setTargetPrice] = useState<number>(DEFAULTS.targetPrice);
  const [rate, setRate] = useState<number>(DEFAULTS.rate);
  const [termMonths, setTermMonths] = useState<number>(DEFAULTS.termMonths);

  const rf = useMemo(() => requiredFinancing(targetPrice, availableNow.value), [targetPrice, availableNow.value]);
  const payment = useMemo(() => annuity(rf.value, rate, termMonths), [rf.value, rate, termMonths]);
  const overallStatus: CalcStatus = availableNow.complete === false ? "BLOCKED"
    : incomeAgg.status === "DECLARED" || availableNow.status === "DECLARED" ? "COMPLETED_WITH_LIMITATIONS"
    : rf.status === "BLOCKED" || payment.status === "BLOCKED" ? "BLOCKED"
    : payment.status;

  const reset = () => { setTargetPrice(DEFAULTS.targetPrice); setRate(DEFAULTS.rate); setTermMonths(DEFAULTS.termMonths); };

  // --- Реальная загрузка документов (КИ/ЕНПФ) ---
  type DocState = { fileName?: string; fields: { key: string; label: string; value: string | number; presence: string; confidence: number; critical?: boolean }[]; gates: string[]; notes: string[]; stored?: boolean; busy?: boolean };
  const [docs, setDocs] = useState<Record<"credit_history" | "enpf_statement", DocState>>({
    credit_history: { fields: [], gates: [], notes: [] },
    enpf_statement: { fields: [], gates: [], notes: [] },
  });

  const upload = useCallback(async (type: "credit_history" | "enpf_statement", file: File) => {
    setDocs((p) => ({ ...p, [type]: { ...p[type], busy: true, fileName: file.name } }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = await fetch(`${API_URL}/mortgage-workspace/documents`, { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      const fields = (Array.isArray(d.extraction?.fields) ? d.extraction.fields : []).map((f: any) => ({
        key: f.key, label: f.label,
        value: (f.normalizedValue ?? f.rawValue ?? (f.presence === "UNKNOWN" ? "нет данных" : f.presence)) as string | number,
        presence: f.presence, confidence: typeof f.confidence === "number" ? f.confidence : 0, critical: f.critical,
      }));
      setDocs((p) => ({ ...p, [type]: { fileName: file.name, fields, gates: d.extraction?.gates ?? [], notes: d.extraction?.notes ?? [], stored: !!d.stored, busy: false } }));
      toast({ title: "Документ сохранён и распознан", description: "Поля извлечены из текстового слоя PDF." });
    } catch {
      setDocs((p) => ({ ...p, [type]: { ...p[type], busy: false } }));
      toast({ title: "Не удалось загрузить", description: "Сервер недоступен или файл не PDF.", variant: "destructive" });
    }
  }, [toast]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Заголовок */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ипотечное решение клиента</h1>
          <p className="mt-1 text-sm text-muted-foreground">Профиль → расчёт → документы. Предварительно — итоговое решение принимает банк.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="mr-1.5 h-4 w-4" />Сброс</Button>
          <Button asChild variant="outline" size="sm"><Link href="/dashboard/mortgage/tools"><Wrench className="mr-1.5 h-4 w-4" />Инструменты</Link></Button>
        </div>
      </header>

      {/* Демо-баннер */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-muted-foreground">Данные клиента и профиля — демонстрационные, в форме канонических ответов <code className="rounded bg-muted px-1">/api/v2/cases</code>. Банковский КДН (REG-F-001) не рассчитывается; расчётная база дохода из ОПВ — UNKNOWN до закрытия регуляторных условий.</p>
      </div>

      {/* Кейс */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <User2 className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">{DEMO_CASE.clientName}</p>
              <p className="text-sm text-muted-foreground">Кейс {DEMO_CASE.id}</p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{DEMO_CASE.status}</span>
        </div>
      </Card>

      {/* Профиль клиента (M05) */}
      <Card>
        <CardHead icon={<ShieldCheck className="h-5 w-5" />} title="Профиль клиента (M05)" sub="Источники первоначального взноса и дохода. Пустая/неизвестная сумма не считается нулём." />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Доступно на взнос (available_now_total)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{money(availableNow.value)}</p>
            <p className="text-xs text-muted-foreground">статус: {FIELD_LABEL[availableNow.status]}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {DEMO_DOWN_PAYMENT.map((s, i) => (
                <li key={i} className="flex justify-between border-b border-border/60 pb-1">
                  <span className="text-muted-foreground">{s.kind}</span>
                  <span className="tabular-nums">{money(s.amount)} <span className="text-xs text-muted-foreground">· {FIELD_LABEL[s.status]}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Доход (заявлено)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{money(incomeAgg.value)}<span className="text-sm font-normal text-muted-foreground">/мес</span></p>
            <p className="text-xs text-muted-foreground">Не используется как banked income: подтверждение и расчётная база — за регуляторными гейтами (RG-04).</p>
          </div>
        </div>
      </Card>

      {/* Расчёт (M06) */}
      <Card>
        <CardHead icon={<Calculator className="h-5 w-5" />} title="Расчёт (M06)" sub="CALC-F-001 required_financing = max(цена − взнос, 0); CALC-F-002 аннуитетный платёж." />
        <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-muted-foreground">Целевая цена, ₸</span>
              <input type="number" value={targetPrice} min={0} step={500_000}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums" />
            </label>
            <div>
              <span className="text-sm text-muted-foreground">Ставка: <b className="text-foreground">{rate.toFixed(1)}%</b></span>
              <input type="range" min={0} max={30} step={0.5} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="mt-1 w-full" />
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Срок: <b className="text-foreground">{termMonths} мес ({Math.round(termMonths / 12)} лет)</b></span>
              <input type="range" min={12} max={360} step={12} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} className="mt-1 w-full" />
            </div>
            <p className="text-xs text-muted-foreground">Взнос берётся из профиля: {money(availableNow.value)} ({FIELD_LABEL[availableNow.status]}).</p>
          </div>

          <div className="space-y-3 rounded-lg bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Статус расчёта</span>
              <StatusPill status={overallStatus} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Требуемое финансирование</p>
              <p className="text-2xl font-bold tabular-nums">{money(rf.value)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ежемесячный платёж (аннуитет)</p>
              <p className="text-2xl font-bold tabular-nums">{money(payment.value)}</p>
            </div>
            {[...rf.codes, ...payment.codes].length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[...new Set([...rf.codes, ...payment.codes])].map((c) => (
                  <span key={c} className="rounded bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{c}</span>
                ))}
              </div>
            )}
            <p className="pt-1 text-xs text-muted-foreground">Без банковского КДН (REG-F-001 DISABLED). Не является одобрением банка.</p>
          </div>
        </div>
      </Card>

      {/* Документы (реальная загрузка) */}
      <Card>
        <CardHead icon={<FileUp className="h-5 w-5" />} title="Документы (M03/M04)" sub="Кредитная история (ПКБ) и выписка ЕНПФ. PDF ≤ 25 МБ, распознавание из текстового слоя." />
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          {(["credit_history", "enpf_statement"] as const).map((type) => {
            const doc = docs[type];
            const title = type === "credit_history" ? "Кредитная история (ПКБ)" : "Выписка ЕНПФ";
            return (
              <div key={type} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{title}</p>
                  {doc.stored && <span className="text-xs text-emerald-600 dark:text-emerald-400">сохранён на сервере</span>}
                </div>
                <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
                  <FileUp className="h-4 w-4" />
                  <span>{doc.busy ? "Загрузка…" : doc.fileName ?? "Выбрать PDF"}</span>
                  <input type="file" accept="application/pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(type, f); }} />
                </label>
                {doc.fields.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {doc.fields.slice(0, 8).map((f) => (
                      <li key={f.key} className="flex justify-between gap-2 border-b border-border/60 pb-1">
                        <span className="text-muted-foreground">{f.label}</span>
                        <span className={cn("text-right tabular-nums", (f.confidence < 0.7 || f.presence === "UNKNOWN") && "text-amber-600 dark:text-amber-400")}>
                          {String(f.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {doc.gates.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground"><TriangleAlert className="mr-1 inline h-3 w-3" />{doc.gates[0].slice(0, 90)}</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <p className="pb-4 text-center text-xs text-muted-foreground">Демонстрационный экран. Все значения предварительные; окончательное решение принимает банк.</p>
    </div>
  );
}
