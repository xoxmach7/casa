"use client";

import { useState } from "react";
import {
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  FileUp,
  FileCheck2,
  Loader2,
  AlertTriangle,
  Fingerprint,
  Play,
  Pencil,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatTenge, formatPercent } from "@/lib/mortgage/calc";
import type { SectionProps } from "./contracts";
import {
  SectionShell,
  StatusBadge,
  CONSENT_LABEL,
  DOC_LABEL,
  VERDICT_LABEL,
  FRESHNESS_LABEL,
  IIN_LABEL,
  type SectionCompletion,
} from "./ui";
import type { ClientDocument } from "@/lib/mortgage/types";

// ============================================================================
// Секция 1 — Клиент и согласие
// ============================================================================

export function SectionClientConsent({ state, h }: SectionProps) {
  const { client, consent } = state;
  const label = CONSENT_LABEL[consent.status];
  const completion: SectionCompletion = consent.status === "confirmed" ? "done" : "active";

  return (
    <SectionShell
      order={1}
      title="Клиент и согласие"
      completion={completion}
      hint="Согласие обязательно до загрузки документов, проверок по ИИН и расчётов."
      headerRight={
        client ? (
          <StatusBadge tone={label.tone}>
            {consent.status === "confirmed" ? (
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            ) : (
              <ShieldAlert className="mr-1 h-3.5 w-3.5" />
            )}
            {label.text}
          </StatusBadge>
        ) : undefined
      }
    >
      {!client ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
          <UserPlus className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Клиент не выбран</p>
            <p className="text-sm text-muted-foreground">Выберите существующего или создайте нового.</p>
          </div>
          <Button className="bg-[#15325B] hover:bg-[#15325B]/90" onClick={h.openClientPicker}>
            <UserPlus className="mr-2 h-4 w-4" />
            Выбрать клиента
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{client.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {client.phone} · ИИН {client.iinMasked} · {client.city}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={h.openClientPicker}>
              Сменить клиента
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Подтв. доход" value={client.confirmedIncome ? formatTenge(client.confirmedIncome) : "—"} />
            <Metric label="Тек. платёж" value={client.existingMonthlyPayment ? formatTenge(client.existingMonthlyPayment) : "—"} />
            <Metric label="Взнос" value={client.downPayment ? formatTenge(client.downPayment) : "—"} />
            <Metric label="Бюджет квартиры" value={client.desiredPropertyPrice ? formatTenge(client.desiredPropertyPrice) : "—"} />
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            {consent.status !== "confirmed" ? (
              <Button className="bg-[#15325B] hover:bg-[#15325B]/90" onClick={h.openConsent}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {consent.status === "not_requested" ? "Отправить SMS-согласие" : "Повторить запрос согласия"}
              </Button>
            ) : (
              <Button variant="outline" onClick={h.revokeConsent}>
                Отозвать согласие
              </Button>
            )}
            {consent.status === "sms_pending" && (
              <span className="inline-flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Ждём подтверждения клиентом (ссылка {consent.linkTtlMinutes} мин, код {consent.otpTtlMinutes} мин)
              </span>
            )}
          </div>

          {consent.audit && (
            <Accordion type="single" collapsible>
              <AccordionItem value="audit" className="border-b-0">
                <AccordionTrigger className="text-sm">Детали аудита согласия</AccordionTrigger>
                <AccordionContent>
                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <AuditRow k="ID согласия" v={consent.audit.consentId} />
                    <AuditRow k="Телефон" v={consent.audit.phoneMasked} />
                    <AuditRow k="Версия текста" v={consent.audit.consentTextVersion} />
                    <AuditRow k="Способ" v={consent.audit.method} />
                    <AuditRow k="Запрошено" v={fmt(consent.audit.requestedAt)} />
                    <AuditRow k="Открыто" v={fmt(consent.audit.openedAt)} />
                    <AuditRow k="Подтверждено" v={fmt(consent.audit.confirmedAt)} />
                    <AuditRow k="ID SMS-провайдера" v={consent.audit.smsProviderMessageId ?? "—"} />
                  </dl>
                  <div className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    Цели обработки: {consent.audit.purposes.join(", ")}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}
    </SectionShell>
  );
}

// ============================================================================
// Секция 2 — Документы и проверка по ИИН
// ============================================================================

export function SectionDocuments({ state, h }: SectionProps) {
  const consentOk = state.consent.status === "confirmed";
  const bothConfirmed =
    state.documents.creditHistory.status === "confirmed" && state.documents.enpf.status === "confirmed";
  const completion: SectionCompletion = !consentOk ? "locked" : bothConfirmed ? "done" : "active";

  return (
    <SectionShell
      order={2}
      title="Документы и проверка по ИИН"
      completion={completion}
      hint="Кредитная история и выписка ЕНПФ (PDF). Поля подтверждаются вручную при низкой уверенности."
    >
      {!consentOk ? (
        <BlockedNotice onConsent={h.openConsent} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <DocumentCard doc={state.documents.creditHistory} which="creditHistory" h={h} />
            <DocumentCard doc={state.documents.enpf} which="enpf" h={h} />
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Проверка по ИИН (официальные источники)</span>
              <StatusBadge tone={IIN_LABEL[state.iinCheck.status].tone}>
                {IIN_LABEL[state.iinCheck.status].text}
              </StatusBadge>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={state.iinCheck.status === "in_progress"}
              onClick={h.runIinCheck}
            >
              {state.iinCheck.status === "in_progress" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-2 h-3.5 w-3.5" />
              )}
              Запустить проверку
            </Button>
          </div>
          {state.iinCheck.status === "source_unavailable" && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Источник недоступен — это НЕ «записей нет». Требуется ручная проверка (AC-015).
            </p>
          )}
        </div>
      )}
    </SectionShell>
  );
}

function DocumentCard({
  doc,
  which,
  h,
}: {
  doc: ClientDocument;
  which: "creditHistory" | "enpf";
  h: SectionProps["h"];
}) {
  const label = DOC_LABEL[doc.status];
  const inFlight = ["uploading", "scanning", "processing"].includes(doc.status);
  const lowConfidence = doc.fields.filter((f) => f.confidence < 0.7 || f.inconsistency);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{doc.title}</span>
        </div>
        <StatusBadge tone={label.tone}>{label.text}</StatusBadge>
      </div>

      {inFlight && (
        <div className="mt-3">
          <Progress value={doc.progress ?? 20} />
          <p className="mt-1 text-xs text-muted-foreground">{label.text}</p>
        </div>
      )}

      {doc.status === "missing" && (
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => h.uploadDocument(which)}>
          <FileUp className="mr-2 h-3.5 w-3.5" />
          Загрузить PDF
        </Button>
      )}

      {(doc.status === "needs_review" || doc.status === "confirmed") && doc.fields.length > 0 && (
        <div className="mt-3 space-y-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8">Поле</TableHead>
                <TableHead className="h-8">Значение</TableHead>
                <TableHead className="h-8 text-right">Увер.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.fields.map((f) => (
                <TableRow key={f.key}>
                  <TableCell className="py-1.5 text-xs text-muted-foreground">{f.label}</TableCell>
                  <TableCell className="py-1.5 text-xs font-medium">{String(f.value)}</TableCell>
                  <TableCell className="py-1.5 text-right">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        f.confidence < 0.7 ? "text-red-600" : f.confidence < 0.95 ? "text-amber-600" : "text-emerald-600",
                      )}
                    >
                      {Math.round(f.confidence * 100)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {doc.status === "needs_review" && lowConfidence.length > 0 && (
            <ManualCorrection doc={which} field={lowConfidence[0]} h={h} />
          )}

          {doc.status === "needs_review" && (
            <Button size="sm" className="w-full bg-[#15325B] hover:bg-[#15325B]/90" onClick={() => h.confirmDocument(which)}>
              Подтвердить данные документа
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ManualCorrection({
  doc,
  field,
  h,
}: {
  doc: "creditHistory" | "enpf";
  field: { key: string; label: string; value: string | number; inconsistency?: string };
  h: SectionProps["h"];
}) {
  const [val, setVal] = useState(String(field.value));
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2">
      <p className="flex items-start gap-1.5 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {field.inconsistency ?? `Низкая уверенность в поле «${field.label}» — проверьте.`}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{field.label}</span>
        <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-8 flex-1 text-xs" />
        <Button size="sm" variant="outline" className="h-8" onClick={() => h.correctField(doc, field.key, val)}>
          <Pencil className="mr-1 h-3 w-3" />
          Исправить
        </Button>
      </div>
    </div>
  );
}

function BlockedNotice({ onConsent }: { onConsent: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-center">
      <ShieldAlert className="h-7 w-7 text-amber-500" />
      <div>
        <p className="font-medium">Действие заблокировано без согласия</p>
        <p className="text-sm text-muted-foreground">
          Загрузка документов и проверки по ИИН доступны только после подтверждённого согласия клиента (AC-001).
        </p>
      </div>
      <Button className="bg-[#15325B] hover:bg-[#15325B]/90" onClick={onConsent}>
        <ShieldCheck className="mr-2 h-4 w-4" />
        Отправить SMS-согласие
      </Button>
    </div>
  );
}

// ============================================================================
// Секция 3 — Распознанные данные и решение
// ============================================================================

export function SectionAnalysis({ state, h }: SectionProps) {
  const docsOk =
    state.documents.creditHistory.status === "confirmed" && state.documents.enpf.status === "confirmed";
  const completion: SectionCompletion = !docsOk ? "locked" : state.snapshotConfirmed ? "done" : "active";
  const a = state.analysis;

  return (
    <SectionShell
      order={3}
      title="Распознанные данные и решение"
      completion={completion}
      hint="Ни одна программа не получает зелёный результат при неполных или устаревших данных."
      headerRight={
        a ? (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Текущий КДН</div>
            <div className={cn("text-lg font-bold", a.currentKdn > 50 ? "text-red-600" : a.currentKdn > 45 ? "text-amber-600" : "text-emerald-600")}>
              {formatPercent(a.currentKdn)}
            </div>
          </div>
        ) : undefined
      }
    >
      {!docsOk ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Секция откроется после подтверждения кредитной истории и выписки ЕНПФ.
        </p>
      ) : !a ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">Документы подтверждены. Запустите анализ программ.</p>
          <Button className="bg-[#15325B] hover:bg-[#15325B]/90" onClick={h.runAnalysis}>
            <Play className="mr-2 h-4 w-4" />
            Запустить анализ
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Принимаемый доход" value={formatTenge(a.acceptedIncome)} />
            <Metric label="Платёж по ипотеке" value={formatTenge(a.proposedPayment)} />
            <Metric label="Тек. обязательства" value={formatTenge(state.client?.existingMonthlyPayment ?? 0)} />
            <Metric label="КДН" value={formatPercent(a.currentKdn)} />
          </div>

          {/* Обязательства */}
          {state.obligations.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium">Обязательства из кредитной истории</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Кредитор</TableHead>
                    <TableHead>Остаток</TableHead>
                    <TableHead>Ставка</TableHead>
                    <TableHead className="text-right">Платёж/мес</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.obligations.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{o.creditor}<span className="block text-xs text-muted-foreground">{o.productType}</span></TableCell>
                      <TableCell className="text-sm">{formatTenge(o.outstandingBalance)}</TableCell>
                      <TableCell className="text-sm">{formatPercent(o.annualRate)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatTenge(o.monthlyPayment)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Вердикты программ */}
          <div>
            <p className="mb-1.5 text-sm font-medium">Вердикты по программам</p>
            <div className="space-y-2">
              {a.programResults.map((p) => {
                const v = VERDICT_LABEL[p.verdict];
                const fr = FRESHNESS_LABEL[p.freshness];
                return (
                  <div key={p.programId} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{p.programName}</span>
                        <span className="ml-2 text-sm text-muted-foreground">{p.bank} · {formatPercent(p.rate, 0)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge tone={fr.tone} className="text-[11px]">{fr.text} · {p.verifiedAt}</StatusBadge>
                        <StatusBadge tone={v.tone}>{v.text}</StatusBadge>
                      </div>
                    </div>
                    {p.blockingReasons.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {p.blockingReasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Info className="mt-0.5 h-3 w-3 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Недостающие данные */}
          {a.missingData.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Недостающие данные
              </p>
              <ul className="mt-1.5 list-inside list-disc text-xs text-amber-800">
                {a.missingData.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          {!state.snapshotConfirmed ? (
            <Button className="w-full bg-[#15325B] hover:bg-[#15325B]/90" onClick={h.confirmSnapshot}>
              Подтвердить данные (создать неизменяемый снимок)
            </Button>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-700">
              <FileCheck2 className="h-4 w-4" />
              Снимок клиента зафиксирован — расчёты воспроизводимы.
            </p>
          )}
        </div>
      )}
    </SectionShell>
  );
}

// --- мелкие хелперы ---------------------------------------------------------

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function AuditRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium tabular-nums">{v}</dd>
    </div>
  );
}

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
