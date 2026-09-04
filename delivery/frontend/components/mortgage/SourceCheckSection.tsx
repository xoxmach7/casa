"use client";

/**
 * M02 R0 — секция проверки по официальным реестрам на экране ипотечного кейса.
 *
 * Правила отображения из M02 §15 (Statuses / human messages) и §9:
 *  - покрытие показывается ПЕРВЫМ: брокер должен увидеть «3 из 7» раньше, чем
 *    отдельные карточки, иначе частичная проверка читается как завершённая;
 *  - каждое состояние передаётся текстом И иконкой, не только цветом;
 *  - найденный факт — янтарный, а не красный: это не отказ банка;
 *  - «недоступно» никогда не рисуется как «записей нет»;
 *  - у карточки не более одного основного действия;
 *  - технические enum'ы — только в деталях, не в заголовке.
 *
 * Никакой интерпретации на клиенте: статусы, тексты и покрытие приходят с
 * сервера. Компонент их отображает, а не выводит.
 */

import { useCallback, useState } from "react";
import {
  ShieldCheck, TriangleAlert, Clock, ExternalLink, RefreshCw,
  CircleSlash, HelpCircle, FileCheck2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MortgageCaseApiError } from "@/lib/mortgage/case-api";
import {
  createCheckBatch, getCheckResults, confirmManualTask, refreshCheckBatch,
  type CheckBatch, type CheckResult, type Coverage, type ManualTask, type CheckStatus,
} from "@/lib/mortgage/m02-api";

// --- Визуальные правила состояний (§15) -------------------------------------

interface StateStyle { icon: React.ReactNode; tone: string; label: string }

function stateStyle(result: CheckResult): StateStyle {
  const { status, outcome } = result;
  if (status === "COMPLETED" && outcome === "FOUND") {
    // Янтарный, не красный: факт источника — не отказ банка.
    return { icon: <FileCheck2 className="h-4 w-4" />, tone: "text-amber-600 dark:text-amber-400", label: "Найдена запись" };
  }
  if (status === "COMPLETED" && outcome === "NOT_FOUND") {
    return { icon: <ShieldCheck className="h-4 w-4" />, tone: "text-teal-600 dark:text-teal-400", label: "Записей не найдено" };
  }
  if (status === "COMPLETED" && (outcome === "ZERO" || outcome === "NOT_APPLICABLE")) {
    return { icon: <ShieldCheck className="h-4 w-4" />, tone: "text-teal-600 dark:text-teal-400", label: "Проверено" };
  }
  if (status === "COMPLETED" && outcome === "UNKNOWN") {
    return { icon: <HelpCircle className="h-4 w-4" />, tone: "text-muted-foreground", label: "Неоднозначный результат" };
  }
  if (status === "MANUAL_REQUIRED") {
    return { icon: <ExternalLink className="h-4 w-4" />, tone: "text-blue-600 dark:text-blue-400", label: "Нужна ручная проверка" };
  }
  if (status === "UNAVAILABLE") {
    return { icon: <Clock className="h-4 w-4" />, tone: "text-muted-foreground", label: "Источник недоступен" };
  }
  if (status === "BLOCKED") {
    return { icon: <CircleSlash className="h-4 w-4" />, tone: "text-muted-foreground", label: "Проверка заблокирована" };
  }
  if (status === "NOT_ALLOWED") {
    return { icon: <CircleSlash className="h-4 w-4" />, tone: "text-muted-foreground", label: "Не используется" };
  }
  if (status === "ERROR") {
    return { icon: <TriangleAlert className="h-4 w-4" />, tone: "text-rose-600 dark:text-rose-400", label: "Результат не подтверждён" };
  }
  return { icon: <Clock className="h-4 w-4" />, tone: "text-muted-foreground", label: "Выполняется" };
}

const OVERALL_TONE: Record<string, string> = {
  COMPLETE_FACTS_FOUND: "border-amber-500/40 bg-amber-500/10",
  COMPLETE_NO_RECORDS: "border-teal-500/40 bg-teal-500/10",
  PARTIAL: "border-border bg-muted/40",
  BLOCKED_CONSENT: "border-border bg-muted/40",
  BLOCKED_LEGAL: "border-border bg-muted/40",
  STALE: "border-border bg-muted/40",
};

// --- Сводка покрытия --------------------------------------------------------

function CoverageSummary({ coverage }: { coverage: Coverage }) {
  return (
    <div
      data-testid="m02-coverage"
      className={cn("rounded-lg border px-4 py-3", OVERALL_TONE[coverage.overallStatus] ?? "border-border bg-muted/40")}
    >
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          {/* Текст с сервера: клиент его не собирает и не смягчает. */}
          <p className="font-medium">{coverage.brokerText}</p>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div>Завершено: <b className="text-foreground">{coverage.completed}</b> из {coverage.requiredTotal}</div>
            {coverage.found > 0 && <div>Найдено фактов: <b className="text-foreground">{coverage.found}</b></div>}
            {coverage.manual > 0 && <div>Ручных: <b className="text-foreground">{coverage.manual}</b></div>}
            {coverage.unavailable > 0 && <div>Недоступно: <b className="text-foreground">{coverage.unavailable}</b></div>}
            {coverage.unknown > 0 && <div>Без ответа: <b className="text-foreground">{coverage.unknown}</b></div>}
            {coverage.stale > 0 && <div>Устарело: <b className="text-foreground">{coverage.stale}</b></div>}
          </dl>
        </div>
      </div>
    </div>
  );
}

// --- Форма подтверждения ручной проверки ------------------------------------

function ManualConfirmForm({ task, onConfirm, busy }: {
  task: ManualTask;
  busy: boolean;
  onConfirm: (input: { outcome: "FOUND" | "NOT_FOUND" | "UNKNOWN"; evidence_ref: string }) => void;
}) {
  const [outcome, setOutcome] = useState<"FOUND" | "NOT_FOUND" | "UNKNOWN">("NOT_FOUND");
  const [evidence, setEvidence] = useState("");

  return (
    <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-3">
      <p className="text-xs text-muted-foreground">{task.instruction}</p>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          {/* Единственное основное действие для этого состояния. */}
          <a href={task.official_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" />Открыть официальный сервис
          </a>
        </Button>
      </div>

      <label className="block">
        <span className="text-xs text-muted-foreground">Что вы увидели</span>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as typeof outcome)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="NOT_FOUND">Записей не найдено</option>
          <option value="FOUND">Запись найдена</option>
          <option value="UNKNOWN">Источник не дал однозначного результата</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-muted-foreground">
          Доказательство: ссылка на скриншот или номер справки
        </span>
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="например, screenshot://enis/2026-08-27"
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <Button
        size="sm"
        // Подтвердить без доказательства нельзя: кнопка «записей нет» сама по
        // себе запрещена спекой, поэтому она заблокирована до ввода evidence.
        disabled={busy || evidence.trim() === ""}
        onClick={() => onConfirm({ outcome, evidence_ref: evidence.trim() })}
      >
        Подтвердить проверку
      </Button>
      {evidence.trim() === "" && (
        <p className="text-[11px] text-muted-foreground">
          Без доказательства подтверждение не принимается.
        </p>
      )}
    </div>
  );
}

// --- Карточка источника (§15) -----------------------------------------------

function SourceCard({ result, onConfirm, busyTaskId }: {
  result: CheckResult;
  busyTaskId: string | null;
  onConfirm: (taskId: string, input: { outcome: "FOUND" | "NOT_FOUND" | "UNKNOWN"; evidence_ref: string }) => void;
}) {
  const style = stateStyle(result);
  const openTask = result.manual_tasks.find((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");

  return (
    <li className="rounded-lg border border-border p-4" data-testid="m02-source-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{result.source.check_type}</p>
          <p className="text-xs text-muted-foreground">{result.source.owner}</p>
        </div>
        {/* Текст + иконка: состояние не передаётся одним цветом. */}
        <span
          data-testid="m02-source-status"
          className={cn("inline-flex items-center gap-1.5 text-sm", style.tone)}
        >
          {style.icon}
          <span>{style.label}</span>
        </span>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{result.human_text}</p>

      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>Канал: {channelLabel(result.source.automation_mode, result.status)}</div>
        <div>{result.freshness.ageText}</div>
        <div>Актуальность данных: {result.freshness.sourceDataAsOfText}</div>
        <div>Доказательство: {result.evidence.present ? "приложено" : "отсутствует"}</div>
      </dl>

      {result.facts.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {result.facts.map((f) => (
            <li key={f.key} className="flex justify-between gap-2 border-b border-border/60 pb-1">
              <span className="text-muted-foreground">{f.key}</span>
              <span className="tabular-nums">{String(f.value)}</span>
            </li>
          ))}
        </ul>
      )}

      {openTask && (
        <ManualConfirmForm
          task={openTask}
          busy={busyTaskId === openTask.task_id}
          onConfirm={(input) => onConfirm(openTask.task_id, input)}
        />
      )}

      <p className="mt-2 text-[11px] text-muted-foreground">{result.disclaimer}</p>
    </li>
  );
}

function channelLabel(mode: string, status: CheckStatus): string {
  if (status === "NOT_ALLOWED") return "не используется";
  switch (mode) {
    case "MANUAL": return "вручную";
    case "CLIENT_AUTHORIZED": return "с участием клиента";
    case "UNAVAILABLE": return "временно недоступно";
    case "PROHIBITED": return "не используется";
    default: return "автоматически";
  }
}

// --- Секция -----------------------------------------------------------------

export function SourceCheckSection({ caseId, partyId }: { caseId: string; partyId: string }) {
  const [batch, setBatch] = useState<CheckBatch | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [iin, setIin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const loadResults = useCallback(async (batchId: string) => {
    const data = await getCheckResults(batchId);
    setResults(data.results);
    setCoverage(data.coverage);
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createCheckBatch(caseId, {
        party_id: partyId,
        iin: iin.trim(),
        identity_version: 1,
      });
      setBatch(created);
      setCoverage(created.coverage);
      // ИИН не остаётся в состоянии страницы дольше, чем нужно для запроса.
      setIin("");
      await loadResults(created.batch_id);
    } catch (e) {
      setError(e instanceof MortgageCaseApiError ? e.message : "Не удалось запустить проверку");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (taskId: string, input: { outcome: "FOUND" | "NOT_FOUND" | "UNKNOWN"; evidence_ref: string }) => {
    if (!batch) return;
    setBusyTaskId(taskId);
    setError(null);
    try {
      await confirmManualTask(taskId, { ...input, checked_at: new Date().toISOString() });
      await loadResults(batch.batch_id);
    } catch (e) {
      setError(e instanceof MortgageCaseApiError ? e.message : "Не удалось подтвердить проверку");
    } finally {
      setBusyTaskId(null);
    }
  };

  const refresh = async () => {
    if (!batch) return;
    setBusy(true);
    setError(null);
    try {
      const next = await refreshCheckBatch(batch.batch_id);
      setBatch(next);
      setCoverage(next.coverage);
      await loadResults(next.batch_id);
    } catch (e) {
      setError(e instanceof MortgageCaseApiError ? e.message : "Не удалось обновить проверку");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
        <div>
          <h2 className="text-base font-semibold leading-tight">Проверка по официальным реестрам</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Автоматические подключения к источникам отключены: проверки выполняются
            вручную на официальных сайтах и подтверждаются доказательством.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {error && (
          <p className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {!batch && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[220px] flex-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                ИИН участника (12 цифр)
              </span>
              <input
                value={iin}
                onChange={(e) => setIin(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <Button onClick={() => void start()} disabled={busy || iin.trim() === ""}>
              {busy ? "Запуск…" : "Запустить проверку"}
            </Button>
          </div>
        )}

        {/* Покрытие показывается ПЕРВЫМ (§9): частичность нельзя прятать под карточки. */}
        {coverage && <CoverageSummary coverage={coverage} />}

        {batch && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Участник {batch.participant.iin_masked} · манифест {batch.manifest.manifest_version}
            </span>
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={busy}>
              <RefreshCw className="mr-1.5 h-4 w-4" />Обновить проверку
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {results
              .filter((r) => r.status !== "NOT_ALLOWED")
              .map((r) => (
                <SourceCard key={r.result_id} result={r} onConfirm={confirm} busyTaskId={busyTaskId} />
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}
