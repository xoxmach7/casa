import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileStorageService } from '../services/file-storage.service';
import { detectImageExtension } from '../lib/image-sniff';

export const publicUploadsRouter = Router();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB per photo
const MAX_FILES = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`));
    }
  },
});

// multer's fileFilter/size errors reach next(err) — without this handler
// they'd fall through to the app's generic error middleware as a 500 instead
// of the 400 an anonymous caller sending a bad file should see.
function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.array('files', MAX_FILES)(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка загрузки файлов' });
      return;
    }
    next();
  });
}

// POST /api/public/uploads — anonymous photo upload for the "Добавить квартиру"
// wizard. Images only, capped in count and size; no association with any
// property record is made here (the wizard attaches the returned URLs to its
// property-lead payload separately).
publicUploadsRouter.post('/', handleUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Файлы не загружены' });
      return;
    }

    // The client-supplied mimetype/filename are fully attacker-controlled —
    // derive the real extension from the file's actual magic bytes so a
    // renamed HTML/script payload can't be stored (and later served) as if
    // it were an image.
    for (const file of files) {
      if (!detectImageExtension(file.buffer)) {
        res.status(400).json({ error: 'Файл не является изображением поддерживаемого формата (jpeg/png/webp)' });
        return;
      }
    }

    const urls = await Promise.all(
      files.map((file) => {
        const ext = detectImageExtension(file.buffer)!;
        const objectPath = `property-leads/${uuidv4()}${ext}`;
        return fileStorageService.uploadFile(file, objectPath);
      })
    );

    res.json({ urls });
  } catch (error: any) {
    console.error('Public upload error:', error);
    res.status(400).json({ error: error.message || 'Ошибка загрузки файлов' });
  }
});
