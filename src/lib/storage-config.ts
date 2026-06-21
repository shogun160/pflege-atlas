/**
 * Builds an R2/S3-Storage-Config-Object for the @payloadcms/storage-s3 plugin.
 *
 * Returns null in dev when no R2_* envs are set, letting Payload fall back to
 * its default local-filesystem storage. Production must set all four envs.
 *
 * Cloudflare R2 is S3-compatible; we use region 'auto' as recommended by
 * Cloudflare R2 docs (https://developers.cloudflare.com/r2/api/s3/api/).
 */
export interface StorageConfig {
  bucket: string;
  config: {
    endpoint: string;
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
}

export function buildStorageConfig(): StorageConfig | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    return null;
  }

  return {
    bucket,
    config: {
      endpoint,
      region: 'auto',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    },
  };
}
