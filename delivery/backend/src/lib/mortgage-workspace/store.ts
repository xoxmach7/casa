/**
 * In-memory demo-хранилища «ипотечного рабочего экрана» CASA Pro Ипотека.
 *
 * НАМЕРЕННО без Prisma и без миграций: это demo/production-safe контур. Данные
 * живут в Map на уровне модуля и теряются при рестарте процесса — реальные PII,
 * SMS и скоринг здесь не хранятся и не отправляются.
 */

import crypto from 'crypto';

/**
 * Контейнер клиентского заключения. Раньше тип приходил из demo-движка
 * engine.ts; движок удалён вместе с остальными заглушками (он считал
 * запрещённый в релизе КДН), а хранилищу от заключения нужен только срок
 * жизни ссылки. Создание заключений закрыто гейтом провайдера.
 */
export interface ConclusionPayload {
  expiresAt: string;
  [key: string]: unknown;
}

// --- Цели обработки (зеркало PURPOSES из frontend/app/consent/[token]/page.tsx)

export const CONSENT_PURPOSES = [
  'Сбор и обработка анкетных данных',
  'Обработка загруженной кредитной истории',
  'Обработка выписки ЕНПФ',
  'Разрешённые проверки по ИИН в официальных источниках',
  'Предварительный расчёт вариантов ипотеки',
  'Подбор ипотечных программ и квартир в новостройках',
  'Формирование и передача клиентского заключения',
];

/** Версия текста согласия. */
export const CONSENT_TEXT_VERSION = '1.1';
/** Максимум попыток ввода кода до блокировки. */
export const MAX_CONSENT_ATTEMPTS = 5;

export type ConsentStatus = 'sms_pending' | 'link_opened' | 'confirmed' | 'rejected';

export interface ConsentRecord {
  consentId: string;
  clientMasked: string;
  phoneMasked: string;
  status: ConsentStatus;
  /** 8-значный код, детерминированно выведенный из токена (demo). */
  code: string;
  attempts: number;
  purposes: string[];
  textVersion: string;
  createdAt: string;
}

// --- Хранилища --------------------------------------------------------------

const consents = new Map<string, ConsentRecord>();
const conclusions = new Map<string, ConclusionPayload>();

// --- Детерминированный demo-код из токена -----------------------------------

/**
 * Тот же алгоритм, что demoCodeFromToken на фронте
 * (frontend/app/consent/[token]/page.tsx), чтобы коды совпадали:
 * h = (h*31 + charCode) >>> 0, затем h % 1e8, дополнить нулями до 8 цифр.
 */
export function demoCodeFromToken(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h * 31 + token.charCodeAt(i)) >>> 0;
  }
  return String(h % 100000000).padStart(8, '0');
}

// --- Маскирование ------------------------------------------------------------

/** «Айдос Мухамедов» → «Айдос М.». Показываем имя и инициал фамилии. */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Клиент';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

/** Оставляем видимыми последние 2 цифры: «+7 701 555 20 31» → «+7 ••• ••• •• 31». */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 2) return '••';
  const last2 = digits.slice(-2);
  return `••• ••• •• ${last2}`;
}

// --- Согласия ----------------------------------------------------------------

export function createConsent(input: { clientName: string; phone: string }): ConsentRecord & { token: string } {
  const token = crypto.randomBytes(16).toString('hex');
  const record: ConsentRecord = {
    consentId: `cs-${crypto.randomBytes(6).toString('hex')}`,
    clientMasked: maskName(input.clientName),
    phoneMasked: maskPhone(input.phone),
    status: 'sms_pending',
    code: demoCodeFromToken(token),
    attempts: 0,
    purposes: [...CONSENT_PURPOSES],
    textVersion: CONSENT_TEXT_VERSION,
    createdAt: new Date().toISOString(),
  };
  consents.set(token, record);
  return { ...record, token };
}

export function getConsent(token: string): ConsentRecord | undefined {
  return consents.get(token);
}

export function updateConsent(token: string, patch: Partial<ConsentRecord>): ConsentRecord | undefined {
  const existing = consents.get(token);
  if (!existing) return undefined;
  const next = { ...existing, ...patch };
  consents.set(token, next);
  return next;
}

// --- Заключения --------------------------------------------------------------

export function createConclusion(token: string, payload: ConclusionPayload): void {
  conclusions.set(token, payload);
}

export function isConclusionExpired(payload: ConclusionPayload, now = Date.now()): boolean {
  const expiresAt = Date.parse(payload.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}
export function getConclusion(token: string): ConclusionPayload | undefined {
  return conclusions.get(token);
}
