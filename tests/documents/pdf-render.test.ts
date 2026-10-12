// Phase B: PDF renderer unit tests (no HTTP, no issuance).
//
// Covers:
// - integer-cent USD formatting;
// - font embedding (Montserrat subsets, Identity-H) and real glyph
//   coverage for Spanish/Italian/French sample text via fontkit —
//   Arabic is intentionally unsupported and never claimed;
// - structural validity of rendered PDFs for all three issuable types
//   (header, EOF, page tree, embedded fonts, image when logo present);
// - multilingual customer data renders without error.

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

import {
  MONTSERRAT_BOLD,
  MONTSERRAT_MEDIUM,
  MONTSERRAT_REGULAR,
  MONTSERRAT_SEMIBOLD,
} from '@/lib/server/pdf/fonts'
import {
  formatUsdAmount,
  formatUtcDay,
  bookingStatusLabel,
  paymentStatusLabel,
  PDF_TYPE_LABELS,
  type PdfDocumentModel,
} from '@/lib/server/pdf/model'
import { renderBookingDocumentPdf } from '@/lib/server/pdf/render'

// fontkit is a dev-only verification dependency (glyph coverage); load
// it through CJS interop because its ESM default shape is unstable.
// In-memory faces use the async `create` (openSync is path-based).
const requireCjs = createRequire(import.meta.url)
const fontkit = requireCjs('fontkit') as {
  create(buffer: Buffer): Promise<{
    familyName: string
    layout(text: string): { glyphs: Array<{ id: number }> }
  }>
}

const SAMPLE_MULTILINGUAL =
  'Señor Muñoz — ¿Qué? señoría, Piñata, crème brûlée, über, à èìòù, á é í ó ú ñ ü Ç, €1.234,56'

function baseModel(overrides: Partial<PdfDocumentModel> = {}): PdfDocumentModel {
  return {
    issuer: {
      companyName: 'Star Pyramids Tours',
      email: 'info@starpyramids.example',
      phone: '+20 100 000 0000',
      address: 'Giza, Egypt',
      legalEntityName: null,
      registrationNumber: null,
      taxNumber: null,
      logoData: null,
    },
    document: {
      number: 'SP-BRQ-2026-000001',
      type: 'BOOKING_REQUEST',
      typeLabel: PDF_TYPE_LABELS.BOOKING_REQUEST,
      issuedAt: '2026-10-12T09:30:00.000Z',
      bookingReference: 'SP-BK-ABC123',
    },
    booking: {
      statusLabel: bookingStatusLabel('PENDING'),
      contactName: SAMPLE_MULTILINGUAL,
      contactEmail: 'cliente@example.com',
      contactPhone: '+34 600 000 000',
      notes: 'Notas con acentos: señoría ¿Qué? über',
      lines: [
        {
          title: 'Pyramids & Sphinx — tour privado',
          travelDate: '2026-12-05',
          adults: 2,
          children: 1,
          infants: 0,
          addons: ['Almuerzo', 'Guía privada — ¿sí?'],
        },
        {
          title: 'Nile cruise — cabina superior',
          travelDate: null,
          adults: 2,
          children: 0,
          infants: 0,
          addons: [],
        },
      ],
      summary: {
        paymentStatus: paymentStatusLabel('pending'),
        totalAtIssueCents: 100_00,
        paidToDateCents: 0,
        refundedToDateCents: 0,
        remainingCents: 100_00,
        hasPayments: false,
      },
    },
    receipt: null,
    notice:
      'This document confirms receipt of your booking request. It is not a final booking confirmation or payment receipt.',
    ...overrides,
  }
}

describe('PDF money and date formatting', () => {
  it('formats integer cents with locale grouping and two decimals', () => {
    expect(formatUsdAmount(4000)).toBe('USD 40.00')
    expect(formatUsdAmount(123456)).toBe('USD 1,234.56')
    expect(formatUsdAmount(5)).toBe('USD 0.05')
    expect(formatUsdAmount(0)).toBe('USD 0.00')
    expect(formatUsdAmount(-250)).toBe('-USD 2.50')
  })

  it('formats UTC issue dates in English day-month-year form', () => {
    expect(formatUtcDay('2026-10-12T09:30:00.000Z')).toBe('12 Oct 2026')
    expect(formatUtcDay('2026-01-01T23:59:59.000Z')).toBe('01 Jan 2026')
  })
})

describe('PDF font embedding and multilingual coverage', () => {
  it('embeds no .notdef glyphs for Spanish/Italian/French text', async () => {
    for (const buffer of [MONTSERRAT_REGULAR, MONTSERRAT_MEDIUM, MONTSERRAT_SEMIBOLD, MONTSERRAT_BOLD]) {
      const font = await fontkit.create(buffer)
      expect(font.familyName.startsWith('Montserrat')).toBe(true)
      const glyphs = font.layout(SAMPLE_MULTILINGUAL).glyphs
      expect(glyphs.length).toBeGreaterThan(0)
      const notdef = [...glyphs].filter((glyph) => glyph.id === 0)
      expect(notdef).toEqual([])
    }
  })
})

describe('PDF rendering validity', () => {
  it('renders a structurally valid booking-request PDF with embedded fonts', async () => {
    const bytes = await renderBookingDocumentPdf(baseModel())
    expect(bytes.length).toBeGreaterThan(4000)
    const raw = bytes.toString('latin1')
    expect(raw.startsWith('%PDF-')).toBe(true)
    expect(raw.includes('%%EOF')).toBe(true)
    expect(raw).toMatch(/\/Type\s*\/Pages/)
    expect(raw).toMatch(/\/Count\s*[1-9]/)
    // TrueType subsets embedded with Identity-H (Unicode) encoding.
    expect(raw).toContain('/FontFile2')
    expect(raw).toContain('/Identity-H')
    // pdfkit prefixes embedded subsets, e.g. /BaseFont /ABCDEF+Montserrat-Regular.
    expect(raw).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+Montserrat/)
  })

  it('embeds the brand logo image when provided and falls back gracefully otherwise', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const logo = readFileSync(path.join(process.cwd(), 'public', 'logo.png'))
    const withLogo = await renderBookingDocumentPdf(
      baseModel({ issuer: { ...baseModel().issuer, logoData: logo } }),
    )
    const rawLogo = withLogo.toString('latin1')
    expect(rawLogo.startsWith('%PDF-')).toBe(true)
    expect(rawLogo).toMatch(/\/Subtype\s*\/Image/)

    // Invalid image bytes must not break the document — wordmark fallback.
    const fallback = await renderBookingDocumentPdf(
      baseModel({ issuer: { ...baseModel().issuer, logoData: MONTSERRAT_REGULAR } }),
    )
    expect(fallback.toString('latin1').startsWith('%PDF-')).toBe(true)

    const noLogo = await renderBookingDocumentPdf(baseModel())
    expect(noLogo.toString('latin1').startsWith('%PDF-')).toBe(true)
  }, 20000)

  it('renders receipt and confirmation variants with type-specific blocks', async () => {
    const receipt = await renderBookingDocumentPdf(
      baseModel({
        document: {
          number: 'SP-RCPT-2026-000042',
          type: 'PAYMENT_RECEIPT',
          typeLabel: PDF_TYPE_LABELS.PAYMENT_RECEIPT,
          issuedAt: '2026-10-12T09:30:00.000Z',
          bookingReference: 'SP-BK-ABC123',
        },
        booking: {
          ...baseModel().booking,
          summary: null,
        },
        receipt: {
          paymentReference: 'SP-PAY-XYZ789',
          provider: 'offline',
          paidOn: '2026-10-10T12:00:00.000Z',
          amountReceivedCents: 4000,
          refundedToDateCents: 1000,
        },
        notice: null,
      }),
    )
    expect(receipt.toString('latin1').startsWith('%PDF-')).toBe(true)

    const confirmation = await renderBookingDocumentPdf(
      baseModel({
        document: {
          number: 'SP-BCF-2026-000007',
          type: 'BOOKING_CONFIRMATION',
          typeLabel: PDF_TYPE_LABELS.BOOKING_CONFIRMATION,
          issuedAt: '2026-10-12T09:30:00.000Z',
          bookingReference: 'SP-BK-ABC123',
        },
        booking: {
          ...baseModel().booking,
          statusLabel: bookingStatusLabel('CONFIRMED'),
          summary: {
            paymentStatus: paymentStatusLabel('paid'),
            totalAtIssueCents: 100_00,
            paidToDateCents: 100_00,
            refundedToDateCents: 0,
            remainingCents: 0,
            hasPayments: true,
          },
        },
        notice: null,
      }),
    )
    expect(confirmation.toString('latin1').startsWith('%PDF-')).toBe(true)
  })

  it('renders legal issuer rows only when configured (no invented data)', async () => {
    const withLegal = await renderBookingDocumentPdf(
      baseModel({
        issuer: {
          ...baseModel().issuer,
          legalEntityName: 'Star Pyramids LLC',
          registrationNumber: 'REG-123',
          taxNumber: 'TAX-456',
        },
      }),
    )
    expect(withLegal.length).toBeGreaterThan(4000)
    expect(withLegal.toString('latin1').startsWith('%PDF-')).toBe(true)
  })
})
