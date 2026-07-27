import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  parseFile,
  detectDataType,
  validateRow,
  executeImport,
} from '../services/import.service';
import { normalizePhone } from '../lib/phone.utils';
import { prisma } from '../lib/prisma';

export const importRouter = Router();

// All import endpoints require ADMIN role
importRouter.use(authenticate, requireRole('ADMIN'));

// Multer config: memoryStorage, 10MB limit, field name 'file'
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const ALLOWED_EXTENSIONS = ['.xls', '.xlsx', '.csv'];

// ── POST /upload ──
importRouter.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    // Validate file extension
    const originalname = req.file.originalname.toLowerCase();
    const ext = originalname.substring(originalname.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      res.status(400).json({
        error: 'Неподдерживаемый формат файла. Загрузите файл XLS, XLSX или CSV',
      });
      return;
    }

    const parsed = parseFile(req.file.buffer, req.file.mimetype, req.file.originalname);

    if (parsed.totalRows === 0) {
      res.status(400).json({ error: 'Файл не содержит данных для импорта' });
      return;
    }

    const detectedType = detectDataType(parsed.columns);
    const previewRows = parsed.rows.slice(0, 5);

    res.json({
      columns: parsed.columns,
      previewRows,
      totalRows: parsed.totalRows,
      detectedType,
      allRows: parsed.rows,
    });
  } catch (err: any) {
    console.error('Import upload error:', err);
    res.status(400).json({
      error: 'Ошибка чтения файла. Проверьте формат и кодировку',
    });
  }
});


// ── POST /preview ──
importRouter.post('/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows, columnMapping, targetModel } = req.body as {
      rows: Record<string, string>[];
      columnMapping: Record<string, string>;
      targetModel: 'seller' | 'client';
    };

    if (!rows || !columnMapping || !targetModel) {
      res.status(400).json({ error: 'Отсутствуют обязательные параметры: rows, columnMapping, targetModel' });
      return;
    }

    // Build reverse mapping to find phone column
    const phoneCol = Object.keys(columnMapping).find((k) => columnMapping[k] === 'phone');

    // Load existing phones from DB for duplicate detection
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

    // Track phones seen in file for in-file duplicate detection
    const seenPhones = new Set<string>();

    let valid = 0;
    let duplicates = 0;
    let duplicatesInFile = 0;
    let errors = 0;

    const resultRows = rows.map((row, idx) => {
      const rowNumber = idx + 1;

      // Validate the row
      const validation = validateRow(row, columnMapping, targetModel);

      if (!validation.valid) {
        errors++;
        return {
          rowNumber,
          data: row,
          status: 'error' as const,
          error: validation.errors.join('; '),
        };
      }

      // Check duplicates by phone
      const rawPhone = phoneCol ? (row[phoneCol] ?? '').trim() : '';
      if (rawPhone) {
        const normalized = normalizePhone(rawPhone);

        if (existingPhones.has(normalized)) {
          duplicates++;
          return {
            rowNumber,
            data: row,
            status: 'duplicate' as const,
          };
        }

        if (seenPhones.has(normalized)) {
          duplicatesInFile++;
          return {
            rowNumber,
            data: row,
            status: 'duplicate_in_file' as const,
          };
        }

        seenPhones.add(normalized);
      }

      valid++;
      return {
        rowNumber,
        data: row,
        status: 'valid' as const,
      };
    });

    res.json({
      rows: resultRows,
      stats: {
        total: rows.length,
        valid,
        duplicates,
        duplicatesInFile,
        errors,
      },
    });
  } catch (err: any) {
    console.error('Import preview error:', err);
    res.status(500).json({ error: 'Ошибка валидации данных' });
  }
});

// ── POST /execute ──
importRouter.post('/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows, columnMapping, targetModel, stageMapping } = req.body as {
      rows: Record<string, string>[];
      columnMapping: Record<string, string>;
      targetModel: 'seller' | 'client';
      stageMapping: Record<string, string>;
    };

    if (!rows || !columnMapping || !targetModel) {
      res.status(400).json({ error: 'Отсутствуют обязательные параметры: rows, columnMapping, targetModel' });
      return;
    }

    const brokerId = req.user!.userId;

    const result = await executeImport({
      rows,
      columnMapping,
      targetModel,
      stageMapping: stageMapping || {},
      brokerId,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Import execute error:', err);
    res.status(500).json({ error: 'Импорт прерван из-за ошибки соединения с базой данных' });
  }
});
