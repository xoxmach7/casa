/**
 * Маскировка объекта до фиксации.
 *
 * Это второй из трёх механизмов против обхода площадки. Собственник, в
 * отличие от застройщика, никому не эксклюзивен: он спокойно висит и на
 * Krisha, и в чате ЖК. Задача маскировки — не спрятать объект, а сделать
 * его сопоставление с внешним объявлением дороже, чем фиксация.
 *
 * Поэтому скрываются не только адрес и контакты, но и ССЫЛКИ НА ВНЕШНИЕ
 * ПЛОЩАДКИ (`krishaUrl`, `olxUrl` и прочие). Оставить их — значит выдать
 * агенту прямой маршрут в обход: один клик, и он говорит с собственником
 * напрямую.
 *
 * Честная граница: по фотографиям интерьера дом всё же можно узнать, а
 * пометок «это фасад» у изображений нет. Полностью закрыть этот канал
 * маскировкой нельзя, и на неё это не возлагается — её работа поднять
 * стоимость обхода, а держат комиссию договор и защитный период.
 */

/** Поля, которых нет в публичном виде ни при каком уровне договора. */
const ALWAYS_HIDDEN = [
  'address',
  'notes',
  'internalAccessNote',
  'casaUrl',
  'krishaUrl',
  'knUrl',
  'olxUrl',
  'instagramUrl',
  'tikTokUrl',
  'videoUrl',
  'virtualTourUrl',
  'documents',
] as const;

/** Округление координат до ~500 м: карта работает, подъезд не находится. */
function blurCoordinate(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 200) / 200;
}

export interface MaskOptions {
  /** Есть ли у смотрящего действующая фиксация на этот объект. */
  unlocked: boolean;
  /** Уровень договора: у эксклюзива маскировка мягче (карта показывается). */
  tier?: 'BASIC' | 'EXCLUSIVE' | null;
}

export interface MaskedProperty {
  [key: string]: unknown;
  /** Прямой признак для интерфейса, а не догадка по отсутствию полей. */
  isMasked: boolean;
  maskedFields: string[];
}

/**
 * Возвращает представление объекта для агента.
 *
 * При `unlocked: true` объект отдаётся как есть — фиксация уже состоялась,
 * прятать нечего.
 */
export function maskProperty<T extends Record<string, any>>(
  property: T,
  { unlocked, tier = null }: MaskOptions,
): MaskedProperty {
  if (unlocked) {
    return { ...property, isMasked: false, maskedFields: [] };
  }

  const masked: Record<string, unknown> = { ...property };
  const maskedFields: string[] = [];

  for (const field of ALWAYS_HIDDEN) {
    if (field in masked) {
      delete masked[field];
      maskedFields.push(field);
    }
  }

  // Продавец целиком не отдаётся: имя и телефон собственника — это и есть
  // то, ради чего обходят площадку.
  if ('seller' in masked) {
    delete masked.seller;
    maskedFields.push('seller');
  }
  if ('sellerId' in masked) {
    delete masked.sellerId;
    maskedFields.push('sellerId');
  }

  if (tier === 'EXCLUSIVE') {
    // Мягкая маскировка: карта работает, но с точностью до квартала.
    masked.lat = blurCoordinate(property.lat);
    masked.lng = blurCoordinate(property.lng);
    masked.coordinatesApproximate = true;
    maskedFields.push('exactCoordinates');
  } else {
    masked.lat = null;
    masked.lng = null;
    masked.coordinatesApproximate = false;
    maskedFields.push('lat', 'lng');
  }

  return { ...masked, isMasked: true, maskedFields };
}
