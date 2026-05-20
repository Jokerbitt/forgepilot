export const dynamic = 'force-dynamic'
import { exportSettingsBundle } from '@/lib/settings/settings-bundle'

export async function GET() {
  const bundle = exportSettingsBundle()
  const filename = `forgepilot-settings-${new Date().toISOString().slice(0, 10)}.json`

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
