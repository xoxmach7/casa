// Heuristic text extraction from broker-uploaded КИ (credit history) and ПО
// (ЕНПФ pension) PDF documents. Regex/keyword based — no ML/OCR, works only
// on text-layer PDFs in the formats these reports are typically produced in.

// Import the library module directly (not the package's `index.js` entry) —
// that entry point runs a debug self-test on load whenever `module.parent`
// is falsy, which throws under Vitest/ESM loaders (ENOENT on a fixture file
// that isn't part of the published sources).
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { CreditHistoryStatus } from './scoring.service';

export interface ExtractedCreditHistory {
  status: CreditHistoryStatus;
  matchedPhrase: string | null;
}

export interface ExtractedAmounts {
  averageAmount: number;
  totalAmount: number;
  matchesFound: number;
}

const BAD_PHRASES = [
  'текущая просрочка',
  'непогашенная задолженность',
  'просрочка более',
  'активная просрочка',
  'выход на просрочку',
];

const DELAY_PHRASES = [
  'были просрочки',
  'просрочка исполнена',
  'ранее была просрочка',
  'просрочка урегулирована',
  'просрочка погашена',
  'просрочка',
];

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

export function extractCreditHistoryStatus(rawText: string): ExtractedCreditHistory {
  const text = rawText.toLowerCase().replace(/\s+/g, ' ');

  for (const phrase of BAD_PHRASES) {
    if (text.includes(phrase)) return { status: 'BAD', matchedPhrase: phrase };
  }
  for (const phrase of DELAY_PHRASES) {
    if (text.includes(phrase)) return { status: 'HAS_DELAYS', matchedPhrase: phrase };
  }
  return { status: 'GOOD', matchedPhrase: null };
}

function parseAmount(raw: string): number {
  // "123 456,78" / "123.456,78" / "123456" -> 123456.78
  const cleaned = raw.replace(/[  .](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

const AMOUNT_WITH_CURRENCY = /([\d][\d  .,]*\d|\d)\s*(?:тенге|тг\.?|kzt|₸)/gi;

// Sums (not averages) every amount tagged to a known "monthly payment" label —
// used for existing loan obligations, which are typically listed per-loan.
export function extractSummedAmounts(rawText: string, labels: string[]): ExtractedAmounts {
  const lowerText = rawText.toLowerCase();
  const amounts: number[] = [];

  for (const label of labels) {
    let searchIndex = 0;
    while (true) {
      const idx = lowerText.indexOf(label, searchIndex);
      if (idx === -1) break;
      const window = rawText.slice(idx, idx + 150);
      const match = new RegExp(AMOUNT_WITH_CURRENCY).exec(window);
      if (match) amounts.push(parseAmount(match[1]));
      searchIndex = idx + label.length;
    }
  }

  if (amounts.length === 0) return { averageAmount: 0, totalAmount: 0, matchesFound: 0 };
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
  return {
    averageAmount: Math.round(totalAmount / amounts.length),
    totalAmount: Math.round(totalAmount),
    matchesFound: amounts.length,
  };
}

// Averages every currency-tagged amount found anywhere in the document —
// used for ЕНПФ monthly contribution history, where each row is one month.
export function extractAverageAmount(rawText: string): ExtractedAmounts {
  const amounts: number[] = [];
  const re = new RegExp(AMOUNT_WITH_CURRENCY);
  let match: RegExpExecArray | null;
  while ((match = re.exec(rawText)) !== null) {
    const amount = parseAmount(match[1]);
    if (amount > 0) amounts.push(amount);
  }
  if (amounts.length === 0) return { averageAmount: 0, totalAmount: 0, matchesFound: 0 };
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
  return {
    averageAmount: Math.round(totalAmount / amounts.length),
    totalAmount: Math.round(totalAmount),
    matchesFound: amounts.length,
  };
}

const DEBT_LABELS = ['ежемесячный платеж', 'ежемесячный платёж', 'платеж по кредиту', 'сумма платежа'];

export function extractExistingMonthlyDebt(rawText: string): ExtractedAmounts {
  return extractSummedAmounts(rawText, DEBT_LABELS);
}

export function extractAvgMonthlyPension(rawText: string): ExtractedAmounts {
  return extractAverageAmount(rawText);
}
