export const dynamic = 'force-dynamic'

const startedAt = Date.now()

export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  })
}
