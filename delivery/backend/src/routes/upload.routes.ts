import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { authenticate } from '../middleware/auth.middleware';
import { minioClient, MINIO_BUCKET, getPublicUrl } from '../lib/minio';

export const uploadRouter = Router();
uploadRouter.use(authenticate);

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedMimeTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    // Videos
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska',
    'video/matroska',
    'video/avi',
    'video/x-msvideo',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Helper to determine file type category
const getFileCategory = (mimetype: string): string => {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  return 'documents';
};

// POST /api/upload/single - Upload single file
uploadRouter.post('/single', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const file = req.file;
    const category = getFileCategory(file.mimetype);
    const ext = path.extname(file.originalname);
    const fileName = `${category}/${uuidv4()}${ext}`;

    // Upload to local storage (MinIO disabled)
    const uploadDir = path.join(__dirname, '../../uploads', category);
    const fs = await import('fs/promises');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, `${path.basename(fileName)}`), file.buffer);

    const url = `/uploads/${fileName}`;

    res.json({
      success: true,
      file: {
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        category,
        url,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

// POST /api/upload/multiple - Upload multiple files
uploadRouter.post('/multiple', upload.array('files', 10), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ error: 'Файлы не загружены' });
      return;
    }

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        const category = getFileCategory(file.mimetype);
        const ext = path.extname(file.originalname);
        const fileName = `${category}/${uuidv4()}${ext}`;

        await minioClient!.putObject(
          MINIO_BUCKET,
          fileName,
          file.buffer,
          file.size,
          { 'Content-Type': file.mimetype }
        );

        return {
          fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          category,
          url: getPublicUrl(fileName),
        };
      })
    );

    res.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Ошибка загрузки файлов' });
  }
});

// DELETE /api/upload/:fileName - Delete a file
uploadRouter.delete('/:fileName(*)', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName } = req.params;

    await minioClient!.removeObject(MINIO_BUCKET, fileName);

    res.json({
      success: true,
      message: 'Файл удален',
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// GET /api/upload/presigned/:fileName - Get presigned URL for direct upload
uploadRouter.get('/presigned/:category', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const { filename } = req.query;
    
    if (!filename) {
      res.status(400).json({ error: 'Имя файла обязательно' });
      return;
    }

    const ext = path.extname(filename as string);
    const objectName = `${category}/${uuidv4()}${ext}`;

    // Generate presigned URL valid for 1 hour
    const presignedUrl = await minioClient!.presignedPutObject(
      MINIO_BUCKET,
      objectName,
      60 * 60 // 1 hour
    );

    res.json({
      presignedUrl,
      objectName,
      publicUrl: getPublicUrl(objectName),
    });
  } catch (error) {
    console.error('Presigned URL error:', error);
    res.status(500).json({ error: 'Ошибка получения URL для загрузки' });
  }
});
