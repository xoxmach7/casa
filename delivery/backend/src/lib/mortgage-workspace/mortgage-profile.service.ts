/**
 * M05 Client Profile — агрегация анкеты. Чистая логика (без БД).
 *
 * available_now_total (вход для M06 CALC-F-001) считается из источников
 * первоначального взноса. Инвариант UNKNOWN ≠ 0: источник без суммы (null)
 * НЕ считается нулём — он делает агрегат неполным (complete=false), и это
 * прокидывается статусом в M06 (UNKNOWN), а не подставляется 0.
 *
 * Статус агрегата: все VERIFIED → CONFIRMED; есть DECLARED (но нет UNKNOWN) →
 * DECLARED (в M06 → COMPLETED_WITH_LIMITATIONS/UNVERIFIED); есть UNKNOWN/пустая
 * сумма → UNKNOWN (в M06 → BLOCKED).
 */

import { Prisma } from '@prisma/client';
import crypto from 'crypto';

type FieldStatus = 'DECLARED' | 'VERIFIED' | 'UNKNOWN' | 'CONFLICT';

export interface MoneySource {
  amount: Prisma.Decimal | string | number | null;
  status: FieldStatus;
}

export interface AggregatedMoney {
  value: string | null; // сумма Decimal(20,2) как строка; null если неполно
  status: 'CONFIRMED' | 'DECLARED' | 'UNKNOWN';
  complete: boolean;
  currency: 'KZT';
  counted: number;
  total: number;
}

const D = Prisma.Decimal;

/** Сумма денежных источников с соблюдением UNKNOWN ≠ 0. */
export function aggregateMoney(sources: MoneySource[]): AggregatedMoney {
  let sum = new D(0);
  let counted = 0;
  let sawDeclared = false;
  let incomplete = false;

  for (const s of sources) {
    if (s.status === 'UNKNOWN' || s.status === 'CONFLICT' || s.amount === null || s.amount === undefined) {
      incomplete = true; // не считаем как 0
      continue;
    }
    sum = sum.add(new D(s.amount));
    counted += 1;
    if (s.status === 'DECLARED') sawDeclared = true;
  }

  const status: AggregatedMoney['status'] = incomplete ? 'UNKNOWN' : sawDeclared ? 'DECLARED' : 'CONFIRMED';
  const value = incomplete ? null : sum.toDecimalPlaces(2, D.ROUND_HALF_UP).toFixed(2);

  return { value, status, complete: !incomplete, currency: 'KZT', counted, total: sources.length };
}

/** Статус агрегата M05 → статус входа M06. */
export function toM06InputStatus(agg: AggregatedMoney): 'CONFIRMED' | 'DECLARED' | 'UNKNOWN' {
  return agg.status;
}

/** Детерминированный content_hash снапшота профиля (sorted-json-sha256). */
export function profileContentHash(payload: unknown): string {
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(norm);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = norm((v as Record<string, unknown>)[k]);
    return out;
  };
  return crypto.createHash('sha256').update(JSON.stringify(norm(payload)), 'utf8').digest('hex');
}
