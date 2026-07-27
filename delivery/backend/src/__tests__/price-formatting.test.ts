import { describe, it, expect } from 'vitest';

// Replicate the formatting logic from PriceInput component
function formatWithThousands(val: string): string {
  const num = val.replace(/[^\d]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("ru-RU");
}

function stripFormatting(val: string): string {
  return val.replace(/[^\d]/g, "");
}

describe('Price formatting utilities', () => {
  describe('formatWithThousands', () => {
    it('formats thousands', () => {
      const result = formatWithThousands('1000');
      expect(stripFormatting(result)).toBe('1000');
      expect(result.length).toBeGreaterThan(3); // has separator
    });

    it('formats millions', () => {
      const result = formatWithThousands('50000000');
      expect(stripFormatting(result)).toBe('50000000');
    });

    it('returns empty for empty input', () => {
      expect(formatWithThousands('')).toBe('');
    });

    it('strips non-numeric before formatting', () => {
      const result = formatWithThousands('abc50000def');
      expect(stripFormatting(result)).toBe('50000');
    });

    it('handles single digit', () => {
      expect(formatWithThousands('5')).toBe('5');
    });

    it('handles zero', () => {
      expect(formatWithThousands('0')).toBe('0');
    });

    it('handles very large numbers', () => {
      const result = formatWithThousands('999999999999');
      expect(stripFormatting(result)).toBe('999999999999');
    });
  });

  describe('stripFormatting', () => {
    it('removes regular spaces', () => {
      expect(stripFormatting('50 000 000')).toBe('50000000');
    });

    it('removes non-breaking spaces', () => {
      expect(stripFormatting('50\u00a0000\u00a0000')).toBe('50000000');
    });

    it('keeps only digits', () => {
      expect(stripFormatting('$1,234.56 ₸')).toBe('123456');
    });

    it('returns empty for non-numeric', () => {
      expect(stripFormatting('abc')).toBe('');
    });

    it('handles empty string', () => {
      expect(stripFormatting('')).toBe('');
    });
  });
});
