import { MORTGAGE_SANDBOX_POLICY_VERSION } from './mortgage-sandbox-policy';
import {
  runMortgagePreScore,
  type MortgageProgramRuleCard,
  type VerifiedMortgageSnapshot,
} from './mortgage-prescore.service';
import {
  previewMortgageScenario,
  type MortgageScenarioChange,
} from './mortgage-scenario.service';

const PRIMARY_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const SECONDARY_WEIGHTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2] as const;

const REFERENCE_SNAPSHOT: VerifiedMortgageSnapshot = {
  id: 'sandbox-reference-v1',
  inputHash: 'sandbox-reference-input-v1',
  asOf: '2026-08-24T00:00:00.000Z',
  consentStatus: 'ACTIVE',
  criticalDataResolved: true,
  incomeStreams: [{ fingerprint: 'synthetic-salary', amount: '500000', verified: true, eligible: true }],
  facilities: [{ fingerprint: 'synthetic-loan', monthlyPayment: '100000', applicable: true }],
  property: {
    purchasePrice: '40000000',
    appraisalValue: '40000000',
    downPaymentCash: '8000000',
    inventoryStatus: 'AVAILABLE',
  },
  creditDiscipline: 'LOW_RISK',
  incomeStability: 'HIGH',
  dataConfidence: 'HIGH',
};

const REFERENCE_PROGRAMS: MortgageProgramRuleCard[] = [{
  programId: 'sandbox-program',
  ruleVersionId: 'sandbox-rule-v1',
  status: 'ACTIVE',
  validFrom: '2026-01-01T00:00:00.000Z',
  validTo: '2027-01-01T00:00:00.000Z',
  sourceStatus: 'CONFIRMED',
  annualNominalRate: '0',
  termMonths: 240,
  debtRatio: '0.5',
  minDownPaymentRatio: '0.2',
  maxLtv: '1',
  maxLoan: '30000000',
  hardFilterFailures: [],
}];

function checksum(digits: readonly number[], weights: readonly number[]): number {
  return digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
}

function validIinChecksum(iin: string): boolean {
  if (!/^\d{12}$/.test(iin)) return false;
  const digits = Array.from(iin, Number);
  let calculated = checksum(digits.slice(0, 11), PRIMARY_WEIGHTS);
  if (calculated === 10) calculated = checksum(digits.slice(0, 11), SECONDARY_WEIGHTS);
  return calculated !== 10 && calculated === digits[11];
}

function cloneSnapshot(): VerifiedMortgageSnapshot {
  return {
    ...REFERENCE_SNAPSHOT,
    incomeStreams: REFERENCE_SNAPSHOT.incomeStreams.map((item) => ({ ...item })),
    facilities: REFERENCE_SNAPSHOT.facilities.map((item) => ({ ...item })),
    property: REFERENCE_SNAPSHOT.property ? { ...REFERENCE_SNAPSHOT.property } : undefined,
  };
}

function clonePrograms(): MortgageProgramRuleCard[] {
  return REFERENCE_PROGRAMS.map((item) => ({ ...item, hardFilterFailures: [...item.hardFilterFailures] }));
}

export function getSandboxStatus() {
  return {
    mode: 'synthetic' as const,
    productionSafe: true,
    officialIinCheck: false,
    externalSourceStatus: 'EXTERNAL_SOURCE_NOT_CONNECTED' as const,
    policyVersion: MORTGAGE_SANDBOX_POLICY_VERSION,
  };
}

export function checkSandboxIin(iin: string) {
  const shapeValid = /^\d{12}$/.test(iin);
  return {
    shapeValid,
    checksumValid: shapeValid && validIinChecksum(iin),
    externalSourceStatus: 'EXTERNAL_SOURCE_NOT_CONNECTED' as const,
    officialResult: null,
  };
}

export function getSandboxAnalysis() {
  return {
    sandbox: true as const,
    analysis: runMortgagePreScore({ snapshot: cloneSnapshot(), programs: clonePrograms() }),
  };
}

export function previewSandboxScenario(changes: MortgageScenarioChange[]) {
  return {
    sandbox: true as const,
    scenario: previewMortgageScenario({ snapshot: cloneSnapshot(), programs: clonePrograms(), changes }),
  };
}
