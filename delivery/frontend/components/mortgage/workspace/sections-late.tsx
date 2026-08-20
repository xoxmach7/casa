"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  TrendingDown,
  Building2,
  MapPin,
  CalendarClock,
  Link2,
  FileText,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { formatTenge, formatPercent, formatNumber, recalcWhatIf } from "@/lib/mortgage/calc";
import type { SectionProps } from "./contracts";
import { SectionShell, StatusBadge, FIT_LABEL, type SectionCompletion } from "./ui";

// ============================================================================
// Секция 4 — Как провести клиента (сценарии)
// ============================================================================

export function SectionScenarios({ state, h }: SectionProps) {
  const ready = state.snapshotConfirmed;
  const done = Boolean(state.selectedScenarioId) || state.caseStatus === "scenario_selected";
  const completion: SectionCompletion = !ready ? "locked" : done ? "done" : "active";
  const scenarios = useMemo(() => [...state.scenarios].sort((a, b) => a.rank - b.rank), [state.scenarios]);

  return (
    <SectionShell
      order={4}
      title="Как провести клиента"
      completion={completion}
      hint="Минимальные проверяемые шаги, которые открывают программу или снижают нагрузку. По убыванию выгоды."
    >
      {!ready ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Секция откроется после подтверждения снимка клиента в разделе «Распознанные данные».
        </p>
      ) : scenarios.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">Сгенерировать сценарии по подтверждённому снимку.</p>
          <Button className="bg-[#15325B] hover:bg-[#15325B]/90" onClick={h.runAnalysis}>
            <Sparkles className="mr-2 h-4 w-4" />
            Построить сценарии
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => {
            const selected = state.selectedScenarioId === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  selected ? "border-[#15325B] ring-1 ring-[#15325B]/30 bg-[#15325B]/[0.03]" : "hover:border-muted-foreground/30",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#15325B] text-xs font-bold text-white">
                      {s.rank}
                    </span>
                    <div>
                      <p className="font-medium leading-tight">{s.title}</p>
                      <p className="text-sm text-muted-foreground">{s.summary}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {s.preliminary && <StatusBadge tone="amber" className="text-[11px]">Предварительно</StatusBadge>}
                    {typeof s.newKdn === "number" && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <TrendingDown className="h-3 w-3" /> КДН → {formatPercent(s.newKdn, 0)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {typeof s.cashRequired === "number" && s.cashRequired > 0 && (
                    <span>Нужно наличными: <b>{formatTenge(s.cashRequired)}</b></span>
                  )}
                  {typeof s.monthlySaving === "number" && s.monthlySaving > 0 && (
                    <span className="text-emerald-700">Экономия: <b>{formatTenge(s.monthlySaving)}/мес</b></span>
                  )}
                  {s.openedPrograms.length > 0 && (
                    <span>Открывает: <b>{s.openedPrograms.join(", ")}</b></span>
                  )}
                </div>

                {/* Дельты */}
                {s.deltas.length > 0 && (
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {s.deltas.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="ml-auto tabular-nums">{d.before}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className={cn("font-semibold tabular-nums", d.positive && "text-emerald-700")}>{d.after}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Требования + разбор рейтинга */}
                <Accordion type="single" collapsible className="mt-1">
                  <AccordionItem value="detail" className="border-b-0">
                    <AccordionTrigger className="py-1.5 text-xs text-muted-foreground">
                      Документы, действия и рейтинг
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ReqList title="Нужные документы" items={s.requiredDocuments} />
                        <ReqList title="Действия" items={s.requiredActions} />
                      </div>
                      <div className="mt-2 space-y-0.5">
                        {s.scoreBreakdown.map((f, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{f.factor} <span className="opacity-60">(вес {f.weight})</span></span>
                            <span>{f.note}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="mt-2 flex items-center gap-2">
                  {s.requiresVerifiedInput ? (
                    <Button variant="outline" size="sm" onClick={() => h.selectScenario(s.id)}>
                      <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                      Ввести подтверждённые условия
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className={selected ? "bg-[#15325B] hover:bg-[#15325B]/90" : ""}
                      onClick={() => h.selectScenario(s.id)}
                    >
                      {selected ? <><Check className="mr-1.5 h-3.5 w-3.5" /> Выбран</> : "Применить сценарий"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={h.acceptCurrentCase}>
            Принять текущий случай без сценария
          </Button>
        </div>
      )}
    </SectionShell>
  );
}

function ReqList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Секция 5 — Что если (live-пересчёт)
// ============================================================================

export function SectionWhatIf({ state, h }: SectionProps) {
  const base = state.analysis?.acceptedIncome ?? state.client?.confirmedIncome ?? 650000;
  const result = useMemo(() => recalcWhatIf(state.whatIf, base), [state.whatIf, base]);
  const w = state.whatIf;

  return (
    <SectionShell
      order={5}
      title="Что если"
      completion="optional"
      hint="Меняйте параметры — платёж, КДН и число программ пересчитываются мгновенно. Исходные данные клиента не меняются."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <SliderRow label="Стоимость квартиры" value={w.propertyPrice} display={formatTenge(w.propertyPrice)} min={10000000} max={80000000} step={500000} onChange={(v) => h.changeWhatIf({ propertyPrice: v })} />
          <SliderRow label="Первоначальный взнос" value={w.downPayment} display={formatTenge(w.downPayment)} min={0} max={w.propertyPrice} step={250000} onChange={(v) => h.changeWhatIf({ downPayment: v })} />
          <SliderRow label="Срок, мес" value={w.termMonths} display={`${w.termMonths} мес (${Math.round(w.termMonths / 12)} лет)`} min={12} max={360} step={12} onChange={(v) => h.changeWhatIf({ termMonths: v })} />
          <SliderRow label="Ставка" value={w.rate} display={formatPercent(w.rate)} min={5} max={25} step={0.1} onChange={(v) => h.changeWhatIf({ rate: v })} />
          <SliderRow label="Платёж по текущим долгам" value={w.existingDebtPayment} display={formatTenge(w.existingDebtPayment)} min={0} max={500000} step={5000} onChange={(v) => h.changeWhatIf({ existingDebtPayment: v })} />
          <SliderRow label="Доп. подтверждённый доход" value={w.additionalConfirmedIncome} display={formatTenge(w.additionalConfirmedIncome)} min={0} max={1000000} step={20000} onChange={(v) => h.changeWhatIf({ additionalConfirmedIncome: v })} />
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-[#15325B] p-4 text-white">
            <div className="text-sm opacity-80">Ежемесячный платёж</div>
            <div className="text-3xl font-bold tabular-nums">{formatTenge(result.monthlyPayment)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ResultTile label="Сумма кредита" value={formatTenge(result.loanAmount)} />
            <ResultTile label="Принимаемый доход" value={formatTenge(result.acceptedIncome)} />
            <ResultTile
              label="КДН"
              value={formatPercent(result.kdn)}
              tone={result.kdn > 50 ? "red" : result.kdn > 45 ? "amber" : "green"}
            />
            <ResultTile
              label="Открыто программ"
              value={`${result.eligibleProgramsCount} из 4`}
              tone={result.eligibleProgramsCount === 0 ? "red" : result.eligibleProgramsCount >= 3 ? "green" : "amber"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Демо-оценка. Предельный КДH и принимаемый доход определяются правилами конкретной версии программы банка.
          </p>
          <Button variant="outline" className="w-full" onClick={h.saveWhatIfScenario}>
            <Plus className="mr-2 h-4 w-4" />
            Сохранить как сценарий
          </Button>
        </div>
      </div>
    </SectionShell>
  );
}

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-medium tabular-nums">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function ResultTile({ label, value, tone }: { label: string; value: string; tone?: "red" | "amber" | "green" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "green" ? "text-emerald-600" : "text-foreground";
  return (
    <div className="rounded-lg border p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}

// ============================================================================
// Секция 6 — Подходящие квартиры в новостройках
// ============================================================================

export function SectionProperties({ state, h }: SectionProps) {
  const ready = state.snapshotConfirmed;
  const selectedCount = state.properties.filter((p) => p.inSelection).length;

  return (
    <SectionShell
      order={6}
      title="Подходящие квартиры в новостройках"
      completion="optional"
      hint="Только новостройки, прошедшие финансовые фильтры выбранного сценария. Свежесть цены и наличия — на карточке."
      headerRight={selectedCount > 0 ? <StatusBadge tone="navy">В подборке: {selectedCount}</StatusBadge> : undefined}
    >
      {!ready ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Подбор появится после подтверждения снимка и выбора сценария.
        </p>
      ) : state.properties.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">Подобрать квартиры под текущий финансовый сценарий.</p>
          <Button className="bg-[#15325B] hover:bg-[#15325B]/90" onClick={h.matchProperties}>
            <Building2 className="mr-2 h-4 w-4" />
            Подобрать квартиры
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {state.properties.map((p) => {
            const fit = FIT_LABEL[p.fit];
            return (
              <div key={p.id} className="flex flex-col rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium leading-tight">{p.developmentName}</p>
                    <p className="text-xs text-muted-foreground">{p.developerName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge tone={fit.tone}>{fit.text}</StatusBadge>
                    {p.demo && <span className="text-[10px] uppercase tracking-wide text-amber-600">демо</span>}
                  </div>
                </div>

                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {p.city}, {p.address}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {p.rooms}-комн · {p.areaSqm} м² · {p.floor} этаж · сдача: {p.completionDate}
                </p>

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <Kv k="Цена" v={formatTenge(p.price)} />
                  <Kv k="Мин. взнос" v={formatTenge(p.minimumDownPayment)} />
                  <Kv k="Кредит" v={formatTenge(p.estimatedLoanAmount)} />
                  <Kv k="Платёж" v={formatTenge(p.estimatedMonthlyPayment)} />
                  <Kv k="КДН" v={formatPercent(p.estimatedKdn, 0)} />
                </div>

                {p.fitReasons.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {p.fitReasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1 text-xs text-muted-foreground">
                        <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />{r}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  наличие: {p.availabilityCheckedAt} · аккредитация: {p.accreditationCheckedAt}
                </p>

                <div className="mt-auto pt-2">
                  <Button
                    size="sm"
                    variant={p.inSelection ? "default" : "outline"}
                    className={cn("w-full", p.inSelection && "bg-[#15325B] hover:bg-[#15325B]/90")}
                    disabled={p.fit === "does_not_fit"}
                    onClick={() => h.toggleSelection(p.id)}
                  >
                    {p.inSelection ? <><Check className="mr-1.5 h-3.5 w-3.5" /> В подборке</> : "Добавить в подборку"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

// ============================================================================
// Секция 7 — Следующее действие и заключение
// ============================================================================

export function SectionConclusion({ state, h }: SectionProps) {
  const [action, setAction] = useState(state.nextAction?.action ?? "Рефинансировать потребкредит и повторно запросить Баспана Хит");
  const [due, setDue] = useState(state.nextAction?.dueDate ?? "");
  const saved = Boolean(state.nextAction?.savedAt);
  const completion: SectionCompletion = saved ? "done" : "active";

  return (
    <SectionShell
      order={7}
      title="Следующее действие и заключение"
      completion={completion}
      hint="Зафиксируйте следующий шаг и сформируйте безопасное клиентское заключение (без ИИН и внутренних заметок)."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Следующее лучшее действие</Label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Срок</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-48" />
          </div>
          <Button className="bg-[#15325B] hover:bg-[#15325B]/90" onClick={() => h.saveNextAction(action, due || undefined)}>
            <Check className="mr-2 h-4 w-4" />
            Сохранить решение по клиенту
          </Button>
          {saved && (
            <p className="text-xs text-emerald-700">
              Сохранено {new Date(state.nextAction!.savedAt!).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Заключение для клиента</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!saved} onClick={h.generateLink}>
              <Link2 className="mr-2 h-3.5 w-3.5" />
              Создать ссылку
            </Button>
            <Button variant="outline" size="sm" disabled={!saved} onClick={h.generatePdf}>
              <FileText className="mr-2 h-3.5 w-3.5" />
              Сформировать PDF
            </Button>
          </div>

          {state.conclusion?.publicLink && (
            <div className="rounded-md bg-muted p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={state.conclusion.publicLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-mono text-[#15325B] underline-offset-2 hover:underline"
                >
                  {state.conclusion.publicLink}
                </a>
                <StatusBadge tone="green" className="text-[10px]">активна</StatusBadge>
              </div>
              <p className="mt-1 text-muted-foreground">
                Действует до {state.conclusion.expiresAt} · без индексации · ИИН и документы скрыты
              </p>
            </div>
          )}
          {state.conclusion?.pdfReady && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700">
              <FileText className="h-3.5 w-3.5" /> PDF сформирован (демо)
            </p>
          )}
          {!saved && (
            <p className="text-xs text-muted-foreground">Сначала сохраните следующее действие.</p>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
