"use client";

/**
 * CASA Pro Ипотека — рабочий экран релиза 1.0 (M01→M06).
 *
 * ЖЁСТКИЕ ПРАВИЛА ЭТОГО ЭКРАНА (M06 Production Spec v1.4 §18/§21/§29):
 *
 *  1. Фронт НЕ является calculation engine. Здесь нет и не должно появиться ни
 *     одной ипотечной формулы, ни Math.pow, ни Math.round как источника числа.
 *     Все величины приходят из POST /api/v2/cases/{id}/calculation-runs и
 *     показываются ровно так, как их вернул движок (display-строка).
 *  2. Без выбранного РЕАЛЬНОГО кейса не показывается ни одной финансовой цифры.
 *     Никаких DEMO_CASE / DEMO_INCOME / DEMO_DOWN_PAYMENT.
 *  3. Если бэкенд расчёта недоступен — «Расчёт временно недоступен».
 *     Fallback-число не вычисляется никогда.
 *  4. Запрещено к показу в 1.0: numeric КДН, принимаемый банком доход, список
 *     и вердикты программ, сценарии, подбор квартир, вероятность одобрения.
 *
 * Ни одна цифра не является решением банка: CASA формирует предварительный
 * расчёт по утверждённым формулам CALC-F-001/002.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calculator, User2, ShieldCheck, Wrench, Info, TriangleAlert, RefreshCw, FolderOpen,
  Plus, ArrowRight, FileText, Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  listMortgageCases,
  getClientProfile,
  getMortgageCase,
  setPurchaseGoal,
  addDownPaymentSource,
  publishProfileSnapshot,
  createCalculationRun,
  MortgageCaseApiError,
  type MortgageCase,
  type MortgageCaseListItem,
  type ClientProfile,
  type CalculationSnapshot,
  type CalcStatus,
} from "@/lib/mortgage/case-api";
import { SourceCheckSection } from "@/components/mortgage/SourceCheckSection";
import { DocumentIntakeSection } from "@/components/mortgage/DocumentIntakeSection";

// --- Ярлыки -----------------------------------------------------------------

const STATUS_LABEL: Record<CalcStatus, string> = {
  COMPLETED: "Рассчитано",
  COMPLETED_WITH_LIMITATIONS: "Рассчитано (входы не подтверждены)",
  BLOCKED: "Заблокировано (нет данных)",
  INVALID_INPUT: "Некорректный ввод",
};

const FIELD_LABEL: Record<string, string> = {
  CONFIRMED: "подтверждено",
  VERIFIED: "подтверждено",
  DECLARED: "заявлено",
  UNKNOWN: "неизвестно",
  CONFLICT: "конфликт",
  MISSING: "не заполнено",
};

/**
 * Показ денежной строки, пришедшей с сервера. Форматирование разрядов —
 * презентация, не математика: значение НЕ пересчитывается, дробная часть не
 * округляется на клиенте. null остаётся «—», а не нулём.
 */
function showMoney(serverValue: string | null | undefined): string {
  if (serverValue === null || serverValue === undefined) return "—";
  const [whole, fraction] = serverValue.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}${fraction ? `,${fraction}` : ""} ₸`;
}

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

// --- Пустое состояние -------------------------------------------------------

const CASE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Черновик",
  CONSENT_PENDING: "Ждёт согласия",
  DOCUMENTS_PENDING: "Ждёт документы",
  PROCESSING: "В обработке",
  REVIEW_REQUIRED: "Нужна проверка",
  READY_TO_CALCULATE: "Готов к расчёту",
  ACTIVE: "В работе",
  CONSENT_REVOKED: "Согласие отозвано",
  CANCELLED: "Отменён",
  ARCHIVED: "В архиве",
};

function CaseStatusBadge({ status }: { status: string }) {
  const tone = status === "ACTIVE" || status === "READY_TO_CALCULATE"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    : status === "CONSENT_REVOKED" || status === "CANCELLED"
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
      : status === "REVIEW_REQUIRED"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>
      {CASE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Три шага работы — чтобы экран без выбранного кейса не выглядел пустым. */
function HowItWorks() {
  const steps = [
    { n: 1, icon: <User2 className="h-4 w-4" />, title: "Выберите клиента", text: "Откройте расчёт по клиенту из списка или заведите новый — согласие фиксируется на этом шаге." },
    { n: 2, icon: <FileText className="h-4 w-4" />, title: "Загрузите документы", text: "Кредитная история (ПКБ) и выписка ЕНПФ в PDF. Система распознаёт поля — вы их проверяете." },
    { n: 3, icon: <Calculator className="h-4 w-4" />, title: "Получите расчёт", text: "Сумма кредита и ежемесячный платёж по подтверждённым данным." },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((s) => (
        <div key={s.n} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">{s.n}</span>
            {s.icon}
          </div>
          <p className="mt-2 font-medium leading-tight">{s.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
        </div>
      ))}
    </div>
  );
}

function NoCaseSelected({ cases, loading, onPick }: {
  cases: MortgageCaseListItem[]; loading: boolean; onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          icon={<FolderOpen className="h-5 w-5" />}
          title="Расчёты по клиентам"
          sub="Выберите клиента, чтобы продолжить, или начните новый расчёт. Суммы появятся после выбора клиента."
        />

        {loading && (
          <div className="space-y-2 px-5 py-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        )}

        {!loading && cases.length === 0 && (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 font-medium">Пока нет ни одного расчёта</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Расчёт заводится на клиента: в нём хранятся его документы, проверки и итоговые суммы.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/clients">
                <Plus className="mr-1.5 h-4 w-4" />Выбрать клиента
              </Link>
            </Button>
          </div>
        )}

        {!loading && cases.length > 0 && (
          <ul className="divide-y divide-border">
            {cases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      {/* Брокеру нужно имя своего клиента: идентификатор кейса
                          ему ничего не говорит. ИИН/телефон здесь не выводим. */}
                      <p className="truncate font-medium">{c.client_name ?? "Клиент не указан"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        обновлён {new Date(c.updated_at ?? c.created_at ?? Date.now()).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <CaseStatusBadge status={c.status} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <HowItWorks />
    </div>
  );
}

// --- Страница ---------------------------------------------------------------

function MortgageWorkspace() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseId = searchParams.get("case");

  const [cases, setCases] = useState<MortgageCaseListItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [mortgageCase, setMortgageCase] = useState<MortgageCase | null>(null);

  // Параметры расчёта — это параметры прогона (§21), а не данные профиля.
  const [ratePercent, setRatePercent] = useState("12.5");
  const [termMonths, setTermMonths] = useState(240);

  const [calc, setCalc] = useState<CalculationSnapshot | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);

  // --- Загрузка списка кейсов ---
  useEffect(() => {
    let alive = true;
    listMortgageCases()
      .then((page) => { if (alive) setCases(page?.items ?? []); })
      .catch(() => { if (alive) setCases([]); })
      .finally(() => { if (alive) setCasesLoading(false); });
    return () => { alive = false; };
  }, []);

  // --- Загрузка профиля выбранного кейса ---
  const loadProfile = useCallback(async (id: string) => {
    setProfileError(null);
    try {
      // Кейс нужен ради участника: проверки M02 привязаны к participant,
      // а не к кейсу целиком.
      const [loadedProfile, loadedCase] = await Promise.all([
        getClientProfile(id),
        getMortgageCase(id).catch(() => null),
      ]);
      setProfile(loadedProfile);
      setMortgageCase(loadedCase);
    } catch (e) {
      setProfile(null);
      setProfileError(e instanceof MortgageCaseApiError ? e.message : "Не удалось загрузить профиль");
    }
  }, []);

  useEffect(() => {
    if (!caseId) { setProfile(null); setMortgageCase(null); setCalc(null); return; }
    setCalc(null);
    setCalcError(null);
    void loadProfile(caseId);
  }, [caseId, loadProfile]);

  const pickCase = (id: string) => router.push(`/dashboard/mortgage?case=${encodeURIComponent(id)}`);

  // --- Действия профиля (M05) ---
  const saveGoal = async (raw: string) => {
    if (!caseId) return;
    const trimmed = raw.trim();
    try {
      await setPurchaseGoal(caseId, {
        target_price_max: trimmed === "" ? null : trimmed,
        status: "DECLARED",
      });
      await loadProfile(caseId);
      setCalc(null); // прежний расчёт больше не относится к текущему профилю
    } catch (e) {
      toast({
        title: "Не удалось сохранить цель покупки",
        description: e instanceof MortgageCaseApiError ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const addSource = async (kind: string, amount: string) => {
    if (!caseId || !kind.trim()) return;
    try {
      await addDownPaymentSource(caseId, {
        kind: kind.trim(),
        amount: amount.trim() === "" ? null : amount.trim(),
        status: amount.trim() === "" ? "UNKNOWN" : "DECLARED",
      });
      await loadProfile(caseId);
      setCalc(null);
    } catch (e) {
      toast({
        title: "Не удалось добавить источник взноса",
        description: e instanceof MortgageCaseApiError ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  // --- Расчёт (M06) ---
  const runCalculation = async () => {
    if (!caseId) return;
    setCalcBusy(true);
    setCalcError(null);
    try {
      // Расчёт всегда идёт от свежего иммутабельного снапшота профиля (§21):
      // цифра обязана быть привязана к конкретной версии данных.
      const snapshot = await publishProfileSnapshot(caseId);
      const result = await createCalculationRun(caseId, {
        client_profile_snapshot_id: snapshot.id,
        annual_nominal_rate_percent: ratePercent.trim(),
        term_months: termMonths,
      });
      setCalc(result);
      await loadProfile(caseId);
    } catch (e) {
      setCalc(null);
      // Никакого локального пересчёта: ошибка остаётся ошибкой.
      setCalcError(
        e instanceof MortgageCaseApiError && e.status !== 0
          ? e.message
          : "Расчёт временно недоступен",
      );
    } finally {
      setCalcBusy(false);
    }
  };

  // Основной заёмщик: проверки реестров запускаются по конкретному участнику.
  const primaryPartyId = mortgageCase?.parties?.find((p) => p.role === "PRIMARY")?.id ?? null;
  const goal = profile?.purchase_goal;
  const availableNow = profile?.aggregates.available_now_total;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ипотечное решение клиента</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Проверяем клиента по документам и считаем сумму кредита и ежемесячный платёж.
            Итоговое решение принимает банк.
          </p>
        </div>
        {/* Инструменты — отдельными кнопками, а не одной общей «Инструменты». */}
        <div className="flex flex-wrap gap-2">
          {caseId && (
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/mortgage")}>
              <FolderOpen className="mr-1.5 h-4 w-4" />Другой кейс
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/mortgage/tools"><Calculator className="mr-1.5 h-4 w-4" />Калькулятор</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/mortgage/tools#programs"><Landmark className="mr-1.5 h-4 w-4" />Условия банков</Link>
          </Button>
        </div>
      </header>

      {!caseId && <NoCaseSelected cases={cases} loading={casesLoading} onPick={pickCase} />}

      {caseId && profileError && (
        <Card>
          <div className="flex items-start gap-3 px-5 py-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="font-medium">Профиль недоступен</p>
              <p className="text-sm text-muted-foreground">{profileError}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => void loadProfile(caseId)}>
                <RefreshCw className="mr-1.5 h-4 w-4" />Повторить
              </Button>
            </div>
          </div>
        </Card>
      )}

      {caseId && profile && (
        <>
          {/* Кейс (M01) */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <User2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Кейс {profile.case_id}</p>
                  <p className="text-sm text-muted-foreground">Версия профиля {profile.version}</p>
                </div>
              </div>
              {profile.latest_snapshot && (
                <span className="text-xs text-muted-foreground">
                  снапшот профиля {profile.latest_snapshot.content_hash.slice(0, 12)}…
                </span>
              )}
            </div>
          </Card>

          {/* Шаг 1. ИИН и проверка по официальным реестрам (M02) */}
          {primaryPartyId && (
            <SourceCheckSection caseId={profile.case_id} partyId={primaryPartyId} />
          )}

          {/* Шаг 2. Документы клиента (M03 / M04) */}
          <DocumentIntakeSection caseId={profile.case_id} />

          {/* Шаг 3. Профиль (M05) */}
          <Card>
            <CardHead
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Профиль клиента (M05)"
              sub="Цель покупки и источники взноса. Пустая или неизвестная сумма не считается нулём."
            />
            <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
              <div>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Цель покупки, ₸ (purchase_goal.target_price_max)
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={goal?.target_price_max ?? ""}
                    placeholder="не задана"
                    onBlur={(e) => void saveGoal(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  статус: {FIELD_LABEL[String(goal?.status)] ?? String(goal?.status ?? "—")}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Доступно на взнос (available_now_total)
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {showMoney(availableNow?.value)}
                </p>
                <p className="text-xs text-muted-foreground">
                  статус: {FIELD_LABEL[String(availableNow?.status)] ?? "—"}
                  {availableNow && !availableNow.complete && " · агрегат неполон"}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {profile.down_payment_sources.map((s) => (
                    <li key={s.id} className="flex justify-between border-b border-border/60 pb-1">
                      <span className="text-muted-foreground">{s.kind}</span>
                      <span className="tabular-nums">
                        {showMoney(s.amount)}{" "}
                        <span className="text-xs text-muted-foreground">· {FIELD_LABEL[s.status] ?? s.status}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <AddSourceForm onAdd={addSource} />
              </div>
            </div>
          </Card>

          {/* Расчёт (M06) */}
          <Card>
            <CardHead
              icon={<Calculator className="h-5 w-5" />}
              title="Шаг 4. Расчёт (M06)"
              sub="CALC-F-001 required_financing = max(цена − взнос, 0); CALC-F-002 аннуитетный платёж. Считает сервер."
            />
            <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm text-muted-foreground">Годовая номинальная ставка, %</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ratePercent}
                    onChange={(e) => setRatePercent(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-muted-foreground">Срок, месяцев</span>
                  <input
                    type="number"
                    min={1}
                    max={1200}
                    value={termMonths}
                    onChange={(e) => setTermMonths(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <Button onClick={() => void runCalculation()} disabled={calcBusy} className="w-full">
                  <Calculator className="mr-1.5 h-4 w-4" />
                  {calcBusy ? "Расчёт…" : "Рассчитать на сервере"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Расчёт публикует снапшот профиля и выполняется движком M06.
                  Ставка и срок — параметры прогона, а не данные профиля.
                </p>
              </div>

              <div className="space-y-3 rounded-lg bg-muted/40 p-4">
                {!calc && !calcError && (
                  <p className="text-sm text-muted-foreground">
                    Расчёт ещё не выполнялся. Значения появятся только после прогона на сервере.
                  </p>
                )}

                {calcError && (
                  <div className="flex items-start gap-2 text-sm">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <div>
                      <p className="font-medium text-rose-600 dark:text-rose-400">{calcError}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Приблизительный расчёт на устройстве не выполняется: цифра допустима
                        только из детерминированного движка.
                      </p>
                    </div>
                  </div>
                )}

                {calc && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Статус расчёта</span>
                      <StatusPill status={calc.status} />
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Требуемое финансирование</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {showMoney(calc.results.requiredFinancing.value)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {calc.results.requiredFinancing.machineName}/{calc.results.requiredFinancing.formulaVersion}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ежемесячный платёж (аннуитет)</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {showMoney(calc.results.annuity.value)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {calc.results.annuity.machineName}/{calc.results.annuity.formulaVersion}
                      </p>
                    </div>

                    {calc.results.blockers.length > 0 && (
                      <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
                        {calc.results.blockers.map((b, i) => (
                          <li key={`${b.code}-${i}`}>
                            <b className="font-medium">{b.code}</b> — {b.reason}
                            {b.blocking_input_refs.length > 0 && ` (${b.blocking_input_refs.join(", ")})`}
                          </li>
                        ))}
                      </ul>
                    )}

                    <details className="pt-1 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Воспроизводимость расчёта</summary>
                      <dl className="mt-2 space-y-0.5 break-all">
                        <div>input_hash: {calc.input_hash}</div>
                        <div>output_hash: {calc.output_hash}</div>
                        <div>replay_hash: {calc.replay_hash}</div>
                        <div>{calc.engine_version} · {calc.canonicalization_version}</div>
                        <div>{calc.decimal_context_version}</div>
                      </dl>
                    </details>
                  </>
                )}
              </div>
            </div>
          </Card>

          <div
            data-testid="release-scope-note"
            className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Банковский КДН (REG-F-001) не рассчитывается: нормативные входы не определены
              для релиза 1.0. Принимаемый банком доход, программы, сценарии и подбор квартир
              на этом экране не показываются — они относятся к последующим релизам.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * useSearchParams переводит поддерево в клиентский рендер до ближайшей границы
 * Suspense (Next 16, use-search-params#prerendering). Граница здесь, чтобы
 * оболочка дашборда пререндерилась, а от кейса зависел только сам экран.
 */
export default function MortgagePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          Загрузка ипотечного экрана…
        </div>
      }
    >
      <MortgageWorkspace />
    </Suspense>
  );
}

// --- Форма добавления источника взноса ---------------------------------------

function AddSourceForm({ onAdd }: { onAdd: (kind: string, amount: string) => void }) {
  const [kind, setKind] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        placeholder="Источник"
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder="Сумма"
        className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => { onAdd(kind, amount); setKind(""); setAmount(""); }}
      >
        Добавить
      </Button>
    </div>
  );
}
