/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig['headers']} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval required for Next.js dev HMR
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.anthropic.com https://api.openai.com https://api.groq.com https://generativelanguage.googleapis.com https://api.mistral.ai https://api.together.xyz https://openrouter.ai https://api.x.ai https://*.sentry.io",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  output: 'standalone',
  webpack(config) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /@opentelemetry\/instrumentation/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ]
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
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
