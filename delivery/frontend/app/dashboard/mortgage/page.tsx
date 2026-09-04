"use client";

/**
 * CASA Pro Ипотека — рабочий экран релиза 1.0 (M01→M06).
 *
 * ЖЁСТКИЕ ПРАВИЛА ЭТОГО ЭКРАНА (M06 Production Spec v1.4 §18/§21/§29):
 *
 *  1. Фронт НЕ является calculation engine. Здесь нет и не должно появиться ни
 *     одной ипотечной формулы, ни Math.pow, ни Math.round как источника числа.
 *     Все величины приходят из POST /api/v2/cases/{id}/scoring и
 *     /calculation-runs и показываются ровно так, как их вернул сервер.
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
  Calculator, User2, ShieldCheck, Info, TriangleAlert, RefreshCw, FolderOpen,
  Plus, ArrowRight, FileText, Landmark, X, Home, ChevronDown,
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
  runScoring,
  addIncomeSource,
  addCommitment,
  DOWN_PAYMENT_KINDS,
  DOWN_PAYMENT_KIND_LABEL,
  removeDownPaymentSource,
  removeIncomeSource,
  removeCommitment,
  getMatchingProperties,
  MortgageCaseApiError,
  type MortgageCase,
  type MortgageCaseListItem,
  type ClientProfile,
  type CalculationSnapshot,
  type CalcStatus,
  type ScoringResult,
  type PropertyMatch,
} from "@/lib/mortgage/case-api";
import { SourceCheckSection } from "@/components/mortgage/SourceCheckSection";
import { DocumentIntakeSection } from "@/components/mortgage/DocumentIntakeSection";
import { NewCaseDialog } from "@/components/mortgage/NewCaseDialog";

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

function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}>{children}</section>;
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

function NoCaseSelected({ cases, loading, onPick, onNew }: {
  cases: MortgageCaseListItem[]; loading: boolean; onPick: (id: string) => void; onNew: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-primary"><FolderOpen className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-semibold leading-tight">Расчёты по клиентам</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Откройте расчёт клиента, чтобы продолжить, или начните новый.
                Суммы появятся после выбора клиента.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onNew}>
            <Plus className="mr-1.5 h-4 w-4" />Новый расчёт
          </Button>
        </div>

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
            <Button className="mt-4" onClick={onNew}>
              <Plus className="mr-1.5 h-4 w-4" />Новый расчёт
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

  const [newCaseOpen, setNewCaseOpen] = useState(false);

  // Скоринг доступности: «потянет ли клиент эту квартиру».
  const [sharePercent, setSharePercent] = useState("50");
  const [scoring, setScoring] = useState<ScoringResult | null>(null);
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [scoringBusy, setScoringBusy] = useState(false);

  // Что клиент может купить на свой бюджет — считается тем же скорингом.
  const [match, setMatch] = useState<PropertyMatch | null>(null);
  const [matchBusy, setMatchBusy] = useState(false);
  const [matchRooms, setMatchRooms] = useState("");

  // Проверки по госреестрам открываются по требованию — см. блок внизу экрана.
  const [checksOpen, setChecksOpen] = useState(false);

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
    if (!caseId) { setProfile(null); setMortgageCase(null); setCalc(null); setScoring(null); return; }
    setCalc(null);
    setScoring(null);
    setScoringError(null);
    setMatch(null);
    setCalcError(null);
    void loadProfile(caseId);
  }, [caseId, loadProfile]);

  const pickCase = (id: string) => router.push(`/dashboard/mortgage?case=${encodeURIComponent(id)}`);

  // Имя клиента приходит из списка кейсов: идентификатор расчёта брокеру ничего
  // не говорит, а в шапке нужно видеть, чей это расчёт.
  const clientName = mortgageCase?.client_name
    ?? cases.find((c) => c.id === caseId)?.client_name
    ?? null;

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

  const addIncome = async (kind: string, amount: string) => {
    if (!caseId || !kind.trim()) return;
    try {
      await addIncomeSource(caseId, {
        kind: kind.trim(),
        amount: amount.trim() === "" ? null : amount.trim(),
        status: amount.trim() === "" ? "UNKNOWN" : "DECLARED",
      });
      await loadProfile(caseId);
      setScoring(null);
    } catch (e) {
      toast({
        title: "Не удалось добавить доход",
        description: e instanceof MortgageCaseApiError ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const addOtherCommitment = async (kind: string, amount: string) => {
    if (!caseId || !kind.trim()) return;
    try {
      await addCommitment(caseId, {
        kind: kind.trim(),
        amount: amount.trim() === "" ? null : amount.trim(),
        status: amount.trim() === "" ? "UNKNOWN" : "DECLARED",
      });
      await loadProfile(caseId);
      setScoring(null);
    } catch (e) {
      toast({
        title: "Не удалось добавить обязательство",
        description: e instanceof MortgageCaseApiError ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const removeRow = async (
    remove: (caseId: string, rowId: string) => Promise<void>, rowId: string,
  ) => {
    if (!caseId) return;
    try {
      await remove(caseId, rowId);
      await loadProfile(caseId);
      setScoring(null);
    } catch (e) {
      toast({
        title: "Не удалось удалить строку",
        description: e instanceof MortgageCaseApiError ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  /** Скоринг считает сервер: цена и анкета из профиля, платежи — из ПКБ. */
  const runScore = async () => {
    if (!caseId) return;
    setScoringBusy(true);
    setScoringError(null);
    try {
      const result = await runScoring(caseId, {
        annual_nominal_rate_percent: ratePercent.trim(),
        term_months: termMonths,
        payment_share_percent: sharePercent.trim(),
      });
      setScoring(result);
      setMatch(null);
      // Подбор имеет смысл только когда бюджет посчитан.
      if (result.verdict === "FITS" || result.verdict === "NOT_ENOUGH") void loadMatch();
    } catch (e) {
      setScoring(null);
      setScoringError(
        e instanceof MortgageCaseApiError && e.status !== 0 ? e.message : "Скоринг временно недоступен",
      );
    } finally {
      setScoringBusy(false);
    }
  };

  /** Подбор идёт от того же бюджета, что и вердикт: два разных ответа на один
   * вопрос экран показывать не должен. */
  const loadMatch = useCallback(async (rooms?: string) => {
    if (!caseId) return;
    setMatchBusy(true);
    try {
      const roomsValue = Number((rooms ?? matchRooms).trim());
      setMatch(await getMatchingProperties(caseId, {
        annual_nominal_rate_percent: ratePercent.trim(),
        term_months: termMonths,
        payment_share_percent: sharePercent.trim(),
        ...(Number.isInteger(roomsValue) && roomsValue > 0 ? { rooms: roomsValue } : {}),
      }));
    } catch {
      setMatch(null);
    } finally {
      setMatchBusy(false);
    }
  }, [caseId, matchRooms, ratePercent, termMonths, sharePercent]);

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
          {caseId ? (
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/mortgage")}>
              <FolderOpen className="mr-1.5 h-4 w-4" />Все расчёты
            </Button>
          ) : (
            <Button size="sm" onClick={() => setNewCaseOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Новый расчёт
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

      <NewCaseDialog open={newCaseOpen} onOpenChange={setNewCaseOpen} onCreated={pickCase} />

      {!caseId && (
        <NoCaseSelected
          cases={cases}
          loading={casesLoading}
          onPick={pickCase}
          onNew={() => setNewCaseOpen(true)}
        />
      )}

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
          {/* Чей это расчёт. Технический идентификатор ушёл в «Служебные
              данные» внизу: брокеру он не нужен, а поддержке — нужен. */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <User2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">{clientName ?? "Клиент не указан"}</p>
                  <p className="text-sm text-muted-foreground">Расчёт по ипотеке</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mortgageCase && <CaseStatusBadge status={mortgageCase.status} />}
                {/* Расчёт — цель визита, но он ниже документов и анкеты, потому
                    что считается по ним. Одна кнопка снимает вопрос «где он». */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById("calc-block")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  <Calculator className="mr-1.5 h-4 w-4" />К расчёту
                </Button>
              </div>
            </div>
          </Card>

          {/* Шаг 1. Документы клиента (M03 / M04) */}
          <DocumentIntakeSection caseId={profile.case_id} />

          {/* Шаг 2. Деньги клиента (M05) */}
          <Card>
            <CardHead
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Шаг 2. Деньги клиента"
              sub="Стоимость квартиры и первоначальный взнос. Пустая сумма не считается нулём — она остаётся неизвестной."
            />
            <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
              <div>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Стоимость квартиры, ₸
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
                  Первоначальный взнос
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {showMoney(availableNow?.value)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile.down_payment_sources.length === 0
                    ? "источники взноса не добавлены"
                    : <>
                        статус: {FIELD_LABEL[String(availableNow?.status)] ?? "—"}
                        {availableNow && !availableNow.complete && (
                          availableNow.unknownEligibility > 0
                            ? " · есть источник, тип которого не даёт зачесть его деньгами"
                            : " · не у всех источников указана сумма"
                        )}
                        {availableNow && availableNow.excludedNonMonetary > 0
                          && ` · залог не считается деньгами (${availableNow.excludedNonMonetary})`}
                      </>}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {profile.down_payment_sources.map((s) => (
                    <li key={s.id} className="flex justify-between border-b border-border/60 pb-1">
                      <span className="text-muted-foreground">{DOWN_PAYMENT_KIND_LABEL[s.kind] ?? s.kind}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {showMoney(s.amount)}
                        <span className="text-xs text-muted-foreground">· {FIELD_LABEL[s.status] ?? s.status}</span>
                        <RemoveRowButton label={`Удалить источник ${s.kind}`} onRemove={() => void removeRow(removeDownPaymentSource, s.id)} />
                      </span>
                    </li>
                  ))}
                </ul>
                <AddDownPaymentForm onAdd={addSource} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Доход клиента в месяц
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {showMoney(profile.aggregates.monthly_income_total.value)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile.income_sources.length === 0
                    ? "источники дохода не добавлены"
                    : `статус: ${FIELD_LABEL[String(profile.aggregates.monthly_income_total.status)] ?? "—"}`}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {profile.income_sources.map((s) => (
                    <li key={s.id} className="flex justify-between border-b border-border/60 pb-1">
                      <span className="text-muted-foreground">{s.kind}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {showMoney(s.amount)}
                        <RemoveRowButton label={`Удалить доход ${s.kind}`} onRemove={() => void removeRow(removeIncomeSource, s.id)} />
                      </span>
                    </li>
                  ))}
                </ul>
                <AddSourceForm onAdd={addIncome} placeholder="Источник дохода" />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Другие платежи в месяц
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {showMoney(profile.aggregates.monthly_commitments_total.value)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Алименты, аренда и прочее. Платежи по кредитам сюда вносить не нужно —
                  они берутся из кредитной истории.
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {profile.non_credit_commitments.map((s) => (
                    <li key={s.id} className="flex justify-between border-b border-border/60 pb-1">
                      <span className="text-muted-foreground">{s.kind}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {showMoney(s.amount)}
                        <RemoveRowButton label={`Удалить обязательство ${s.kind}`} onRemove={() => void removeRow(removeCommitment, s.id)} />
                      </span>
                    </li>
                  ))}
                </ul>
                <AddSourceForm onAdd={addOtherCommitment} placeholder="Обязательство" />
              </div>
            </div>
          </Card>

          {/* Расчёт (M06). Ради него брокер и открыл экран, поэтому карточка
              выделена рамкой: её нельзя принять за очередной служебный блок. */}
          <Card id="calc-block" className="border-primary/50 shadow-md">
            <CardHead
              icon={<Calculator className="h-5 w-5" />}
              title="Шаг 3. Расчёт кредита"
              sub="Сумма кредита = стоимость квартиры минус взнос. Платёж — аннуитетный. Считает сервер, не браузер."
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
                <label className="block">
                  <span className="text-sm text-muted-foreground">Доля дохода на платёж, %</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sharePercent}
                    onChange={(e) => setSharePercent(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <Button onClick={() => void runScore()} disabled={scoringBusy} className="w-full">
                  <Calculator className="mr-1.5 h-4 w-4" />
                  {scoringBusy ? "Считаем…" : "Рассчитать"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Ставка, срок и доля дохода — условия конкретного банка и решение брокера,
                  а не данные клиента: меняйте их и пересчитывайте.
                </p>
              </div>

              <div className="space-y-3 rounded-lg bg-muted/40 p-4">
                {!scoring && !scoringError && (
                  <p className="text-sm text-muted-foreground">
                    Нажмите «Рассчитать» — покажем, потянет ли клиент эту квартиру.
                  </p>
                )}

                {scoringError && (
                  <div className="flex items-start gap-2 text-sm">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <div>
                      <p className="font-medium text-rose-600 dark:text-rose-400">{scoringError}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Приблизительный расчёт на устройстве не выполняется.
                      </p>
                    </div>
                  </div>
                )}

                {scoring && <ScoringPanel scoring={scoring} />}

                {scoring && (scoring.verdict === "FITS" || scoring.verdict === "NOT_ENOUGH") && (
                  <div className="border-t border-border/60 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void runCalculation()}
                      disabled={calcBusy}
                      className="w-full"
                    >
                      {calcBusy ? "Фиксируем…" : "Зафиксировать расчёт"}
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Сохраняет неизменяемый снимок расчёта — на него можно сослаться позже.
                    </p>
                    {calcError && (
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{calcError}</p>
                    )}
                    {calc && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <StatusPill status={calc.status} /> зафиксирован
                      </p>
                    )}
                  </div>
                )}
              </div>            </div>
          </Card>

          {match && (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-primary"><Home className="h-5 w-5" /></div>
                  <div>
                    <h2 className="text-base font-semibold leading-tight">Что клиент может купить</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {match.budget
                        ? <>Бюджет <b className="tabular-nums">{showMoney(match.budget)}</b> — максимальный кредит плюс взнос. Показаны квартиры не дороже него.</>
                        : "Бюджет не посчитан: заполните данные выше."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={matchRooms}
                    onChange={(e) => setMatchRooms(e.target.value)}
                    inputMode="numeric"
                    placeholder="Комнат"
                    aria-label="Число комнат"
                    className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <Button size="sm" variant="outline" disabled={matchBusy} onClick={() => void loadMatch()}>
                    {matchBusy ? "Ищем…" : "Обновить"}
                  </Button>
                </div>
              </div>

              {match.items.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                  {match.budget
                    ? "В каталоге нет квартир в этом бюджете. Попробуйте изменить срок, ставку или число комнат."
                    : "Подбор появится, когда будет посчитан бюджет."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {match.items.map((item) => (
                    <li key={`${item.source}-${item.id}`}>
                      <Link
                        href={item.url}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium">
                            {item.title}
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              item.source === "NEW_BUILD"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}>
                              {item.source === "NEW_BUILD" ? "Новостройка" : "Вторичка"}
                            </span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.location}
                            {item.floor !== null && ` · ${item.floor} этаж`}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">{showMoney(item.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Проверки по госреестрам (M02). Пока подключения к источникам нет,
              каждая карточка говорит одно и то же — «сходите на сайт и
              посмотрите сами», — а десяток таких карточек закрывал собой
              расчёт, ради которого брокер сюда и пришёл. Функция сохранена
              целиком и открывается по требованию; смонтирована она тоже только
              в открытом виде, чтобы не дёргать источники впустую. */}
          {primaryPartyId && (
            <div className="rounded-lg border border-border bg-muted/20">
              <button
                type="button"
                onClick={() => setChecksOpen((v) => !v)}
                aria-expanded={checksOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Проверки по госреестрам — пока вручную, на сайтах источников
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    checksOpen && "rotate-180",
                  )}
                />
              </button>
              {checksOpen && (
                <div className="border-t border-border p-4">
                  <SourceCheckSection caseId={profile.case_id} partyId={primaryPartyId} />
                </div>
              )}
            </div>
          )}

          {/* Идентификаторы нужны поддержке при разборе обращения, поэтому они
              сохранены — но убраны из рабочего поля зрения брокера. */}
          <details className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Служебные данные (для поддержки)</summary>
            <dl className="mt-2 space-y-0.5 break-all">
              <div>идентификатор расчёта: {profile.case_id}</div>
              <div>версия профиля: {profile.version}</div>
              {profile.latest_snapshot && (
                <div>снапшот профиля: {profile.latest_snapshot.content_hash.slice(0, 16)}…</div>
              )}
              {calc && (
                <>
                  <div>input_hash: {calc.input_hash}</div>
                  <div>output_hash: {calc.output_hash}</div>
                  <div>replay_hash: {calc.replay_hash}</div>
                  <div>{calc.engine_version} · {calc.canonicalization_version}</div>
                </>
              )}
            </dl>
          </details>
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

function AddSourceForm({ onAdd, placeholder = "Источник" }: {
  onAdd: (kind: string, amount: string) => void;
  placeholder?: string;
}) {
  const [kind, setKind] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        placeholder={placeholder}
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

// --- Вердикт скоринга --------------------------------------------------------

const VERDICT: Record<string, { title: string; tone: string; sub: string }> = {
  FITS: {
    title: "Клиент проходит по платежу",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    sub: "Платёж по этой квартире укладывается в свободный платёж клиента.",
  },
  NOT_ENOUGH: {
    title: "Не проходит по платежу",
    tone: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    sub: "Платёж по этой квартире больше, чем клиент может платить.",
  },
  NEEDS_DATA: {
    title: "Не хватает данных",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    sub: "Заполните перечисленное — и расчёт станет возможным.",
  },
  INVALID_INPUT: {
    title: "Некорректные параметры",
    tone: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    sub: "Проверьте ставку, срок и долю дохода.",
  },
};

/**
 * Взноса хватает на всю квартиру — кредит не нужен. Сервер помечает это кодом
 * NO_FINANCING_NEEDED; без него экран писал «проходит по платежу» и два нуля,
 * что брокер читает как поломку, а не как ответ.
 */
const NO_LOAN_NEEDED = {
  title: "Кредит не нужен",
  tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  sub: "Первоначального взноса хватает на всю стоимость квартиры.",
};

function ScoringPanel({ scoring }: { scoring: ScoringResult }) {
  const noLoan = scoring.verdict === "FITS" && (scoring.codes ?? []).includes("NO_FINANCING_NEEDED");
  const v = noLoan ? NO_LOAN_NEEDED : VERDICT[scoring.verdict] ?? VERDICT.NEEDS_DATA;
  const enough = scoring.verdict === "FITS";

  return (
    <>
      <div className={cn("rounded-lg px-3 py-2", v.tone)}>
        <p className="font-semibold leading-tight">{v.title}</p>
        <p className="mt-0.5 text-xs opacity-90">{v.sub}</p>
      </div>

      {scoring.missing.length > 0 && (
        <ul className="space-y-1 text-sm">
          {scoring.missing.map((m) => (
            <li key={m.field} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{m.action}</span>
            </li>
          ))}
        </ul>
      )}

      {scoring.verdict !== "NEEDS_DATA" && scoring.verdict !== "INVALID_INPUT" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Нужен кредит</p>
              <p className="text-xl font-bold tabular-nums">{showMoney(scoring.requiredFinancing.value)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Платёж в месяц</p>
              <p className="text-xl font-bold tabular-nums">{showMoney(scoring.monthlyPayment.value)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Клиент может платить</p>
              <p className="text-xl font-bold tabular-nums">{showMoney(scoring.paymentCapacity.value)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Максимальный кредит</p>
              <p className="text-xl font-bold tabular-nums">{showMoney(scoring.maxLoan.value)}</p>
            </div>
          </div>

          {!enough && (
            <p className="text-sm">
              Не хватает <b className="tabular-nums">{showMoney(scoring.paymentGap.value)}</b> в месяц
              {scoring.loanGap.value && scoring.loanGap.value !== "0.00" && (
                <> — это <b className="tabular-nums">{showMoney(scoring.loanGap.value)}</b> суммы кредита.</>
              )}
            </p>
          )}

          {scoring.unverifiedInputs && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Часть данных заявлена со слов клиента и не подтверждена документами.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Предварительная оценка CASA по данным брокера. Решение принимает банк.
          </p>
        </>
      )}
    </>
  );
}

/**
 * Источник взноса выбирается из списка, который понимает движок: свободный
 * текст он зачесть не может и агрегат оставался «неизвестно» при введённой
 * сумме — брокер видел деньги на экране и ноль в расчёте.
 */
function AddDownPaymentForm({ onAdd }: { onAdd: (kind: string, amount: string) => void }) {
  const [kind, setKind] = useState(DOWN_PAYMENT_KINDS[0].value);
  const [amount, setAmount] = useState("");
  const selected = DOWN_PAYMENT_KINDS.find((k) => k.value === kind);

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Источник взноса"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          {DOWN_PAYMENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Сумма"
          className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
        />
        <Button size="sm" variant="outline" onClick={() => { onAdd(kind, amount); setAmount(""); }}>
          Добавить
        </Button>
      </div>
      {selected && !selected.cash && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Этот источник не засчитывается как деньги на взнос — расчёт останется неполным.
        </p>
      )}
    </div>
  );
}

/** Крестик удаления строки анкеты. */
function RemoveRowButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onRemove}
      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-rose-600"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
