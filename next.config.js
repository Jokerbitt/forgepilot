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
    org:     process.env.SENTRY_ORG     ?? 'privat-0p',
    project: process.env.SENTRY_PROJECT ?? 'javascript-nextjs',
    // authToken is read from SENTRY_AUTH_TOKEN env var automatically by the Sentry webpack plugin
    silent: !process.env.CI,
    widenClientFileUpload: true,
    // Upload source maps to Sentry on every production build
    sourcemaps: {
      disable: false,
    },
    hideSourceMaps: true,         // strip .map files from the deployed bundle
    webpack: {
      autoInstrumentServerFunctions: true,
      treeshake: {
        // tree-shake Sentry debug logging in prod (was: disableLogger)
        removeDebugLogging: true,
      },
    },
  })
}
