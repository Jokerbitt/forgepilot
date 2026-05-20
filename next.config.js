/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
}

// Skip Sentry webpack plugin in dev — it spins up source-map workers that
// crash in Next.js 14 dev mode. Sentry still initialises at runtime via
// instrumentation.ts when SENTRY_DSN is set.
if (process.env.NODE_ENV === 'development') {
  module.exports = nextConfig
} else {
  module.exports = withSentryConfig(nextConfig, {
    silent: !process.env.CI,
    webpack: {
      autoInstrumentServerFunctions: true,
      treeshake: { removeDebugLogging: true },
    },
    widenClientFileUpload: true,
  })
}
