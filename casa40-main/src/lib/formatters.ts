/** Shared input formatting & sanitization helpers */

// ── House number: digits only ──
export const sanitizeHouseNumber = (val: string): string =>
  val.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s/\-.,]/g, '');

// ── Price: display with spaces, store raw digits ──
export const formatPriceDisplay = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const parsePriceRaw = (val: string): string =>
  val.replace(/\D/g, '');

// ── Phone: +7 XXX XXX XX XX ──
const PHONE_DIGITS_MAX = 11; // 7 + 10

export const formatPhoneDisplay = (val: string): string => {
  // Strip everything except digits and leading +
  let digits = val.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

  // Normalize: leading 8 → 7, ensure starts with 7
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('8') && digits.length >= 1) digits = '7' + digits.slice(1);
  if (digits.length > 0 && !digits.startsWith('7')) digits = '7' + digits;

  digits = digits.slice(0, PHONE_DIGITS_MAX);

  // Progressive mask: +7 XXX XXX XX XX
  if (digits.length === 0) return '';
  let out = '+' + digits[0]; // +7
  if (digits.length > 1) out += ' ' + digits.slice(1, 4);
  if (digits.length > 4) out += ' ' + digits.slice(4, 7);
  if (digits.length > 7) out += ' ' + digits.slice(7, 9);
  if (digits.length > 9) out += ' ' + digits.slice(9, 11);
  return out;
};

export const parsePhoneRaw = (val: string): string => {
  let digits = val.replace(/[^\d]/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (!digits.startsWith('7') && digits.length > 0) digits = '7' + digits;
  digits = digits.slice(0, PHONE_DIGITS_MAX);
  return digits.length > 0 ? '+' + digits : '';
};

// ── KZ phone: +7 (7XX) XXX-XX-XX ──
export const formatPhoneKZ = (val: string): string => {
  let digits = val.replace(/[^\d]/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits.length > 0 && !digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, PHONE_DIGITS_MAX);

  if (digits.length === 0) return '';
  let out = '+' + digits[0];                          // +7
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) out += ') ';
  else if (digits.length > 1) return out;
  if (digits.length > 4) out += digits.slice(4, 7);
  if (digits.length > 7) out += '-' + digits.slice(7, 9);
  if (digits.length > 9) out += '-' + digits.slice(9, 11);
  return out;
};

export const isPhoneComplete = (val: string): boolean => {
  const digits = val.replace(/[^\d]/g, '');
  return digits.length === PHONE_DIGITS_MAX;
};
