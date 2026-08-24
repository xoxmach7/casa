export const MORTGAGE_SANDBOX_POLICY_VERSION = '2026-08-24' as const;

export type MortgageSandboxPolicyCode =
  | 'PDF_SIGNATURE_INVALID'
  | 'TEXT_LAYER_REQUIRED'
  | 'TEXT_LAYER_TOO_LARGE'
  | 'REAL_IIN_DETECTED'
  | 'SYNTHETIC_ATTESTATION_REQUIRED';

export type MortgageSandboxPolicyResult =
  | { allowed: true; policyVersion: typeof MORTGAGE_SANDBOX_POLICY_VERSION }
  | { allowed: false; code: MortgageSandboxPolicyCode };

export interface MortgageSandboxPdfInput {
  buffer: Buffer;
  extractedText: string;
  attestedSynthetic: boolean;
}

const PDF_MAGIC = Buffer.from('%PDF-');
const MIN_NORMALIZED_TEXT_LENGTH = 10;
const MAX_EXTRACTED_TEXT_LENGTH = 2_000_000;
const IIN_TOKEN = /\d(?:[\s\u00a0\u202f\-–—]*\d)*/g;
const PRIMARY_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const SECONDARY_WEIGHTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2] as const;

function hasPdfSignature(buffer: Buffer): boolean {
  return buffer.length >= PDF_MAGIC.length && buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

function normalizedText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function checksum(digits: readonly number[], weights: readonly number[]): number {
  return digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
}

function isValidKazakhstanIin(candidate: string): boolean {
  const digits = Array.from(candidate, Number);
  const expected = digits[11];
  let calculated = checksum(digits.slice(0, 11), PRIMARY_WEIGHTS);

  if (calculated === 10) {
    calculated = checksum(digits.slice(0, 11), SECONDARY_WEIGHTS);
  }

  return calculated !== 10 && calculated === expected;
}

function containsValidKazakhstanIin(text: string): boolean {
  for (const match of text.matchAll(IIN_TOKEN)) {
    const candidate = match[0].replace(/\D/g, '');
    if (candidate.length === 12 && isValidKazakhstanIin(candidate)) {
      return true;
    }
  }

  return false;
}

export function inspectMortgageSandboxPdf(
  input: MortgageSandboxPdfInput,
): MortgageSandboxPolicyResult {
  if (!hasPdfSignature(input.buffer)) {
    return { allowed: false, code: 'PDF_SIGNATURE_INVALID' };
  }

  if (input.extractedText.length > MAX_EXTRACTED_TEXT_LENGTH) {
    return { allowed: false, code: 'TEXT_LAYER_TOO_LARGE' };
  }

  const text = normalizedText(input.extractedText);
  if (text.length < MIN_NORMALIZED_TEXT_LENGTH) {
    return { allowed: false, code: 'TEXT_LAYER_REQUIRED' };
  }

  if (containsValidKazakhstanIin(text)) {
    return { allowed: false, code: 'REAL_IIN_DETECTED' };
  }

  if (!input.attestedSynthetic) {
    return { allowed: false, code: 'SYNTHETIC_ATTESTATION_REQUIRED' };
  }

  return { allowed: true, policyVersion: MORTGAGE_SANDBOX_POLICY_VERSION };
}