// Приватное серверное хранение ипотечных документов (кредитная история / ЕНПФ).
//
// ВАЖНО (безопасность): это персональные данные. Файлы кладутся в приватную
// подпапку тома, которая НЕ раздаётся публично (см. блокировку в index.ts), и
// выдаются только через авторизованный эндпоинт. Публичный бакет/uploads для
// них использовать нельзя.
//
// Персистентность: PDF и JSON-сайдкар с метаданными и извлечёнными полями
// лежат на том же persistent-томе, что и /app/uploads (docker volume
// uploads_data). Отдельная БД-таблица не заведена намеренно — рабочий экран
// оперирует демо-клиентами (без реального clientId FK), а миграцию на живом
// проде не хотим ради демо-хранилища. Юр. срок хранения/шифрование — открытый
// gate (OD-002/OD-007, LEGAL_REVIEW_REQUIRED из спецификации).

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Тот же корень, что и express.static('/app/uploads'): из dist/lib/mortgage-workspace
// три уровня вверх = /app (в проде) или .../backend (локально/в тестах).
const PRIVATE_DIR =
  process.env.MORTGAGE_PRIVATE_DIR ||
  path.join(__dirname, '..', '..', '..', 'uploads', 'mortgage-private');

// Префикс пути, который index.ts блокирует от публичной раздачи.
export const MORTGAGE_PRIVATE_URL_PREFIX = '/uploads/mortgage-private';

export type MortgageDocType = 'credit_history' | 'enpf_statement';

export interface StoredDocumentMeta {
  id: string;
  type: MortgageDocType;
  fileName: string;
  size: number;
  sha256: string;
  pageCount?: number;
  status: 'needs_review' | 'confirmed' | 'processing_failed';
  uploadedBy?: string;
  caseRef?: string;
  storedAt: string;
  // Результат извлечения (структура — из extraction.ts).
  extraction: unknown;
}

function ensureDir(): void {
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
}

/** Fail-closed access rule for private mortgage documents. */
export function canAccessDocument(meta: StoredDocumentMeta, user: { userId: string; role: string } | undefined): boolean {
  return Boolean(user && (user.role === 'ADMIN' || meta.uploadedBy === user.userId));
}
export function sha256Of(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function newDocumentId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function pdfPath(id: string): string {
  return path.join(PRIVATE_DIR, `${id}.pdf`);
}
function metaPath(id: string): string {
  return path.join(PRIVATE_DIR, `${id}.json`);
}

/** Сохранить PDF-байты и метаданные приватно. */
export function saveDocument(buffer: Buffer, meta: StoredDocumentMeta): void {
  ensureDir();
  fs.writeFileSync(pdfPath(meta.id), buffer);
  fs.writeFileSync(metaPath(meta.id), JSON.stringify(meta, null, 2), 'utf8');
}

/** Прочитать метаданные документа (или null, если нет). */
export function readMeta(id: string): StoredDocumentMeta | null {
  try {
    const raw = fs.readFileSync(metaPath(id), 'utf8');
    return JSON.parse(raw) as StoredDocumentMeta;
  } catch {
    return null;
  }
}

/** Прочитать PDF-байты (или null). */
export function readPdf(id: string): Buffer | null {
  try {
    return fs.readFileSync(pdfPath(id));
  } catch {
    return null;
  }
}

/** Обновить статус/поля после ручного подтверждения. */
export function updateMeta(id: string, patch: Partial<StoredDocumentMeta>): StoredDocumentMeta | null {
  const cur = readMeta(id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  fs.writeFileSync(metaPath(id), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** Валидный ли id (только hex, чтобы не было path traversal). */
export function isValidId(id: string): boolean {
  return /^[a-f0-9]{16,64}$/.test(id);
}
