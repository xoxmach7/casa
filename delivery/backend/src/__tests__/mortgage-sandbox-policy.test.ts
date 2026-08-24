import { describe, expect, it } from 'vitest';
import { inspectMortgageSandboxPdf } from '../lib/mortgage-sandbox-policy';

const pdf = Buffer.from('%PDF-1.7\nsynthetic fixture');
const usableText = 'Синтетическая выписка для проверки ипотечного сценария';

function validIin(prefix: string): string {
  const digits = prefix.split('').map(Number);
  const first = digits.reduce((sum, digit, index) => sum + digit * (index + 1), 0) % 11;
  const checksum = first === 10
    ? digits.reduce((sum, digit, index) => sum + digit * (((index + 3) % 11) || 11), 0) % 11
    : first;
  if (checksum === 10) throw new Error('Fixture prefix has no checksum');
  return `${prefix}${checksum}`;
}

describe('mortgage sandbox PDF policy', () => {
  it('allows an attested synthetic PDF with a usable text layer', () => {
    expect(inspectMortgageSandboxPdf({ buffer: pdf, extractedText: usableText, attestedSynthetic: true })).toEqual({
      allowed: true,
      policyVersion: '2026-08-24',
    });
  });

  it('rejects input without a PDF signature', () => {
    expect(inspectMortgageSandboxPdf({ buffer: Buffer.from('not a pdf'), extractedText: usableText, attestedSynthetic: true })).toEqual({
      allowed: false,
      code: 'PDF_SIGNATURE_INVALID',
    });
  });

  it.each(['   \n\t ', 'КИ'])('rejects a missing or insufficient text layer', (extractedText) => {
    expect(inspectMortgageSandboxPdf({ buffer: pdf, extractedText, attestedSynthetic: true })).toEqual({
      allowed: false,
      code: 'TEXT_LAYER_REQUIRED',
    });
  });

  it('requires an explicit synthetic-data attestation', () => {
    expect(inspectMortgageSandboxPdf({ buffer: pdf, extractedText: usableText, attestedSynthetic: false })).toEqual({
      allowed: false,
      code: 'SYNTHETIC_ATTESTATION_REQUIRED',
    });
  });

  it('rejects a valid Kazakhstan IIN found among twelve-digit candidates', () => {
    const iin = validIin('90010130001');
    expect(inspectMortgageSandboxPdf({
      buffer: pdf,
      extractedText: `${usableText}. ИИН: ${iin}`,
      attestedSynthetic: true,
    })).toEqual({ allowed: false, code: 'REAL_IIN_DETECTED' });
  });

  it.each([
    ['space', ' '],
    ['non-breaking space', '\u00a0'],
    ['hyphen', '-'],
    ['line break', '\n'],
  ])('rejects a valid Kazakhstan IIN containing a %s separator', (_separator, separator) => {
    const iin = validIin('90010130001');
    const formattedIin = `${iin.slice(0, 6)}${separator}${iin.slice(6)}`;
    expect(inspectMortgageSandboxPdf({
      buffer: pdf,
      extractedText: `${usableText}. ИИН: ${formattedIin}`,
      attestedSynthetic: true,
    })).toEqual({ allowed: false, code: 'REAL_IIN_DETECTED' });
  });

  it('does not extract a valid IIN from a numeric sequence longer than twelve digits', () => {
    const iin = validIin('90010130001');
    expect(inspectMortgageSandboxPdf({
      buffer: pdf,
      extractedText: `${usableText}. Номер: 1${iin}1`,
      attestedSynthetic: true,
    })).toEqual({ allowed: true, policyVersion: '2026-08-24' });
  });

  it('rejects an excessive extracted text layer with a stable code', () => {
    expect(inspectMortgageSandboxPdf({
      buffer: pdf,
      extractedText: 'x'.repeat(2_000_001),
      attestedSynthetic: true,
    })).toEqual({ allowed: false, code: 'TEXT_LAYER_TOO_LARGE' });
  });
  it('uses the secondary checksum when the primary checksum is ten', () => {
    expect(inspectMortgageSandboxPdf({
      buffer: pdf,
      extractedText: `${usableText}. ИИН: 000000000101`,
      attestedSynthetic: true,
    })).toEqual({ allowed: false, code: 'REAL_IIN_DETECTED' });
  });

  it('does not accept a candidate when both checksum passes produce ten', () => {
    expect(inspectMortgageSandboxPdf({
      buffer: pdf,
      extractedText: `${usableText}. Номер: 000000002810`,
      attestedSynthetic: true,
    })).toEqual({ allowed: true, policyVersion: '2026-08-24' });
  });
  it('does not reject an arbitrary twelve-digit value with an invalid IIN checksum', () => {
    expect(inspectMortgageSandboxPdf({
      buffer: pdf,
      extractedText: `${usableText}. Номер: 123456789012`,
      attestedSynthetic: true,
    })).toEqual({ allowed: true, policyVersion: '2026-08-24' });
  });
});