/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  output: 'standalone',
  experimental: {
    // Disable parallel worker threads to prevent Windows FS race conditions
    workerThreads: false,
    cpus: 1,
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Suppress source map upload logs during build
  silent: !process.env.CI,

  // Use the new webpack options instead of deprecated top-level options
  webpack: {
    // Auto-instrument server components and API routes
    autoInstrumentServerFunctions: true,
    // Treeshake Sentry SDK logger to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
  },

  // Widened source map upload for better stack traces (only if SENTRY_AUTH_TOKEN is set)
  widenClientFileUpload: true,
})
