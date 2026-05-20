/** @type {import('@lhci/cli').LighthouseRcConfig} */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm start',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 30000,
      url: ['http://localhost:3000'],
      numberOfRuns: 1,
      settings: {
        // Skip PWA audits — ForgePilot is a local-first app
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
      },
    },
    assert: {
      assertions: {
        // Core Web Vitals baseline — adjust after first real run
        'categories:performance': ['warn', { minScore: 0.5 }],
        'categories:accessibility': ['warn', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        // Block on clearly broken things
        'is-on-https': 'off',     // local dev
        'uses-http2': 'off',      // local dev
        'errors-in-console': ['warn', { maxLength: 0 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
