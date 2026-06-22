import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // The project tsconfig sets `jsx: "preserve"` (Next.js transforms JSX itself).
  // Under Vitest 4 (Vite 6 + oxc) that setting is inherited, so imported `.tsx`
  // modules keep raw JSX and the import-analysis / define parser rejects them.
  // Tell the oxc transformer to compile JSX with the automatic runtime instead.
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
    },
  },
  test: {
    environment: 'node',
    globals: true,
    reporters: ['verbose', ['json', { outputFile: 'config/test-results.json' }]],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.claude/worktrees/**',
      '**/forgepilot-agent-worktree/**',
      'e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/lib/**', 'src/app/api/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/__tests__/**',
        'src/lib/models/**',   // type definitions only
      ],
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 15,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
