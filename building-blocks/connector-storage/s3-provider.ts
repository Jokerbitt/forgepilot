/**
 * S3 / Cloudflare-R2 / any S3-compatible storage provider.
 * Requires: npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 *
 * Env: S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *      S3_ENDPOINT (optional, for R2/MinIO), S3_PUBLIC_BASE (optional CDN base)
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageProvider, StoredObject } from './provider'

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3'
  private client: S3Client
  private bucket: string
  private publicBase?: string

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const bucket = env.S3_BUCKET
    if (!bucket) throw new Error('S3_BUCKET is not set')
    this.bucket = bucket
    this.publicBase = env.S3_PUBLIC_BASE?.replace(/\/$/, '')
    this.client = new S3Client({
      region: env.S3_REGION ?? 'auto',
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: env.S3_ACCESS_KEY_ID
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '' }
        : undefined,
    })
  }

  async put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<StoredObject> {
    const buf = Buffer.from(body)
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buf, ContentType: contentType }))
    return { key, url: await this.url(key), size: buf.byteLength, contentType }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      const bytes = await res.Body?.transformToByteArray()
      return bytes ? Buffer.from(bytes) : null
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async url(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.publicBase) return `${this.publicBase}/${key}`
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds })
  }
}
