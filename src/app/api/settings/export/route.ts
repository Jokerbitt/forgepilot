export const dynamic = 'force-dynamic'
import { exportSettingsBundle } from '@/lib/settings/settings-bundle'

function berlinDateOnly(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function GET() {
  const bundle = exportSettingsBundle()
  const filename = `forgepilot-settings-${berlinDateOnly()}.json`

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
