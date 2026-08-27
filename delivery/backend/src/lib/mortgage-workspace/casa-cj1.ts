/**
 * CASA-CJ-1 — каноническая сериализация и хэширование M06.
 *
 * ИСТОЧНИК: M06_CASA_Pro_Calculation_Engine_Production_Spec_v1.4.docx, §29
 * «Golden fixture FX-CALC-GOLDEN-001 → Replay hash methodology CASA-CJ-1».
 * Правила и allowlist перенесены дословно; это не реконструкция и не замена.
 *
 * Правила §29:
 *  - ключи объектов рекурсивно сортируются лексикографически;
 *  - порядок элементов массивов сохраняется;
 *  - UTF-8, Unicode NFC;
 *  - никакого незначащего пробела;
 *  - money/percent/ratio — канонические десятичные СТРОКИ, никогда binary float;
 *  - утверждённая display-строка остаётся точной строкой и не парсится обратно
 *    в математику;
 *  - input_hash  = SHA-256(canonical inputs);
 *  - output_hash = SHA-256(canonical outputs);
 *  - replay_hash = SHA-256(canonical replay payload) по ЯВНОМУ allowlist.
 *
 * Golden (§29), воспроизводится m06-golden.test.ts:
 *  input_hash  cb88c168e277aeae3d28d91f46643999fad2f6284b9a31c555f3e3665953fb47
 *  output_hash c1674aea4b8d1bc8bbc9fc8d1ecb76db85ee28f833be1971b81f19d2db642e60
 *  replay_hash a7be2c777298f1d563e3f794fbe2f0b13b59549dda3f2dafc0deaee321693737
 */

import crypto from 'crypto';

export const CASA_CJ_CANONICALIZATION_VERSION = 'CASA-CJ-1';

/** JSON-совместимое значение, допустимое в каноническом payload. */
export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

export class CasaCjError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CasaCjError';
  }
}

/**
 * Лексикографическое сравнение по КОДОВЫМ ТОЧКАМ Unicode.
 *
 * Штатный Array#sort сравнивает по code unit'ам UTF-16, что расходится с
 * порядком кодовых точек на суррогатных парах. Ключи канонических payload'ов —
 * ASCII, но полагаться на это нельзя: расхождение дало бы другой хэш.
 */
function compareCodePoints(a: string, b: string): number {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i += 1) {
    const pa = ca[i].codePointAt(0)!;
    const pb = cb[i].codePointAt(0)!;
    if (pa !== pb) return pa < pb ? -1 : 1;
  }
  return ca.length === cb.length ? 0 : ca.length < cb.length ? -1 : 1;
}

/**
 * Приводит значение к каноническому виду: NFC для строк и ключей, рекурсивная
 * сортировка ключей, порядок массивов не трогаем.
 *
 * Числа с плавающей точкой ЗАПРЕЩЕНЫ (§29 «never binary floats»): деньги,
 * проценты и доли обязаны приходить каноническими десятичными строками. Целые
 * (term_months) разрешены — они не несут дробной семантики. Нарушение — ошибка
 * реализации, а не входных данных, поэтому кидаем, а не «чиним молча».
 */
function normalize(value: unknown, path: string): CanonicalValue {
  if (value === null) return null;

  const t = typeof value;

  if (t === 'string') return (value as string).normalize('NFC');

  if (t === 'boolean') return value as boolean;

  if (t === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) {
      throw new CasaCjError('CASA_CJ_NON_FINITE_NUMBER', `Нечисловое значение в ${path}`);
    }
    if (!Number.isInteger(n)) {
      throw new CasaCjError(
        'CASA_CJ_FLOAT_FORBIDDEN',
        `${path}: binary float запрещён §29 — money/percent/ratio передаются каноническими десятичными строками`,
      );
    }
    return n;
  }

  if (t === 'bigint') {
    throw new CasaCjError('CASA_CJ_UNSUPPORTED_TYPE', `${path}: bigint не сериализуется канонически`);
  }

  if (Array.isArray(value)) {
    // Порядок элементов сохраняется (§29).
    return value.map((v, i) => normalize(v, `${path}[${i}]`));
  }

  if (t === 'object') {
    const src = value as Record<string, unknown>;
    const keys = Object.keys(src).filter((k) => src[k] !== undefined);
    keys.sort(compareCodePoints);
    const out: Record<string, CanonicalValue> = {};
    for (const k of keys) {
      out[k.normalize('NFC')] = normalize(src[k], path ? `${path}.${k}` : k);
    }
    return out;
  }

  throw new CasaCjError('CASA_CJ_UNSUPPORTED_TYPE', `${path}: тип ${t} не сериализуется канонически`);
}

/** Каноническая строка CASA-CJ-1 (UTF-8, NFC, без незначащих пробелов). */
export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(value, ''));
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/** SHA-256 от канонической формы значения. */
export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalize(value));
}

/**
 * Явный replay allowlist §29 — дословно и в полном составе.
 *
 * Всё, чего здесь нет, в replay payload не попадает до версионного изменения
 * контракта CASA-CJ. Намеренно исключены (§29): calculation_snapshot_id,
 * tenant_id, status, calculated_at, superseded_by, actor, audit_refs,
 * canonicalization_version и сами input_hash/output_hash/replay_hash — они не
 * определяют детерминированную математику.
 */
export const REPLAY_ALLOWLIST = [
  'schema_version',
  'case_id',
  'client_profile_snapshot',
  'selected_upstream_refs',
  'formula_registry_version',
  'formula_versions',
  'inputs',
  'outputs',
  'blockers',
  'engine_version',
  'decimal_context_version',
] as const;

export type ReplayAllowlistKey = (typeof REPLAY_ALLOWLIST)[number];

/** client_profile_snapshot в replay payload несёт ровно два поля (§29). */
export interface ReplayClientProfileSnapshot {
  snapshot_id: string;
  snapshot_hash: string;
}

export interface ReplaySource {
  schema_version: string;
  case_id: string;
  client_profile_snapshot: ReplayClientProfileSnapshot;
  selected_upstream_refs: Record<string, string | null>;
  formula_registry_version: string;
  formula_versions: string[];
  inputs: CanonicalValue;
  outputs: CanonicalValue;
  blockers: CanonicalValue[];
  engine_version: string;
  decimal_context_version: string;
}

/**
 * Собирает replay payload строго по allowlist. Лишние поля источника
 * отбрасываются молча — это и есть смысл allowlist'а; отсутствие обязательного
 * поля, наоборот, ошибка: молчаливый undefined изменил бы хэш незаметно.
 */
export function buildReplayPayload(source: ReplaySource): Record<string, CanonicalValue> {
  const out: Record<string, CanonicalValue> = {};
  for (const key of REPLAY_ALLOWLIST) {
    const v = (source as unknown as Record<string, unknown>)[key];
    if (v === undefined) {
      throw new CasaCjError(
        'CASA_CJ_MISSING_ALLOWLIST_FIELD',
        `replay payload: отсутствует обязательное поле ${key}`,
      );
    }
    out[key] = v as CanonicalValue;
  }
  return out;
}

export interface CasaCjHashes {
  inputHash: string;
  outputHash: string;
  replayHash: string;
  canonicalizationVersion: string;
  /** Каноническая строка replay payload — evidence и отладка расхождений. */
  canonicalReplayPayload: string;
}

/** Три хэша §29 из одного источника — единственный способ их получать. */
export function computeCasaCjHashes(source: ReplaySource): CasaCjHashes {
  const replayPayload = buildReplayPayload(source);
  const canonicalReplayPayload = canonicalize(replayPayload);
  return {
    inputHash: canonicalHash(source.inputs),
    outputHash: canonicalHash(source.outputs),
    replayHash: sha256Hex(canonicalReplayPayload),
    canonicalizationVersion: CASA_CJ_CANONICALIZATION_VERSION,
    canonicalReplayPayload,
  };
}
