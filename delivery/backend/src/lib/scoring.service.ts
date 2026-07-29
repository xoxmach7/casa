// Rule-based mortgage scoring, based on manually entered КИ (credit history)
// and ПО (average monthly pension contributions) — no external ЕНПФ/bureau
// integration yet. See docs/superpowers/specs for the design rationale.

export type CreditHistoryStatus = 'GOOD' | 'HAS_DELAYS' | 'BAD';
export type ApprovalLikelihood = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ScoringInput {
  monthlyIncome: number;
  creditHistoryStatus: CreditHistoryStatus;
  avgMonthlyPension: number;
  existingMonthlyDebt: number;
}

export interface ScoringResult {
  scoreValue: number;
  approvalLikelihood: ApprovalLikelihood;
  maxMonthlyPayment: number;
  maxLoanAmount: number;
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

export interface MatchedProgram extends MortgageProgramLike {
  estimatedMonthlyPayment: number;
}

/**
 * Programs whose annuity payment on the client's max loan amount, at that
 * program's own term, still fits within their max affordable monthly
 * payment — sorted by rate (cheapest first).
 */
export function matchPrograms(
  programs: MortgageProgramLike[],
  maxLoanAmount: number,
  maxMonthlyPayment: number
): MatchedProgram[] {
  if (maxLoanAmount <= 0 || maxMonthlyPayment <= 0) return [];

  return programs
    .map((program) => ({
      ...program,
      estimatedMonthlyPayment: Math.round(
        annuityMonthlyPayment(maxLoanAmount, program.interestRate, program.maxTerm)
      ),
    }))
    .filter((program) => program.estimatedMonthlyPayment <= maxMonthlyPayment)
    .sort((a, b) => a.interestRate - b.interestRate);
}
