/**
 * Расчётные формулы CASA Pro Ипотека (calculation_engine.formulas в ТЗ).
 *
 * Отображаемые суммы — целые тенге; внутренний счёт — с плавающей точкой
 * (money_rounding). Значения предварительные: состав дохода/обязательств и
 * предельный КДН определяются правилами конкретной версии программы банка.
 */

import type { WhatIfInputs, WhatIfResult } from "./types";

/** Аннуитетный платёж: P * r * (1+r)^n / ((1+r)^n - 1). */
export function annuityPayment(principal: number, annualRatePercent: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePercent / 100 / 12;
  if (r <= 0) return principal / termMonths;
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

/** Предварительный КДН, %: (существующие обязательства + новый платёж) / доход * 100. */
export function preliminaryKdn(
  existingMonthlyObligations: number,
  proposedMortgagePayment: number,
  acceptedConfirmedIncome: number,
): number {
  if (acceptedConfirmedIncome <= 0) return 0;
  return ((existingMonthlyObligations + proposedMortgagePayment) / acceptedConfirmedIncome) * 100;
}

/** Недостаток первоначального взноса: max(0, required - available). */
export function downPaymentGap(required: number, available: number): number {
  return Math.max(0, required - available);
}

/** Сумма кредита: цена - взнос. */
export function loanAmount(propertyPrice: number, downPayment: number): number {
  return Math.max(0, propertyPrice - downPayment);
}

/**
 * Демо-порог КДН для подсветки в интерфейсе. НЕ банковское правило — реальный
 * предел приходит из версии программы. На Phase 0 используется только чтобы
 * показать «сколько программ открылось» на моке.
 */
export const DEMO_KDN_LIMIT = 50;

/** Live-пересчёт секции «Что если» (мок-версия движка). */
export function recalcWhatIf(inputs: WhatIfInputs, baseAcceptedIncome: number): WhatIfResult {
  const principal = loanAmount(inputs.propertyPrice, inputs.downPayment);
  const monthlyPayment = annuityPayment(principal, inputs.rate, inputs.termMonths);
  const acceptedIncome = baseAcceptedIncome + Math.max(0, inputs.additionalConfirmedIncome);
  const kdn = preliminaryKdn(inputs.existingDebtPayment, monthlyPayment, acceptedIncome);

  // Демонстрационная связь КДН → число открытых программ (мок): чем ниже
  // нагрузка, тем больше условно доступных программ из стартового набора.
  let eligibleProgramsCount = 0;
  if (kdn <= 35) eligibleProgramsCount = 4;
  else if (kdn <= 45) eligibleProgramsCount = 3;
  else if (kdn <= DEMO_KDN_LIMIT) eligibleProgramsCount = 1;
  else eligibleProgramsCount = 0;

  return {
    loanAmount: Math.round(principal),
    monthlyPayment: Math.round(monthlyPayment),
    kdn: Math.round(kdn * 10) / 10,
    acceptedIncome: Math.round(acceptedIncome),
    eligibleProgramsCount,
  };
}

// --- Форматирование ----------------------------------------------------------

const nf = new Intl.NumberFormat("ru-RU");

export function formatTenge(value: number): string {
  return `${nf.format(Math.round(value))} ₸`;
}

export function formatNumber(value: number): string {
  return nf.format(Math.round(value));
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
