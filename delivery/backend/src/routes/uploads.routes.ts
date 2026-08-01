
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { fileStorageService } from '../services/file-storage.service';
import { prisma } from '../lib/prisma';
import { detectImageExtension, detectDocumentExtension } from '../lib/image-sniff';

export const uploadsRouter = Router();

// Multer in-memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

uploadsRouter.use(authenticate);

// POST /api/uploads/property/:id/images
uploadsRouter.post(
    '/property/:id/images',
    requireRole('BROKER', 'ADMIN'),
    upload.single('file'), // expect field name 'file'
    async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                console.error('Upload Error: req.file is missing. Headers:', req.headers['content-type'], 'Length:', req.headers['content-length']);
            }
            const { id } = req.params;
            const file = req.file;

            if (!file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            // The client-supplied mimetype/filename are attacker-controlled —
            // derive the real extension from the file's actual magic bytes
            // so a renamed HTML/script payload can't be stored as an image.
            const ext = detectImageExtension(file.buffer);
            if (!ext) {
                res.status(400).json({ error: 'Файл не является изображением поддерживаемого формата (jpeg/png/webp)' });
                return;
            }

            const property = await prisma.crmProperty.findUnique({
                where: { id }
            });

            if (!property) {
                res.status(404).json({ error: 'Property not found' });
                return;
            }

            // Generate path: properties/{propertyId}/{timestamp}{ext}
            const timestamp = Date.now();
            const path = `properties/${id}/${timestamp}${ext}`;

            const url = await fileStorageService.uploadFile(file, path);

            // Update DB: append to images array
            const currentImages = property.images as string[] || [];
            const updatedImages = [...currentImages, url];

            const updatedProperty = await prisma.crmProperty.update({
                where: { id },
                data: {
                    images: updatedImages
                }
            });

            res.json({ url, images: updatedProperty.images });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Upload failed' });
        }
    }
);

// DELETE /api/uploads/property/:id/images
// Body: { url: string }
uploadsRouter.delete(
    '/property/:id/images',
    requireRole('BROKER', 'ADMIN'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { url } = req.body;

            if (!url) {
                res.status(400).json({ error: 'URL is required' });
                return;
            }

            const property = await prisma.crmProperty.findUnique({ where: { id } });
            if (!property) {
                res.status(404).json({ error: 'Property not found' });
                return;
            }

            // Remove from array
            const currentImages = property.images as string[] || [];
            const updatedImages = currentImages.filter(img => img !== url);

            await prisma.crmProperty.update({
                where: { id },
                data: { images: updatedImages }
            });

            res.json({ success: true, images: updatedImages });
        } catch (error) {
            console.error('Delete image error:', error);
            res.status(500).json({ error: 'Delete failed' });
        }
    }
);

// POST /api/uploads/property/:id/documents
uploadsRouter.post(
    '/property/:id/documents',
    requireRole('BROKER', 'ADMIN'),
    upload.single('file'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const file = req.file;

            if (!file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            // Same rationale as the images endpoint above — trust the file's
            // actual signature, not the client-supplied mimetype/filename.
            const ext = detectDocumentExtension(file.buffer);
            if (!ext) {
                res.status(400).json({ error: 'Файл не является документом поддерживаемого формата (pdf/doc/docx)' });
                return;
            }

            const property = await prisma.crmProperty.findUnique({ where: { id } });
            if (!property) {
                res.status(404).json({ error: 'Property not found' });
                return;
            }

            // Generate path: properties/{propertyId}/docs/{timestamp}{ext}
            const timestamp = Date.now();
            const path = `properties/${id}/docs/${timestamp}${ext}`;

            const url = await fileStorageService.uploadFile(file, path);

            // Update DB: append to documents array
            const currentDocs = property.documents as string[] || [];
            const updatedDocs = [...currentDocs, url];

            const updatedProperty = await prisma.crmProperty.update({
                where: { id },
                data: { documents: updatedDocs }
            });

            res.json({ url, documents: updatedProperty.documents });
        } catch (error) {
            console.error('Upload document error:', error);
            res.status(500).json({ error: 'Upload failed' });
        }
    }
);

// DELETE /api/uploads/property/:id/documents
uploadsRouter.delete(
    '/property/:id/documents',
    requireRole('BROKER', 'ADMIN'),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { url } = req.body;

            if (!url) {
                res.status(400).json({ error: 'URL is required' });
                return;
            }

            const property = await prisma.crmProperty.findUnique({ where: { id } });
            if (!property) {
                res.status(404).json({ error: 'Property not found' });
                return;
            }

            const currentDocs = property.documents as string[] || [];
            const updatedDocs = currentDocs.filter(doc => doc !== url);

            await prisma.crmProperty.update({
                where: { id },
                data: { documents: updatedDocs }
            });

            res.json({ success: true, documents: updatedDocs });
        } catch (error) {
            console.error('Delete document error:', error);
            res.status(500).json({ error: 'Delete failed' });
        }
    }
);
