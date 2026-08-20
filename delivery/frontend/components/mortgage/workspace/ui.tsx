"use client";

/**
 * Общие визуальные хелперы рабочего экрана ипотеки: русские подписи и цвета
 * статусов + обёртка секции с порядковым номером и состоянием выполнения.
 *
 * Статус нигде не передаётся только цветом (non_functional_requirements:
 * status_not_conveyed_by_color_only) — везде рядом текст/иконка.
 */

import { Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ConsentStatus,
  DocumentStatus,
  ProgramVerdict,
  PropertyFit,
  ProgramFreshness,
  IinCheckStatus,
} from "@/lib/mortgage/types";

type Tone = "navy" | "green" | "amber" | "red" | "gray" | "blue";

const TONE_CLASS: Record<Tone, string> = {
  navy: "bg-[#15325B] text-white hover:bg-[#15325B]",
  green: "bg-emerald-600 text-white hover:bg-emerald-600",
  amber: "bg-amber-500 text-white hover:bg-amber-500",
  red: "bg-red-600 text-white hover:bg-red-600",
  gray: "bg-muted text-muted-foreground hover:bg-muted",
  blue: "bg-sky-600 text-white hover:bg-sky-600",
};

export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <Badge className={cn(TONE_CLASS[tone], "font-medium", className)}>{children}</Badge>;
}

// --- Согласие ---------------------------------------------------------------

export const CONSENT_LABEL: Record<ConsentStatus, { text: string; tone: Tone }> = {
  not_requested: { text: "Не запрошено", tone: "gray" },
  sms_pending: { text: "Отправлено, ждём клиента", tone: "amber" },
  link_opened: { text: "Клиент открыл ссылку", tone: "blue" },
  confirmed: { text: "Согласие подтверждено", tone: "green" },
  rejected: { text: "Отклонено клиентом", tone: "red" },
  expired: { text: "Истекло", tone: "gray" },
  revoked: { text: "Отозвано", tone: "red" },
};

// --- Документы --------------------------------------------------------------

export const DOC_LABEL: Record<DocumentStatus, { text: string; tone: Tone }> = {
  missing: { text: "Нет файла", tone: "gray" },
  uploading: { text: "Загрузка…", tone: "blue" },
  uploaded: { text: "Загружен", tone: "blue" },
  scanning: { text: "Проверка на вирусы…", tone: "blue" },
  processing: { text: "Распознавание…", tone: "blue" },
  needs_review: { text: "Нужна ручная проверка", tone: "amber" },
  confirmed: { text: "Подтверждён", tone: "green" },
  rejected: { text: "Отклонён", tone: "red" },
  expired: { text: "Устарел", tone: "gray" },
  processing_failed: { text: "Ошибка обработки", tone: "red" },
};

// --- Вердикты программ ------------------------------------------------------

export const VERDICT_LABEL: Record<ProgramVerdict, { text: string; tone: Tone }> = {
  eligible_by_known_rules: { text: "Проходит по известным правилам", tone: "green" },
  potentially_eligible: { text: "Условно проходит", tone: "amber" },
  not_eligible: { text: "Не проходит", tone: "red" },
  insufficient_data: { text: "Недостаточно данных", tone: "gray" },
  manual_bank_confirmation_required: { text: "Нужно подтверждение банка", tone: "blue" },
};

export const FRESHNESS_LABEL: Record<ProgramFreshness, { text: string; tone: Tone }> = {
  officially_verified: { text: "Официально проверено", tone: "green" },
  bank_confirmed: { text: "Подтверждено банком", tone: "green" },
  observed_requires_confirmation: { text: "Наблюдение, требует подтверждения", tone: "amber" },
  stale_requires_review: { text: "Устарело, требует ревизии", tone: "amber" },
  changed_unpublished: { text: "Изменено, не опубликовано", tone: "amber" },
  archived: { text: "В архиве", tone: "gray" },
};

// --- Пригодность квартиры ---------------------------------------------------

export const FIT_LABEL: Record<PropertyFit, { text: string; tone: Tone }> = {
  fits_now: { text: "Подходит сейчас", tone: "green" },
  fits_after_selected_scenario: { text: "Подойдёт после сценария", tone: "amber" },
  does_not_fit: { text: "Не подходит", tone: "red" },
  availability_check_required: { text: "Проверить наличие", tone: "blue" },
  accreditation_check_required: { text: "Проверить аккредитацию", tone: "blue" },
};

// --- Проверка по ИИН --------------------------------------------------------

export const IIN_LABEL: Record<IinCheckStatus, { text: string; tone: Tone }> = {
  not_started: { text: "Не запускалась", tone: "gray" },
  in_progress: { text: "Выполняется…", tone: "blue" },
  verified_no_records: { text: "Проверено: записей нет", tone: "green" },
  records_found: { text: "Найдены записи", tone: "amber" },
  source_unavailable: { text: "Источник недоступен", tone: "amber" },
  manual_check_required: { text: "Нужна ручная проверка", tone: "amber" },
  not_authorized: { text: "Нет доступа", tone: "red" },
};

// --- Обёртка секции ---------------------------------------------------------

export type SectionCompletion = "locked" | "active" | "done" | "optional";

export function SectionShell({
  order,
  title,
  completion,
  hint,
  headerRight,
  children,
}: {
  order: number;
  title: string;
  completion: SectionCompletion;
  hint?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const locked = completion === "locked";
  return (
    <section
      id={`mortgage-section-${order}`}
      className={cn(
        "rounded-xl border bg-card shadow-sm scroll-mt-24 transition-opacity",
        locked && "opacity-60",
      )}
      aria-disabled={locked}
    >
      <header className="flex items-start gap-3 border-b p-4">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            completion === "done"
              ? "bg-emerald-600 text-white"
              : locked
                ? "bg-muted text-muted-foreground"
                : "bg-[#15325B] text-white",
          )}
          aria-hidden
        >
          {completion === "done" ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-4 w-4" /> : order}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
