
import { Client } from 'minio';
import fs from 'fs';
import path from 'path';

class FileStorageService {
    private client: Client | null = null;
    private bucket: string;
    private uploadDir: string;

    constructor() {
        this.bucket = process.env.MINIO_BUCKET || 'casa-crm-uploads';
        this.uploadDir = path.join(__dirname, '../../uploads'); // Adjust path relative to src/services

        // Check if config exists, otherwise use local fs
        if (!process.env.MINIO_ENDPOINT) {
            console.warn("MinIO config missing. Using local file system storage.");
            this.ensureUploadDir();
            return;
        }

        // Parse endpoint - remove protocol prefix if present
        let endPoint = process.env.MINIO_ENDPOINT
            .replace('http://', '')
            .replace('https://', '');

        // Remove port from endpoint if included
        if (endPoint.includes(':')) {
            endPoint = endPoint.split(':')[0];
        }

        // Use separate MINIO_PORT env var or default to 9000
        const port = parseInt(process.env.MINIO_PORT || '9000');
        const useSSL = process.env.MINIO_USE_SSL === 'true';

        this.client = new Client({
            endPoint,
            port,
            useSSL,
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || '',
        });

        this.ensureBucket();

        if (this.client) {
            console.log(`[FileStorage] Initialized MinIO Client. Endpoint: ${endPoint}, Port: ${port}, SSL: ${useSSL}, Bucket: ${this.bucket}`);
        }
    }

    private ensureUploadDir() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    private async ensureBucket() {
        if (!this.client) return;
        try {
            const exists = await this.client.bucketExists(this.bucket);
            if (!exists) {
                await this.client.makeBucket(this.bucket, 'us-east-1');
                console.log(`Bucket ${this.bucket} created.`);
            }
        } catch (err) {
            console.error('Error checking/creating bucket:', err);
        }
    }

    async uploadFile(file: Express.Multer.File, filename: string): Promise<string> {
        // If MinIO is available
        if (this.client) {
            const metaData = {
                'Content-Type': file.mimetype,
                'Original-Name': file.originalname,
            };

            await this.client.putObject(this.bucket, filename, file.buffer, file.size, metaData);

            const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
            const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT || 'localhost:9000';
            return `${protocol}://${publicEndpoint}/${this.bucket}/${filename}`;
        }

        // Fallback to Local FS
        const filePath = path.join(this.uploadDir, filename);

        // Ensure parent directory exists for nested paths (e.g. properties/id/...)
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await fs.promises.writeFile(filePath, file.buffer);

        // Return relative URL that works in any environment
        // The frontend will request this from its current domain
        return `/uploads/${filename}`;
    }

    async deleteFile(filename: string): Promise<void> {
        if (this.client) {
            await this.client.removeObject(this.bucket, filename);
            return;
        }

        // Local FS
        const filePath = path.join(this.uploadDir, filename);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }
}

export const fileStorageService = new FileStorageService();
