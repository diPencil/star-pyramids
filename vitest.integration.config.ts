import path from 'node:path'
import { defineConfig } from 'vitest/config'

import {
  configureIsolatedTestDatabase,
  loadApplicationDatabaseUrlForComparison,
} from './tests/helpers/database-isolation'

// Load the application's local DATABASE_URL for comparison only. The guard
// replaces it with TEST_DATABASE_URL before any integration test is imported.
loadApplicationDatabaseUrlForComparison()
configureIsolatedTestDatabase()

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/documents/commercial-access.test.ts',
      'tests/documents/commercial-issuance.test.ts',
      'tests/documents/commercial-pdf.test.ts',
      'tests/documents/document-access.test.ts',
      'tests/documents/document-issuance.test.ts',
      'tests/documents/document-lists.test.ts',
      'tests/documents/document-numbering.test.ts',
      'tests/documents/pdf-download.test.ts',
      'tests/payments/payment-proofs-concurrency.test.ts',
    ],
    globals: true,
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    setupFiles: ['./tests/setup.ts', './tests/integration/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
