/**
 * CASA Pro Ипотека — типизированные модели фронтенда (Phase 0).
 *
 * Источник правды — CASA_Pro_Ipoteka_Project_Spec_v1.1.json (раздел entities,
 * state_machines, *_enum). Здесь только формы данных, которыми оперирует единый
 * рабочий экран; сетевые контракты — в docs/casa-pro-ipoteka/openapi-draft.yaml.
 *
 * ВАЖНО: на этом этапе всё наполняется мок-данными (см. lib/mortgage/mock.ts).
 * Ни одно значение не является банковским решением — CASA формирует
 * предварительное заключение (см. product_definition.decision_boundary).
 */

// --- Перечисления состояний (state_machines / *_enum) -----------------------

export type CaseStatus =
  | "new"
  | "consent_required"
  | "waiting_for_consent"
  | "documents_required"
  | "documents_processing"
  | "data_review_required"
  | "ready_for_analysis"
  | "analysis_ready"
  | "scenario_selected"
  | "property_selection_ready"
  | "ready_for_application"
  | "on_hold"
  | "closed";

export type ConsentStatus =
  | "not_requested"
  | "sms_pending"
  | "link_opened"
  | "confirmed"
  | "rejected"
  | "expired"
  | "revoked";

export type DocumentStatus =
  | "missing"
  | "uploading"
  | "uploaded"
  | "scanning"
  | "processing"
  | "needs_review"
  | "confirmed"
  | "rejected"
  | "expired"
  | "processing_failed";

export type IinCheckStatus =
  | "not_started"
  | "in_progress"
  | "verified_no_records"
  | "records_found"
  | "source_unavailable"
  | "manual_check_required"
  | "not_authorized";

export type ProgramVerdict =
  | "eligible_by_known_rules"
  | "potentially_eligible"
  | "not_eligible"
  | "insufficient_data"
  | "manual_bank_confirmation_required";

export type PropertyFit =
  | "fits_now"
  | "fits_after_selected_scenario"
  | "does_not_fit"
  | "availability_check_required"
  | "accreditation_check_required";

export type RuleStatus = "pass" | "fail" | "unknown" | "manual";

export type ProgramFreshness =
  | "officially_verified"
  | "bank_confirmed"
  | "observed_requires_confirmation"
  | "stale_requires_review"
  | "changed_unpublished"
  | "archived";

export type ScenarioType =
  | "increase_down_payment"
  | "close_obligation"
  | "refinance_high_rate_debt"
  | "partial_early_repayment"
  | "increase_confirmed_income"
  | "lower_property_budget"
  | "add_co_borrower"
  | "wait_for_history";

// --- Клиент и анкета --------------------------------------------------------

export interface MortgageClient {
  id: string;
  fullName: string;
  phone: string;
  /** Всегда маскированный на фронте — полный ИИН недоступен UI (см. security). */
  iinMasked: string;
  city: string;
  age?: number;
  confirmedIncome?: number;
  existingMonthlyPayment?: number;
  outstandingDebt?: number;
  downPayment?: number;
  desiredPropertyPrice?: number;
  comfortableMonthlyPayment?: number;
  desiredTermMonths?: number;
  pensionStability?: "stable" | "gaps" | "unknown";
}

// --- Согласие (consent) -----------------------------------------------------

export interface ConsentAudit {
  consentId: string;
  phoneMasked: string;
  consentTextVersion: string;
  method: string;
  requestedAt?: string;
  openedAt?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  revokedAt?: string;
  purposes: string[];
  smsProviderMessageId?: string;
}

export interface ConsentState {
  status: ConsentStatus;
  audit?: ConsentAudit;
  linkTtlMinutes: number;
  otpTtlMinutes: number;
}

// --- Документы --------------------------------------------------------------

export interface ExtractedField<T = string | number> {
  key: string;
  label: string;
  value: T;
  /** 0..1 — уверенность распознавания. < 0.7 блокирует скоринг. */
  confidence: number;
  page?: number;
  confirmed: boolean;
  /** Найденное системой противоречие, требующее ручной проверки. */
  inconsistency?: string;
}

export interface ClientDocument {
  id: string;
  type: "credit_history" | "enpf_statement";
  title: string;
  required: boolean;
  status: DocumentStatus;
  fileName?: string;
  reportDate?: string;
  fields: ExtractedField[];
  /** Прогресс конвейера обработки 0..100 для индикатора. */
  progress?: number;
  /** Файл реально загружен и сохранён на сервере (приватно). */
  serverStored?: boolean;
  /** ID документа на сервере (для приватной выдачи файла). */
  documentId?: string;
  storedAt?: string;
  /** Честные ограничения/гейты распознавания из спецификации. */
  gates?: string[];
  notes?: string[];
  /** Раздельные статусы (файл/подлинность/извлечение) — не один зелёный. */
  statuses?: { file_integrity?: string; authenticity?: string; extraction?: string };
}

// --- Обязательства (из кредитной истории) -----------------------------------

export interface LoanObligation {
  id: string;
  creditor: string;
  productType: string;
  outstandingBalance: number;
  annualRate: number;
  monthlyPayment: number;
  remainingTermMonths: number;
  delinquencyStatus: "none" | "past" | "current";
  confidence: number;
}

// --- Анализ и вердикты программ ---------------------------------------------

export interface RuleResult {
  ruleId: string;
  status: RuleStatus;
  humanReason: string;
  actualValue?: string;
  requiredValue?: string;
  remediation?: string;
  sourceReference?: string;
}

export interface ProgramResult {
  programId: string;
  bank: string;
  programName: string;
  verdict: ProgramVerdict;
  freshness: ProgramFreshness;
  verifiedAt: string;
  rate: number;
  estimatedPayment?: number;
  estimatedKdn?: number;
  rules: RuleResult[];
  /** Причины, из-за которых вердикт не зелёный. */
  blockingReasons: string[];
}

export interface AnalysisResult {
  analysisId: string;
  engineVersion: string;
  startedAt: string;
  completedAt?: string;
  acceptedIncome: number;
  proposedPayment: number;
  currentKdn: number;
  programResults: ProgramResult[];
  missingData: string[];
  blockingFactors: string[];
}

// --- Сценарии («Как провести клиента») --------------------------------------

export interface ScenarioDeltaLine {
  label: string;
  before: string;
  after: string;
  positive?: boolean;
}

export interface MortgageScenario {
  id: string;
  type: ScenarioType;
  title: string;
  summary: string;
  rank: number;
  /** Требует ввода подтверждённых условий (напр. ставка рефинансирования). */
  requiresVerifiedInput?: boolean;
  cashRequired?: number;
  monthlySaving?: number;
  newKdn?: number;
  deltas: ScenarioDeltaLine[];
  openedPrograms: string[];
  requiredDocuments: string[];
  requiredActions: string[];
  scoreBreakdown: { factor: string; weight: number; note: string }[];
  preliminary?: boolean;
}

// --- Подбор квартир в новостройках ------------------------------------------

export interface PropertyMatch {
  id: string;
  developmentName: string;
  developerName: string;
  city: string;
  address: string;
  rooms: number;
  areaSqm: number;
  floor: number;
  completionDate: string;
  price: number;
  minimumDownPayment: number;
  estimatedLoanAmount: number;
  estimatedMonthlyPayment: number;
  estimatedKdn: number;
  fit: PropertyFit;
  fitReasons: string[];
  warnings: string[];
  availabilityCheckedAt: string;
  accreditationCheckedAt: string;
  demo?: boolean;
  inSelection?: boolean;
}

// --- Что если (live-пересчёт) ------------------------------------------------

export interface WhatIfInputs {
  propertyPrice: number;
  downPayment: number;
  termMonths: number;
  existingDebtPayment: number;
  additionalConfirmedIncome: number;
  rate: number;
}

export interface WhatIfResult {
  loanAmount: number;
  monthlyPayment: number;
  kdn: number;
  acceptedIncome: number;
  eligibleProgramsCount: number;
}

// --- Следующее действие / заключение ----------------------------------------

export interface NextAction {
  action: string;
  dueDate?: string;
  savedAt?: string;
}

export interface ClientConclusion {
  conclusionId: string;
  version: number;
  publicLink?: string;
  expiresAt?: string;
  pdfReady?: boolean;
  createdAt: string;
}

// --- Полное состояние рабочего экрана ---------------------------------------

export interface WorkspaceState {
  caseStatus: CaseStatus;
  client: MortgageClient | null;
  consent: ConsentState;
  documents: {
    creditHistory: ClientDocument;
    enpf: ClientDocument;
  };
  iinCheck: {
    status: IinCheckStatus;
    checkedAt?: string;
    sourceUrl?: string;
  };
  obligations: LoanObligation[];
  analysis: AnalysisResult | null;
  snapshotConfirmed: boolean;
  scenarios: MortgageScenario[];
  selectedScenarioId: string | null;
  whatIf: WhatIfInputs;
  properties: PropertyMatch[];
  nextAction: NextAction | null;
  conclusion: ClientConclusion | null;
  lastCalculationAt: string | null;
}
