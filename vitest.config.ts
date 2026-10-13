import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
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
    deps: {
      inline: ['server-only'],
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
