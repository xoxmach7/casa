/**
 * M02 R0 — external source registry и frozen Manifest v1.
 *
 * Источник: M02_CASA_Pro_IIN_Check_R0_Implementation_and_Acceptance_v1.0 §8
 * (таблица Source Registry / Manifest v1). Состав, классы, каналы, режимы R0,
 * legal/access, CAPTCHA и no-match контракты перенесены из таблицы, а не
 * придуманы.
 *
 * Ключевые инварианты §8/§23:
 *  - ВСЕ внешние коннекторы выключены (deny-by-default). R0 обязан работать
 *    целиком без единого production-вызова; SmartBridge/AIS OIP/КГД — это R1/R2.
 *  - Coverage denominator берётся из ЗАМОРОЖЕННОГО манифеста конкретного batch,
 *    а не из живого реестра: дрейф реестра не должен задним числом менять
 *    покрытие уже выполненного прогона.
 *  - «Технически доступный URL не равен разрешённой автоматизации» (§7
 *    SOURCE_GATE): наличие official_url ничего не разрешает.
 */

export type SourceClass = 'BASE_REQUIRED' | 'IP_CONDITIONAL' | 'CASE_CONDITIONAL' | 'PROHIBITED';

/**
 * Режим источника в R0. Различаются намеренно (§23 п.2): automatic / manual /
 * client-authorized / unavailable / prohibited — это разные вещи, и ни один из
 * них не эквивалентен «проверено».
 */
export type AutomationMode =
  | 'MANUAL'
  | 'CLIENT_AUTHORIZED'
  | 'UNAVAILABLE'
  | 'PROHIBITED'
  | 'AUTOMATIC';

export type LegalStatus = 'REQUIRED' | 'MANUAL_LEGAL' | 'CLIENT_GATE' | 'SEPARATE_PURPOSE' | 'REJECTED';

export interface RegisteredSource {
  /** Стабильный код источника — попадает в result и evidence. */
  code: string;
  checkType: string;
  sourceClass: SourceClass;
  /** Официальный владелец источника — показывается брокеру. */
  owner: string;
  /** Только базовый официальный URL. ИИН в query/path запрещён (§11). */
  officialUrl: string;
  /** Режим в R0. */
  automationModeR0: AutomationMode;
  consentRequired: boolean;
  legalStatus: LegalStatus;
  /** Ожидается ли CAPTCHA. Обходить её запрещено (§11) — только человек. */
  captchaExpected: boolean;
  /**
   * Включён ли автоматический коннектор. В R0 — всегда false.
   * Изменение этого поля само по себе ничего не открывает: маршрут дополнительно
   * проверяет legal/access гейты.
   */
  connectorEnabled: false;
  /**
   * Документированный контракт «нет записей» для этого источника. null означает,
   * что доказанный negative для источника НЕ определён, и NOT_FOUND по нему
   * невозможен ни при каких наблюдениях (§12).
   */
  noMatchContract: string | null;
  /** TTL свежести из policy реестра (секунды). null → UNKNOWN, не «вечно». */
  freshnessTtlSeconds: number | null;
  /** Allowlist нормализованных фактов: всё, чего здесь нет, не сохраняется. */
  factAllowlist: string[];
  /** Блокирует ли источник вывод COMPLETE_NO_RECORDS. */
  blocksClean: boolean;
}

const DAY = 24 * 60 * 60;

/**
 * Реестр v1. Семь BASE_REQUIRED check_type — это знаменатель покрытия базового
 * манифеста; exit_restriction хранится отдельным результатом, хотя может
 * опираться на тот же ответ AIS OIP (§8).
 */
export const EXTERNAL_SOURCE_REGISTRY_VERSION = 'casa.m02.source-registry/1.0.0';

export const EXTERNAL_SOURCE_REGISTRY: readonly RegisteredSource[] = [
  {
    code: 'AIS_OIP_ENFORCEMENT',
    checkType: 'enforcement_proceedings',
    sourceClass: 'BASE_REQUIRED',
    owner: 'Министерство юстиции РК / АИС ОИП',
    officialUrl: 'https://aisoip.adilet.gov.kz/',
    automationModeR0: 'MANUAL',
    consentRequired: true,
    legalStatus: 'REQUIRED',
    captchaExpected: true,
    connectorEnabled: false,
    // §12: допустимо только как source-specific contract с upstream-кодом.
    noMatchContract: 'AIS_OIP_SCSE001',
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['proceeding_count', 'has_active_proceeding', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'AIS_OIP_EXIT_RESTRICTION',
    checkType: 'exit_restriction',
    sourceClass: 'BASE_REQUIRED',
    owner: 'Министерство юстиции РК / АИС ОИП',
    officialUrl: 'https://aisoip.adilet.gov.kz/',
    automationModeR0: 'MANUAL',
    consentRequired: true,
    legalStatus: 'REQUIRED',
    captchaExpected: true,
    connectorEnabled: false,
    noMatchContract: 'AIS_OIP_SCSE001',
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['has_exit_restriction', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'ENIS_EXECUTIVE_INSCRIPTION',
    checkType: 'executive_inscription',
    sourceClass: 'BASE_REQUIRED',
    owner: 'ЕНИС (нотариат)',
    officialUrl: 'https://enis.kz/',
    automationModeR0: 'MANUAL',
    consentRequired: true,
    legalStatus: 'MANUAL_LEGAL',
    captchaExpected: true,
    connectorEnabled: false,
    // API нет; доказанный negative возможен только ручным контрактом.
    noMatchContract: 'MANUAL_OFFICIAL_NO_MATCH',
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['inscription_count', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'KGD_TAXPAYER_IP_STATUS',
    checkType: 'taxpayer_ip_status',
    sourceClass: 'BASE_REQUIRED',
    owner: 'КГД МФ РК',
    officialUrl: 'https://kgd.gov.kz/',
    automationModeR0: 'UNAVAILABLE',
    consentRequired: true,
    legalStatus: 'REQUIRED',
    captchaExpected: true,
    connectorEnabled: false,
    noMatchContract: 'MANUAL_OFFICIAL_NO_MATCH',
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['ip_status', 'registration_date', 'deregistration_date', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'KGD_TAX_DEBT',
    checkType: 'tax_debt',
    sourceClass: 'BASE_REQUIRED',
    owner: 'КГД МФ РК / eGov',
    officialUrl: 'https://kgd.gov.kz/',
    automationModeR0: 'CLIENT_AUTHORIZED',
    consentRequired: true,
    legalStatus: 'CLIENT_GATE',
    captchaExpected: true,
    connectorEnabled: false,
    noMatchContract: 'CLIENT_CERTIFICATE_ZERO_DEBT',
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['debt_total', 'as_of_date', 'certificate_reference', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'KGD_BANKRUPTCY_NONJUDICIAL',
    checkType: 'bankruptcy_nonjudicial',
    sourceClass: 'BASE_REQUIRED',
    owner: 'КГД МФ РК',
    officialUrl: 'https://kgd.gov.kz/',
    automationModeR0: 'MANUAL',
    consentRequired: true,
    legalStatus: 'REQUIRED',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: 'MANUAL_OFFICIAL_NO_MATCH',
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['matched_subject', 'list_reference', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'KGD_BANKRUPTCY_JUDICIAL',
    checkType: 'bankruptcy_judicial_restoration',
    sourceClass: 'BASE_REQUIRED',
    owner: 'КГД МФ РК',
    officialUrl: 'https://kgd.gov.kz/',
    automationModeR0: 'MANUAL',
    consentRequired: true,
    legalStatus: 'REQUIRED',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: 'MANUAL_OFFICIAL_NO_MATCH',
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['matched_subject', 'case_metadata', 'source_reference'],
    blocksClean: true,
  },

  // --- Условные: в знаменатель НЕ входят, пока условие не доказано ---------
  {
    code: 'KGD_COUNTERPARTY_PROFILE',
    checkType: 'kgd_counterparty_profile',
    sourceClass: 'IP_CONDITIONAL',
    owner: 'КГД МФ РК (counterparty)',
    officialUrl: 'https://kgd.gov.kz/',
    automationModeR0: 'UNAVAILABLE',
    consentRequired: true,
    legalStatus: 'SEPARATE_PURPOSE',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['profile_fields', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'KGD_TAX_REPORTING_SUSPENSION',
    checkType: 'tax_reporting_suspension',
    sourceClass: 'IP_CONDITIONAL',
    owner: 'КГД МФ РК',
    officialUrl: 'https://kgd.gov.kz/',
    automationModeR0: 'CLIENT_AUTHORIZED',
    consentRequired: true,
    legalStatus: 'CLIENT_GATE',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['suspension_status', 'period_from', 'period_to', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'EGOV_LEGAL_ENTITY_PARTICIPATION',
    checkType: 'legal_entity_participation',
    sourceClass: 'CASE_CONDITIONAL',
    owner: 'eGov / Министерство юстиции РК',
    officialUrl: 'https://egov.kz/',
    automationModeR0: 'CLIENT_AUTHORIZED',
    consentRequired: true,
    legalStatus: 'SEPARATE_PURPOSE',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['bin', 'legal_entity_name', 'role', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'EGOV_PROPERTY_RIGHTS',
    checkType: 'property_rights',
    sourceClass: 'CASE_CONDITIONAL',
    owner: 'eGov / Министерство юстиции РК',
    officialUrl: 'https://egov.kz/',
    automationModeR0: 'CLIENT_AUTHORIZED',
    consentRequired: true,
    legalStatus: 'SEPARATE_PURPOSE',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    // §8: 24 часа. Адрес — отдельная цель, в allowlist не входит.
    freshnessTtlSeconds: DAY,
    factAllowlist: ['property_count', 'has_property', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'EGOV_MOVABLE_PLEDGE',
    checkType: 'movable_pledge',
    sourceClass: 'CASE_CONDITIONAL',
    owner: 'eGov',
    officialUrl: 'https://egov.kz/',
    automationModeR0: 'CLIENT_AUTHORIZED',
    consentRequired: true,
    legalStatus: 'SEPARATE_PURPOSE',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: DAY,
    factAllowlist: ['pledge_count', 'has_pledge', 'source_reference'],
    blocksClean: true,
  },
  {
    code: 'ELICENSE_STATUS',
    checkType: 'license_status',
    sourceClass: 'CASE_CONDITIONAL',
    owner: 'eLicense / eGov',
    officialUrl: 'https://elicense.kz/',
    automationModeR0: 'MANUAL',
    consentRequired: true,
    legalStatus: 'MANUAL_LEGAL',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: 'MANUAL_OFFICIAL_NO_MATCH',
    freshnessTtlSeconds: 7 * DAY,
    factAllowlist: ['license_status', 'license_reference', 'source_reference'],
    blocksClean: true,
  },

  // --- Запрещённые: существуют в реестре, чтобы их можно было отвергнуть ----
  {
    code: 'PROHIBITED_COURT_ACTS_BLANKET',
    checkType: 'court_acts_blanket_screening',
    sourceClass: 'PROHIBITED',
    owner: 'Разные',
    officialUrl: '',
    automationModeR0: 'PROHIBITED',
    consentRequired: false,
    legalStatus: 'REJECTED',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: null,
    factAllowlist: [],
    blocksClean: false,
  },
  {
    code: 'PROHIBITED_CREDIT_HISTORY_DIRECT',
    checkType: 'credit_history_direct',
    sourceClass: 'PROHIBITED',
    owner: 'Разные',
    officialUrl: '',
    automationModeR0: 'PROHIBITED',
    consentRequired: false,
    legalStatus: 'REJECTED',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: null,
    factAllowlist: [],
    blocksClean: false,
  },
  {
    code: 'PROHIBITED_ENPF_DIRECT',
    checkType: 'enpf_direct',
    sourceClass: 'PROHIBITED',
    owner: 'Разные',
    officialUrl: '',
    automationModeR0: 'PROHIBITED',
    consentRequired: false,
    legalStatus: 'REJECTED',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: null,
    factAllowlist: [],
    blocksClean: false,
  },
  {
    code: 'PROHIBITED_BANK_DATA',
    checkType: 'bank_data',
    sourceClass: 'PROHIBITED',
    owner: 'Разные',
    officialUrl: '',
    automationModeR0: 'PROHIBITED',
    consentRequired: false,
    legalStatus: 'REJECTED',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: null,
    factAllowlist: [],
    blocksClean: false,
  },
  {
    code: 'PROHIBITED_CLOSED_GOV_DATA',
    checkType: 'closed_gov_data',
    sourceClass: 'PROHIBITED',
    owner: 'Разные',
    officialUrl: '',
    automationModeR0: 'PROHIBITED',
    consentRequired: false,
    legalStatus: 'REJECTED',
    captchaExpected: false,
    connectorEnabled: false,
    noMatchContract: null,
    freshnessTtlSeconds: null,
    factAllowlist: [],
    blocksClean: false,
  },
] as const;

export const MANIFEST_V1_VERSION = 'casa.m02.manifest/1.0.0';

/** Цель обработки, к которой привязано согласие для M02 (§7 CONSENT). */
export const M02_CONSENT_PURPOSE = 'mortgage_preanalysis_official_registry_checks';

export interface ManifestEntry {
  sourceCode: string;
  checkType: string;
  sourceClass: SourceClass;
  automationModeR0: AutomationMode;
  /** Входит ли в знаменатель покрытия ЭТОГО batch. */
  required: boolean;
}

export interface FrozenManifest {
  manifestVersion: string;
  registryVersion: string;
  consentPurpose: string;
  entries: ManifestEntry[];
  /** Знаменатель coverage: количество активных required check_type. */
  requiredTotal: number;
}

export function getSource(code: string): RegisteredSource | undefined {
  return EXTERNAL_SOURCE_REGISTRY.find((s) => s.code === code);
}

export function getSourceByCheckType(checkType: string): RegisteredSource | undefined {
  return EXTERNAL_SOURCE_REGISTRY.find((s) => s.checkType === checkType);
}

/**
 * Замораживает манифест для конкретного batch.
 *
 * Conditional check_type входит в знаменатель ТОЛЬКО если условие доказано и
 * согласие покрывает его цель (§9 required_total). Пустой список условий —
 * нормальный случай R0: знаменатель равен семи базовым проверкам.
 *
 * PROHIBITED в манифест не попадают никогда: их нельзя ни выполнить, ни
 * посчитать в покрытии — они существуют только чтобы быть отвергнутыми.
 */
export function freezeManifestV1(options: {
  provenConditionalCheckTypes?: readonly string[];
} = {}): FrozenManifest {
  const proven = new Set(options.provenConditionalCheckTypes ?? []);

  const entries: ManifestEntry[] = EXTERNAL_SOURCE_REGISTRY
    .filter((s) => s.sourceClass !== 'PROHIBITED')
    .map((s) => ({
      sourceCode: s.code,
      checkType: s.checkType,
      sourceClass: s.sourceClass,
      automationModeR0: s.automationModeR0,
      required: s.sourceClass === 'BASE_REQUIRED' || proven.has(s.checkType),
    }));

  return {
    manifestVersion: MANIFEST_V1_VERSION,
    registryVersion: EXTERNAL_SOURCE_REGISTRY_VERSION,
    consentPurpose: M02_CONSENT_PURPOSE,
    entries,
    requiredTotal: entries.filter((e) => e.required).length,
  };
}

/**
 * Единственная точка, где решается, разрешён ли автоматический вызов источника.
 *
 * В R0 всегда false. Функция существует, чтобы R1/R2 подключали адаптер здесь,
 * а не расставляли условия по коду.
 */
export function isConnectorAllowed(source: RegisteredSource): boolean {
  if (source.sourceClass === 'PROHIBITED') return false;
  if (!source.connectorEnabled) return false;
  if (source.legalStatus !== 'REQUIRED') return false;
  return source.automationModeR0 === 'AUTOMATIC';
}
