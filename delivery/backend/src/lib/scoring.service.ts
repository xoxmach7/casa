// Rule-based mortgage scoring, based on manually entered КИ (credit history)
// and ПО (average monthly pension contributions) — no external ЕНПФ/bureau
// integration yet. See docs/superpowers/specs for the design rationale.

export type CreditHistoryStatus = 'GOOD' | 'HAS_DELAYS' | 'BAD';
export type ApprovalLikelihood = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export interface ScoringInput {
  monthlyIncome: number;
  creditHistoryStatus: CreditHistoryStatus;
  avgMonthlyPension: number;
  existingMonthlyDebt: number;
  // Собственный первоначальный взнос клиента — прибавляется к максимальной
  // сумме кредита, чтобы получить максимальную стоимость квартиры (ТЗ 9.4:
  // max_property_price = max_loan + available_down_payment).
  downPayment: number;
}

export interface ScoringResult {
  scoreValue: number;
  approvalLikelihood: ApprovalLikelihood;
  maxMonthlyPayment: number;
  maxLoanAmount: number;
  maxPropertyPrice: number;
  advice: string[];
}

// Default assumptions used only to translate an affordability ceiling into a
// loan amount when the broker hasn't picked a specific bank program yet.
const DEFAULT_TERM_MONTHS = 240; // 20 years
const DEFAULT_ANNUAL_RATE = 15; // percent

// Kazakhstan employers pay 10% of official salary into ЕНПФ — a monthly
// contribution near that ratio signals a fully "white" declared income.
const EXPECTED_PENSION_RATIO = 0.1;
const MAX_HEALTHY_DTI = 0.4;
const MAX_DEBT_SERVICE_RATIO = 0.5;

// Fallback when neither the broker nor the client profile supplied an
// income: ЕНПФ contributions are ~10% of official salary, so a monthly
// pension figure can be inverted into a rough income estimate.
export function estimateIncomeFromPension(avgMonthlyPension: number): number {
  if (avgMonthlyPension <= 0) return 0;
  return Math.round(avgMonthlyPension / EXPECTED_PENSION_RATIO);
}

function creditHistoryPoints(status: CreditHistoryStatus): number {
  switch (status) {
    case 'GOOD':
      return 40;
    case 'HAS_DELAYS':
      return 20;
    case 'BAD':
      return 0;
  }
}

function pensionPoints(avgMonthlyPension: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return 0;
  const ratio = avgMonthlyPension / monthlyIncome;
  return Math.max(0, Math.min(30, (ratio / EXPECTED_PENSION_RATIO) * 30));
}

function debtLoadPoints(existingMonthlyDebt: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return 0;
  const dti = existingMonthlyDebt / monthlyIncome;
  return Math.max(0, 30 * (1 - Math.min(dti, 1)));
}

function annuityPrincipal(monthlyPayment: number, annualRate: number, termMonths: number): number {
  if (monthlyPayment <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate <= 0) return monthlyPayment * termMonths;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (monthlyPayment * (factor - 1)) / (monthlyRate * factor);
}

export function annuityMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (principal <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate <= 0) return principal / termMonths;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

export function computeScoring(input: ScoringInput): ScoringResult {
  // No usable income signal at all — nothing below is trustworthy enough to
  // give a real verdict (ТЗ 9.6: "High/Medium/Low/Insufficient Data").
  const hasIncomeSignal = input.monthlyIncome > 0 || input.avgMonthlyPension > 0;

  if (!hasIncomeSignal) {
    return {
      scoreValue: 0,
      approvalLikelihood: 'INSUFFICIENT_DATA',
      maxMonthlyPayment: 0,
      maxLoanAmount: 0,
      maxPropertyPrice: Math.round(Math.max(0, input.downPayment)),
      advice: [
        'Недостаточно данных: не удалось определить ни доход, ни пенсионные отчисления клиента. Загрузите документы или уточните доход вручную.',
      ],
    };
  }

  const scoreValue = Math.round(
    creditHistoryPoints(input.creditHistoryStatus) +
      pensionPoints(input.avgMonthlyPension, input.monthlyIncome) +
      debtLoadPoints(input.existingMonthlyDebt, input.monthlyIncome)
  );

  const approvalLikelihood: ApprovalLikelihood =
    scoreValue >= 70 ? 'HIGH' : scoreValue >= 40 ? 'MEDIUM' : 'LOW';

  const maxMonthlyPayment = Math.max(
    0,
    input.monthlyIncome * MAX_DEBT_SERVICE_RATIO - input.existingMonthlyDebt
  );
  const maxLoanAmount = annuityPrincipal(maxMonthlyPayment, DEFAULT_ANNUAL_RATE, DEFAULT_TERM_MONTHS);
  const maxPropertyPrice = maxLoanAmount + Math.max(0, input.downPayment);

  const advice: string[] = [];

  if (input.creditHistoryStatus === 'BAD') {
    advice.push(
      'Кредитная история с активной просрочкой — банки, скорее всего, откажут. Сначала закройте текущие просрочки.'
    );
  } else if (input.creditHistoryStatus === 'HAS_DELAYS') {
    advice.push(
      'В прошлом были просрочки — рассматривайте банки со смягчёнными требованиями и увеличьте первоначальный взнос.'
    );
  } else {
    advice.push('Кредитная история хорошая — это увеличивает шансы на одобрение.');
  }

  const pensionRatio = input.monthlyIncome > 0 ? input.avgMonthlyPension / input.monthlyIncome : 0;
  if (pensionRatio < EXPECTED_PENSION_RATIO / 2) {
    advice.push(
      'Пенсионные отчисления низкие относительно дохода — банк может не учесть часть дохода как официальную. Рассмотрите созаёмщика или подтверждение дополнительного дохода.'
    );
  } else {
    advice.push('Пенсионные отчисления подтверждают официальный доход — это плюс при одобрении.');
  }

  const dtiRatio = input.monthlyIncome > 0 ? input.existingMonthlyDebt / input.monthlyIncome : 0;
  if (dtiRatio > MAX_HEALTHY_DTI) {
    advice.push('Высокая долговая нагрузка по текущим обязательствам — уменьшите сумму кредита или увеличьте первоначальный взнос.');
  }

  if (scoreValue >= 70) {
    advice.push('Хорошие показатели — можно рассматривать премиальные программы с низкой ставкой.');
  }

  return {
    scoreValue,
    approvalLikelihood,
    maxMonthlyPayment: Math.round(maxMonthlyPayment),
    maxLoanAmount: Math.round(maxLoanAmount),
    maxPropertyPrice: Math.round(maxPropertyPrice),
    advice,
  };
}

export interface MortgageProgramLike {
  id: string;
  bankName: string;
  programName: string;
  interestRate: number;
  maxTerm: number;
}

export type ProgramSuitability = 'SUITABLE' | 'CONDITIONALLY_SUITABLE' | 'UNSUITABLE';

export interface MatchedProgram extends MortgageProgramLike {
  estimatedMonthlyPayment: number;
  suitability: ProgramSuitability;
  reason: string;
}

// A payment up to 15% over the computed ceiling is "conditionally suitable"
// (worth discussing with the bank — e.g. a slightly longer term might close
// the gap); further over is not realistically actionable for this client.
const CONDITIONAL_OVERAGE_RATIO = 1.15;

/**
 * Classifies every program as suitable / conditionally suitable / unsuitable
 * against the client's max loan amount and affordable monthly payment (ТЗ
 * 9.5-9.6: "подходящие, условно подходящие и неподходящие программы с
 * причинами"), sorted best-first.
 */
export function matchPrograms(
  programs: MortgageProgramLike[],
  maxLoanAmount: number,
  maxMonthlyPayment: number
): MatchedProgram[] {
  if (maxLoanAmount <= 0 || maxMonthlyPayment <= 0) {
    return programs.map((program) => ({
      ...program,
      estimatedMonthlyPayment: 0,
      suitability: 'UNSUITABLE',
      reason: 'Недостаточно данных о доходе клиента, чтобы оценить доступный кредит.',
    }));
  }

  return programs
    .map((program) => {
      const estimatedMonthlyPayment = Math.round(
        annuityMonthlyPayment(maxLoanAmount, program.interestRate, program.maxTerm)
      );
      const ratio = estimatedMonthlyPayment / maxMonthlyPayment;

      let suitability: ProgramSuitability;
      let reason: string;
      if (ratio <= 1) {
        suitability = 'SUITABLE';
        reason = 'Расчётный платёж укладывается в доступный клиенту бюджет.';
      } else if (ratio <= CONDITIONAL_OVERAGE_RATIO) {
        suitability = 'CONDITIONALLY_SUITABLE';
        reason = `Платёж превышает расчётный максимум примерно на ${Math.round((ratio - 1) * 100)}% — обсудите с банком больший срок или частичное досрочное погашение.`;
      } else {
        suitability = 'UNSUITABLE';
        reason = 'Расчётный платёж значительно превышает доступный клиенту бюджет.';
      }

      return { ...program, estimatedMonthlyPayment, suitability, reason };
    })
    .sort((a, b) => {
      const rank: Record<ProgramSuitability, number> = { SUITABLE: 0, CONDITIONALLY_SUITABLE: 1, UNSUITABLE: 2 };
      if (rank[a.suitability] !== rank[b.suitability]) return rank[a.suitability] - rank[b.suitability];
      return a.interestRate - b.interestRate;
    });
}
