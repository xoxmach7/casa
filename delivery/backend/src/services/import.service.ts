import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { normalizePhone } from '../lib/phone.utils';

// ── Interfaces ──

export interface ParseResult {
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExecuteImportParams {
  rows: Record<string, string>[];
  columnMapping: Record<string, string>;
  targetModel: 'seller' | 'client';
  stageMapping: Record<string, string>;
  brokerId: string;
}

export interface ImportRowResult {
  rowNumber: number;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
  recordId?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
  duration: number;
  details: ImportRowResult[];
}

// ── parseFile ──

// Minimal RFC4180-ish CSV parser (quoted fields, embedded commas/newlines,
// escaped "" quotes) — replaces XLSX's CSV-to-array behavior.
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip — \n follows
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellToString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleDateString('ru-RU');
  if (typeof v === 'object') {
    if ('text' in v) return String((v as any).text ?? '');
    if ('result' in v) return String((v as any).result ?? '');
    return String(v);
  }
  return String(v);
}

export async function parseFile(buffer: Buffer, mimetype: string, originalname: string): Promise<ParseResult> {
  const isCSV =
    mimetype === 'text/csv' ||
    originalname.toLowerCase().endsWith('.csv');

  let raw: string[][];

  if (isCSV) {
    // Try UTF-8 first, fallback to Windows-1251
    let csvText: string;
    try {
      csvText = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      csvText = new TextDecoder('windows-1251').decode(buffer);
    }
    raw = parseCsvText(csvText);
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return { columns: [], rows: [], totalRows: 0 };
    }
    raw = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as ExcelJS.CellValue[]; // 1-indexed; index 0 is empty
      raw.push(values.slice(1).map(cellToString));
    });
  }

  if (raw.length === 0) {
    return { columns: [], rows: [], totalRows: 0 };
  }

  const columns = raw[0].map((c) => String(c).trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    // Skip empty rows (all cells empty or whitespace)
    const isEmpty = row.every((cell) => String(cell).trim() === '');
    if (isEmpty) continue;

    const record: Record<string, string> = {};
    for (let j = 0; j < columns.length; j++) {
      record[columns[j]] = String(row[j] ?? '').trim();
    }
    rows.push(record);
  }

  return { columns, rows, totalRows: rows.length };
}

// ── detectDataType ──

export function detectDataType(columns: string[]): 'contacts' | 'deals' {
  const lower = columns.map((c) => c.toLowerCase());
  const dealKeywords = ['бюджет', 'воронка', 'этап', 'название сделки'];
  const hasDealColumns = dealKeywords.some((kw) => lower.includes(kw));
  return hasDealColumns ? 'deals' : 'contacts';
}

// ── splitFullName ──

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) {
    return { firstName: 'Без имени', lastName: '' };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return { lastName: parts[0], firstName: parts[1] };
}

// ── suggestColumnMapping ──

export function suggestColumnMapping(
  columns: string[],
  targetModel: 'seller' | 'client',
): Record<string, string> {
  const mapping: Record<string, string> = {};

  const sellerMap: Record<string, string> = {
    'имя': 'fullName',
    'телефон': 'phone',
    'email': 'email',
    'город': 'city',
    'примечания': 'managerComment',
    'источник': 'source',
    'этап': 'funnelStage',
    'теги': 'managerComment',
  };

  const clientMap: Record<string, string> = {
    'имя': 'fullName',
    'телефон': 'phone',
    'email': 'email',
    'город': 'city',
    'примечания': 'notes',
    'этап': 'status',
    'бюджет': 'budget',
    'теги': 'notes',
  };

  const map = targetModel === 'seller' ? sellerMap : clientMap;

  for (const col of columns) {
    const lower = col.toLowerCase();
    if (map[lower]) {
      mapping[col] = map[lower];
    }
  }

  return mapping;
}

// ── validateRow ──

export function validateRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
  targetModel: 'seller' | 'client',
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Find the column mapped to 'phone'
  const phoneCol = Object.keys(mapping).find((k) => mapping[k] === 'phone');
  const phoneValue = phoneCol ? row[phoneCol] : undefined;

  if (!phoneValue || !phoneValue.trim()) {
    errors.push('Отсутствует обязательное поле: телефон');
  } else {
    const normalized = normalizePhone(phoneValue.trim());
    if (!normalized || normalized.length < 5) {
      warnings.push('Некорректный формат телефона');
    }
  }

  if (targetModel === 'client') {
    const iinCol = Object.keys(mapping).find((k) => mapping[k] === 'iin');
    const iinValue = iinCol ? row[iinCol] : undefined;
    // iin is required in schema but we generate placeholder during import,
    // so we only warn if mapping exists but value is empty
    if (iinCol && (!iinValue || !iinValue.trim())) {
      warnings.push('Поле ИИН пустое — будет сгенерирован placeholder');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Helper: build client notes with unmapped data ──

function buildClientNotes(baseNotes: string, row: Record<string, string>, unmappedColumns: string[]): string | undefined {
  const parts: string[] = [];
  if (baseNotes) parts.push(baseNotes);

  for (const col of unmappedColumns) {
    const val = (row[col] ?? '').trim();
    if (val) parts.push(`${col}: ${val}`);
  }

  return parts.length > 0 ? parts.join(' | ') : undefined;
}

// ── executeImport ──

export async function executeImport(params: ExecuteImportParams): Promise<ImportResult> {
  const { rows, columnMapping, targetModel, stageMapping, brokerId } = params;
  const startTime = Date.now();
  const details: ImportRowResult[] = [];
  let created = 0;
  let skipped = 0;
  let errorCount = 0;

  // Build reverse mapping: Casa field → amoCRM column
  const fieldToCol: Record<string, string> = {};
  for (const [col, field] of Object.entries(columnMapping)) {
    fieldToCol[field] = col;
  }

  const getValue = (row: Record<string, string>, field: string): string => {
    const col = fieldToCol[field];
    return col ? (row[col] ?? '').trim() : '';
  };

  // Find unmapped columns (columns not in columnMapping)
  const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const mappedColumns = new Set(Object.keys(columnMapping));
  const unmappedColumns = allColumns.filter((col) => !mappedColumns.has(col) && col.trim() !== '');

  // Auto-create custom fields for unmapped columns
  const customFieldMap: Record<string, string> = {}; // column name → customField ID
  if (unmappedColumns.length > 0 && targetModel === 'seller') {
    for (const colName of unmappedColumns) {
      // Check if custom field with this name already exists for this user
      let field = await prisma.customField.findFirst({
        where: { name: colName, userId: brokerId, entityType: 'SELLER' },
      });
      if (!field) {
        field = await prisma.customField.create({
          data: {
            name: colName,
            type: 'TEXT',
            entityType: 'SELLER',
            userId: brokerId,
            isActive: true,
          },
        });
      }
      customFieldMap[colName] = field.id;
    }
  }

  // Load existing phones for duplicate detection
  const existingPhones = new Set<string>();
  if (targetModel === 'seller') {
    const sellers = await prisma.seller.findMany({ select: { phone: true } });
    for (const s of sellers) {
      existingPhones.add(normalizePhone(s.phone));
    }
  } else {
    const clients = await prisma.client.findMany({ select: { phone: true } });
    for (const c of clients) {
      existingPhones.add(normalizePhone(c.phone));
    }
  }

  // Track phones seen in this file
  const seenPhones = new Set<string>();

  // Accumulated across all rows, flushed in one createMany after the loop
  // instead of one create() per unmapped column per row.
  const customFieldValuesToCreate: { fieldId: string; sellerId: string; value: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    try {
      // Get and normalize phone
      const rawPhone = getValue(row, 'phone');
      if (!rawPhone) {
        details.push({ rowNumber, status: 'error', reason: 'Отсутствует телефон' });
        errorCount++;
        continue;
      }
      const phone = normalizePhone(rawPhone);

      // Check duplicate in DB
      if (existingPhones.has(phone)) {
        details.push({ rowNumber, status: 'skipped', reason: 'Дубликат' });
        skipped++;
        continue;
      }

      // Check duplicate in file
      if (seenPhones.has(phone)) {
        details.push({ rowNumber, status: 'skipped', reason: 'Дубликат в файле' });
        skipped++;
        continue;
      }
      seenPhones.add(phone);

      // Split name
      const fullNameValue = getValue(row, 'fullName');
      const { firstName, lastName } = splitFullName(fullNameValue);

      if (targetModel === 'seller') {
        // Map funnel stage
        const rawStage = getValue(row, 'funnelStage');
        const mappedStage = rawStage && stageMapping[rawStage]
          ? stageMapping[rawStage]
          : 'CONTACT';

        const record = await prisma.seller.create({
          data: {
            firstName,
            lastName,
            phone,
            email: getValue(row, 'email') || undefined,
            city: getValue(row, 'city') || undefined,
            source: getValue(row, 'source') || undefined,
            managerComment: getValue(row, 'managerComment') || undefined,
            funnelStage: mappedStage as any,
            brokerId,
            isActive: true,
            readyToNegotiate: true,
            plansToPurchase: false,
            plansMortgage: false,
            hasDebts: false,
            readyForExclusive: false,
            trustLevel: 3,
            strategyConfirmed: false,
          },
        });

        // Collect unmapped columns as custom field values, created in one
        // batch after the loop instead of per-row/per-column inserts.
        for (const [colName, fieldId] of Object.entries(customFieldMap)) {
          const val = (row[colName] ?? '').trim();
          if (val) {
            customFieldValuesToCreate.push({ fieldId, sellerId: record.id, value: val });
          }
        }

        existingPhones.add(phone);
        details.push({ rowNumber, status: 'created', recordId: record.id });
        created++;
      } else {
        // Client
        const rawStage = getValue(row, 'status');
        const mappedStatus = rawStage && stageMapping[rawStage]
          ? stageMapping[rawStage]
          : 'NEW';

        const iinValue = getValue(row, 'iin') || `IMPORT-${rowNumber}`;

        const budgetRaw = getValue(row, 'budget');
        const budget = budgetRaw ? parseFloat(budgetRaw) : undefined;
        const budgetWarning = budgetRaw && isNaN(Number(budgetRaw));

        const record = await prisma.client.create({
          data: {
            firstName,
            lastName,
            phone,
            email: getValue(row, 'email') || undefined,
            city: getValue(row, 'city') || undefined,
            iin: iinValue,
            clientType: 'BUYER' as any,
            status: mappedStatus as any,
            budget: budget && !isNaN(budget) ? budget : undefined,
            notes: buildClientNotes(getValue(row, 'notes'), row, unmappedColumns),
            brokerId,
          },
        });

        if (budgetWarning) {
          details.push({
            rowNumber,
            status: 'created',
            reason: 'Предупреждение: некорректный бюджет',
            recordId: record.id,
          });
        } else {
          details.push({ rowNumber, status: 'created', recordId: record.id });
        }

        existingPhones.add(phone);
        created++;
      }
    } catch (err: any) {
      details.push({
        rowNumber,
        status: 'error',
        reason: err.message || 'Ошибка создания записи',
      });
      errorCount++;
    }
  }

  if (customFieldValuesToCreate.length > 0) {
    await prisma.customFieldValue.createMany({ data: customFieldValuesToCreate });
  }

  return {
    created,
    skipped,
    errors: errorCount,
    duration: Date.now() - startTime,
    details,
  };
}
