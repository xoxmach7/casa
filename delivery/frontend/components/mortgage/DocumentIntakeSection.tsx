"use client";

/**
 * Документы клиента (M03 кредитная история / M04 выписка ЕНПФ).
 *
 * Это второй шаг рабочего сценария брокера: ИИН → два документа → расчёт.
 * Блок был ошибочно снят при вычистке демо-поверхностей и возвращён: убирать
 * следовало моки и расчёты на клиенте, а не сам приём документов.
 *
 * Что здесь есть и чего здесь нет:
 *  - загрузка PDF и показ РАСПОЗНАННЫХ полей с их достоверностью — есть;
 *  - собственных вычислений нет: компонент показывает то, что вернул парсер,
 *    и не превращает распознанное в вывод о клиенте;
 *  - поле с низкой уверенностью или UNKNOWN помечается и требует проверки
 *    человеком, а не молча идёт в расчёт.
 *
 * Приём идёт на действующий парсер `/mortgage-workspace/documents`. Когда будут
 * готовы канонические M03/M04 (immutable document/version, hash, quarantine,
 * lineages, reconciliation, snapshot), переключение произойдёт здесь — UX
 * брокера не изменится.
 */

import { useCallback, useState } from "react";
import { FileUp, TriangleAlert, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api-client";

type DocType = "credit_history" | "enpf_statement";

interface ExtractedField {
  key: string;
  label: string;
  value: string;
  presence: string;
  confidence: number;
  critical?: boolean;
}

/**
 * Машинные значения парсера → человеческий язык. Брокер не обязан знать, что
 * FULL_PERSONAL — это полный персональный отчёт, а 010 — код ОПВ.
 */
const VALUE_LABEL: Record<string, string> = {
  FCB: "Первое кредитное бюро (ПКБ)",
  SCB: "Государственное кредитное бюро (ГКБ)",
  FULL_PERSONAL: "Полный персональный кредитный отчёт",
  PROCESSED: "Обработанные",
  BLANK: "нет данных",
  UNKNOWN: "нет данных",
  NOT_APPLICABLE: "неприменимо",
  OPV: "ОПВ — обязательные пенсионные взносы",
  OPPV: "ОППВ — обязательные профессиональные взносы",
  OPVR: "ОПВР — взносы работодателя",
  DPV: "ДПВ — добровольные взносы",
  PENALTY_OPV: "Пеня по ОПВ",
  PENALTY_OPPV: "Пеня по ОППВ",
  PENALTY_OPVR: "Пеня по ОПВР",
};

/** Подписи полей, где парсер говорит своим внутренним словарём. */
const FIELD_LABEL_OVERRIDE: Record<string, string> = {
  bureau: "Кредитное бюро",
  report_generated_at: "Дата формирования отчёта",
  report_pages_declared: "Страниц в отчёте",
  bureau_rating: "Кредитный рейтинг бюро (ПКР)",
  active_contracts_detected: "Действующих договоров",
  current_dpd_active: "Текущая просрочка, дней",
  max_dpd_lifetime_reported: "Максимальная просрочка за всё время, дней",
  existing_monthly_payment: "Платежи по действующим кредитам в месяц, ₸",
  payment_code: "Код назначения платежа (КНП)",
  report_query_period: "Период, за который запрошена выписка",
  source_status: "Статус строк выписки",
  observed_month_count: "Месяцев с взносами в выписке",
  observed_amount_avg: "Средний взнос, ₸",
  estimated_contribution_base: "Расчётная база по пенсионным взносам",
};

/** Деньги и счётчики — с разрядами, а не 3318060.48. */
function formatValue(label: string, raw: string): string {
  if (VALUE_LABEL[raw]) return VALUE_LABEL[raw];
  const money = /^-?\d+(?:[.,]\d{1,2})?$/.test(raw);
  if (!money) return raw;
  const [whole, fraction] = raw.replace(",", ".").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const withFraction = fraction ? `${grouped},${fraction.padEnd(2, "0")}` : grouped;
  return label.includes("₸") ? `${withFraction} ₸` : withFraction;
}

/** «CODE: человеческое объяснение» → объяснение (код уходит в подсказку). */
function splitGate(gate: string): { code: string | null; text: string } {
  const m = gate.match(/^([A-Z_]+):\s*([\s\S]+)$/);
  return m ? { code: m[1], text: m[2] } : { code: null, text: gate };
}

interface DocState {
  fileName?: string;
  fields: ExtractedField[];
  gates: string[];
  notes: string[];
  stored?: boolean;
  busy?: boolean;
}

const TITLES: Record<DocType, string> = {
  credit_history: "Кредитная история (ПКБ)",
  enpf_statement: "Выписка ЕНПФ",
};

const EMPTY: DocState = { fields: [], gates: [], notes: [] };

export function DocumentIntakeSection({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Record<DocType, DocState>>({
    credit_history: { ...EMPTY },
    enpf_statement: { ...EMPTY },
  });

  const upload = useCallback(async (type: DocType, file: File) => {
    setDocs((p) => ({ ...p, [type]: { ...p[type], busy: true, fileName: file.name } }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      fd.append("case_id", caseId);
      const res = await fetch(`${API_URL}/mortgage-workspace/documents`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();

      const fields: ExtractedField[] = (Array.isArray(d.extraction?.fields) ? d.extraction.fields : [])
        .map((f: any) => {
          const label = FIELD_LABEL_OVERRIDE[f.key] ?? f.label;
          // rawValue — то, что написано в документе по-человечески;
          // normalizedValue — машинный код для расчёта. Показываем человеку
          // первое: раньше приоритет был обратный, и брокер видел FULL_PERSONAL.
          // Нераспознанное остаётся «нет данных», а не превращается в ноль.
          const source = f.rawValue ?? f.normalizedValue;
          return {
            key: f.key,
            label,
            value: source === null || source === undefined
              ? "нет данных"
              : formatValue(label, String(source)),
            presence: f.presence,
            confidence: typeof f.confidence === "number" ? f.confidence : 0,
            critical: f.critical,
          };
        });

      setDocs((p) => ({
        ...p,
        [type]: {
          fileName: file.name,
          fields,
          gates: d.extraction?.gates ?? [],
          notes: d.extraction?.notes ?? [],
          stored: !!d.stored,
          busy: false,
        },
      }));
      toast({
        title: "Документ сохранён и распознан",
        description: "Поля извлечены из текстового слоя PDF.",
      });
    } catch {
      setDocs((p) => ({ ...p, [type]: { ...p[type], busy: false } }));
      toast({
        title: "Не удалось загрузить",
        description: "Сервер недоступен или файл не PDF.",
        variant: "destructive",
      });
    }
  }, [caseId, toast]);

  return (
    <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <FileUp className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
        <div>
          <h2 className="text-base font-semibold leading-tight">Шаг 1. Документы клиента</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Кредитная история (ПКБ) и выписка ЕНПФ. PDF до 25 МБ, распознавание из
            текстового слоя. Распознанное значение — не вывод о клиенте: поля с низкой
            уверенностью проверяет человек.
          </p>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
        {(["credit_history", "enpf_statement"] as const).map((type) => {
          const doc = docs[type];
          return (
            <div key={type} className="rounded-lg border border-border p-4" data-testid={`doc-${type}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{TITLES[type]}</p>
                {doc.stored && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    сохранён
                  </span>
                )}
              </div>

              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
                <FileUp className="h-4 w-4" aria-hidden />
                <span>{doc.busy ? "Загрузка…" : doc.fileName ?? "Выбрать PDF"}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(type, f);
                  }}
                />
              </label>

              {doc.fields.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {doc.fields.slice(0, 10).map((f) => {
                    const uncertain = f.confidence < 0.7 || f.presence === "UNKNOWN";
                    return (
                      <li key={f.key} className="flex justify-between gap-2 border-b border-border/60 pb-1">
                        <span className="text-muted-foreground">{f.label}</span>
                        <span
                          className={cn(
                            "text-right tabular-nums",
                            uncertain && "text-amber-600 dark:text-amber-400",
                          )}
                          title={uncertain ? "Низкая уверенность распознавания — требуется проверка" : undefined}
                        >
                          {f.value}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {doc.gates.length > 0 && (
                <div className="mt-3 rounded-md bg-muted/40 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    Проверить вручную
                  </p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {doc.gates.map((gate) => {
                      const { code, text } = splitGate(gate);
                      return (
                        // Код гейта остаётся в подсказке: он нужен поддержке
                        // и аудиту, но брокеру про CONTRACT_REQUIRED читать нечего.
                        <li key={gate} title={code ?? undefined}>{text}</li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
