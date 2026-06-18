# File Storage Connector

Provider-agnostic object storage for uploads and attachments. Call `storage()`;
switch backend via `STORAGE_PROVIDER`.

## Providers
| Provider | Env | Install |
|----------|-----|---------|
| `local` (default, dev) | `STORAGE_LOCAL_DIR`, `STORAGE_PUBLIC_BASE` | — |
| `s3` (S3 / R2 / MinIO) | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT?`, `S3_PUBLIC_BASE?` | `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` |

Auto-detects: S3 when `S3_BUCKET` is set, else local disk.

## Usage
```ts
import { storage, safeKey } from '@/lib/storage'

const key = safeKey(`users/${userId}`, file.name)
const obj = await storage().put(key, Buffer.from(await file.arrayBuffer()), file.type)
// obj.url → presigned (S3) or public path (local)
```

For local serving, add a route that streams `storage().get(key)`, or point a
static handler at `STORAGE_LOCAL_DIR`.
