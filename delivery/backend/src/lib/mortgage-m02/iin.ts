/**
 * M02 R0 — валидация и защита ИИН.
 *
 * Источник: M02_CASA_Pro_IIN_Check_R0_Implementation_and_Acceptance_v1.0 §7
 * (гейты IIN_FORMAT / IIN_CHECK_DIGIT) и §16 (IIN protection).
 *
 * Два непреложных инварианта спеки:
 *  1. Не исправлять и не обрезать ИИН автоматически. Невалидный ввод — это
 *     VALIDATION_ERROR и НОЛЬ внешних вызовов, а не «почистим и попробуем».
 *  2. Не выводить пол и дату рождения из структуры ИИН. Первые шесть цифр
 *     действительно кодируют дату, но извлечение этих атрибутов здесь прямо
 *     запрещено — поэтому в модуле нет и не должно появиться такой функции.
 *
 * Полный ИИН не покидает зашифрованное хранилище: наружу идут маска и
 * HMAC-токен поиска (§7 «ПОЛНЫЙ ИИН», §16).
 */

import crypto from 'crypto';

export type IinValidationCode = 'IIN_FORMAT' | 'IIN_CHECK_DIGIT';

export interface IinValidationResult {
  valid: boolean;
  /** Код нарушенного гейта; null если ИИН валиден. */
  code: IinValidationCode | null;
  /** Человеческое сообщение брокеру — без самого ИИН. */
  message: string | null;
}

const IIN_LENGTH = 12;

/** Веса первого прохода официального алгоритма контрольного разряда. */
const WEIGHTS_PRIMARY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/** Веса второго прохода — применяются, только если первый дал остаток 10. */
const WEIGHTS_SECONDARY = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

function weightedRemainder(digits: number[], weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i += 1) sum += digits[i] * weights[i];
  return sum % 11;
}

/**
 * Проверяет формат и 12-й контрольный разряд.
 *
 * Возвращает результат, а не бросает: вызывающий обязан записать
 * VALIDATION_ERROR в batch и НЕ ходить во внешние источники.
 */
export function validateIin(raw: unknown): IinValidationResult {
  if (typeof raw !== 'string' || !/^\d{12}$/.test(raw)) {
    return {
      valid: false,
      code: 'IIN_FORMAT',
      message: 'ИИН должен содержать ровно 12 цифр.',
    };
  }

  const digits = raw.split('').map((c) => Number(c));

  let remainder = weightedRemainder(digits, WEIGHTS_PRIMARY);
  if (remainder === 10) {
    remainder = weightedRemainder(digits, WEIGHTS_SECONDARY);
    // Повторная 10 означает, что контрольный разряд не определён: такой ИИН
    // невалиден. Подставлять 0 или брать остаток по модулю 10 нельзя — это
    // было бы «исправлением» запрещённым §7.
    if (remainder === 10) {
      return {
        valid: false,
        code: 'IIN_CHECK_DIGIT',
        message: 'ИИН не прошёл проверку контрольного разряда.',
      };
    }
  }

  if (remainder !== digits[IIN_LENGTH - 1]) {
    return {
      valid: false,
      code: 'IIN_CHECK_DIGIT',
      message: 'ИИН не прошёл проверку контрольного разряда.',
    };
  }

  return { valid: true, code: null, message: null };
}

/**
 * Маска для показа человеку. Раскрываются только последние две цифры — этого
 * достаточно, чтобы оператор различил участников, и недостаточно, чтобы
 * восстановить идентификатор.
 *
 * Невалидный вход маскируется целиком: мы не подтверждаем даже длину.
 */
export function maskIin(raw: unknown): string {
  if (typeof raw !== 'string' || !/^\d{12}$/.test(raw)) return '••••••••••••';
  return `${'•'.repeat(10)}${raw.slice(-2)}`;
}

/**
 * Детерминированный токен поиска: HMAC-SHA256(ИИН, ключ).
 *
 * Позволяет искать и сопоставлять субъекта, не храня и не передавая ИИН.
 * Ключ обязателен: без него функция бросает, а не тихо переходит на голый
 * хэш — иначе токен стал бы обратимым перебором 12 цифр.
 */
export function iinLookupToken(raw: string, secret = process.env.IIN_LOOKUP_HMAC_KEY): string {
  if (!secret || secret.length < 32) {
    throw new Error('IIN_LOOKUP_HMAC_KEY отсутствует или короче 32 символов: токен поиска не может быть построен');
  }
  return crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
}

/**
 * Страховка для логов, ошибок и телеметрии: вырезает любую 12-значную
 * последовательность из произвольного текста.
 *
 * Это последний рубеж, а не разрешение логировать ИИН: поля с ИИН не должны
 * попадать в сообщения вовсе.
 */
export function redactIinLike(text: string): string {
  return text.replace(/\b\d{12}\b/g, '••••••••••••');
}
