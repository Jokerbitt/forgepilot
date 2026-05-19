/**
 * Cross-Platform Path Resolution
 *
 * ForgePilot runs on any system — NAS, local SSD, external drive, CI.
 * All config/data paths go through this module.
 *
 * Environment variables (all optional, sensible defaults):
 *
 *   FORGEPILOT_DATA_DIR   — where config JSON files live
 *                           default: <cwd>/config
 *
 *   FORGEPILOT_DOCS_DIR   — where documentation/NAS files live
 *                           (used by the knowledge indexer)
 *                           default: empty string (feature disabled)
 *
 *   FORGEPILOT_LOG_DIR    — where log files are written
 *                           default: <cwd>/logs
 */

import path from 'path'

/**
 * Returns the directory where all config/state JSON files are stored.
 * Override with FORGEPILOT_DATA_DIR to point to any drive or network share.
 */
export function getDataDir(): string {
  return process.env.FORGEPILOT_DATA_DIR ?? path.join(process.cwd(), 'config')
}

/**
 * Returns the path to a specific config file.
 */
export function getConfigPath(filename: string): string {
  return path.join(getDataDir(), filename)
}

/**
 * Returns the documentation/knowledge base directory.
 * Empty string = feature disabled (NAS not mounted, running in CI, etc.)
 */
export function getDocsDir(): string {
  return process.env.FORGEPILOT_DOCS_DIR ?? ''
}

/**
 * Returns the log directory.
 */
export function getLogDir(): string {
  return process.env.FORGEPILOT_LOG_DIR ?? path.join(process.cwd(), 'logs')
}

/**
 * Returns true if the docs/knowledge directory is configured and accessible.
 */
export function isDocsDirAvailable(): boolean {
  const dir = getDocsDir()
  if (!dir) return false
  try {
    const fs = require('fs') as typeof import('fs')
    return fs.existsSync(dir)
  } catch {
    return false
  }
}
