import * as Minio from 'minio';

// MinIO client configuration - only create if endpoint is provided
const minioEndpoint = process.env.MINIO_ENDPOINT;
const minioPort = parseInt(process.env.MINIO_PORT || '9000');
const minioAccessKey = process.env.MINIO_ACCESS_KEY || '';
const minioSecretKey = process.env.MINIO_SECRET_KEY || '';
const minioUseSSL = process.env.MINIO_USE_SSL === 'true';

// Only create client if MinIO is configured
export const minioClient = minioEndpoint ? new Minio.Client({
  endPoint: minioEndpoint,
  port: minioPort,
  useSSL: minioUseSSL,
  accessKey: minioAccessKey,
  secretKey: minioSecretKey,
}) : null;

export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'pro-casa-files';

// Get public URL for a file
export const getPublicUrl = (fileName: string): string => {
  // Check if using local storage (MinIO disabled)
  if (!minioClient || !minioEndpoint) {
    // In production, files are served via Nginx at /uploads/
    // In development (local), served via backend express static /uploads/

    // Check if we are in browser or server
    // If backend generating URL:
    if (process.env.NODE_ENV === 'production') {
      const apiUrl = process.env.API_URL || 'https://pro.casa.kz';
      // Note: Nginx typically serves uploads from root domain or API domain
      // If we configure Nginx to serve /uploads, then:
      return `${apiUrl}/uploads/${fileName}`;
    }

    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    return `${apiUrl}/uploads/${fileName}`;
  }

  const baseUrl = process.env.NODE_ENV === 'production'
    ? `https://${minioEndpoint}:${minioPort}`
    : `http://localhost:9000`;

  return `${baseUrl}/${MINIO_BUCKET}/${fileName}`;
};

// Initialize bucket (ensure it exists)
export const initializeBucket = async (): Promise<void> => {
  if (!minioClient) {
    console.log('[MinIO] Disabled - using local file storage');
    return;
  }

  try {
    const exists = await minioClient.bucketExists(MINIO_BUCKET);
    if (!exists) {
      await minioClient.makeBucket(MINIO_BUCKET);
      console.log(`Bucket '${MINIO_BUCKET}' created successfully`);

      // Set bucket policy to public read
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(MINIO_BUCKET, JSON.stringify(policy));
    }
    console.log(`MinIO bucket '${MINIO_BUCKET}' is ready`);
  } catch (error) {
    console.error('Failed to initialize MinIO bucket:', error);
    // Don't throw - allow app to start even if MinIO is not available
  }
};
