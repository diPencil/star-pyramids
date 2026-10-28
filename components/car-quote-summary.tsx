import type { CarRequest, CarTripType } from '@/lib/car-request'
import { formatQuoteAmount } from '@/lib/car-request'
import { pickLocaleText, sanitizeLocale, type Locale } from '@/lib/locale-config'
import './car-quote-summary.css'

export function CarQuoteSummary({ quote, locale: requestedLocale, tripType, saved = false }: { quote: CarRequest['quote']; locale: Locale; tripType?: CarTripType | ''; saved?: boolean }) {
  const locale = sanitizeLocale(requestedLocale)
  const t = (en: string, es: string, it: string) => pickLocaleText(locale, { en, es, it })
  if (!quote) return <div className="car-quote-summary"><strong>{t('Price on request', 'Precio a consultar', 'Prezzo su richiesta')}</strong><span>{t('Our team will confirm your transfer price.', 'Nuestro equipo confirmará el precio del traslado.', 'Il nostro team confermerà il prezzo del trasferimento.')}</span></div>
  const meta = quote.pricingMetadata
  const amount = (cents: number) => formatQuoteAmount(cents, quote.currency, locale)
  const manual = tripType === 'Round Trip' && meta?.returnPricing?.basis === 'manual'
  const unit = manual ? meta.returnPricing?.unitCents : meta?.outbound.unitCents
  return <div className="car-quote-summary">
    {meta && <>
      <span>{meta.outbound.pricingMode === 'PER_PERSON' ? t('Per-passenger pricing', 'Precio por pasajero', 'Prezzo per passeggero') : t('Vehicle transfer total', 'Total del traslado en vehículo', 'Totale trasferimento veicolo')}</span>
      <span>{t('Passenger range', 'Tramo de pasajeros', 'Fascia passeggeri')}: {meta.outbound.minPassengers}–{meta.outbound.maxPassengers}</span>
      <span>{t('Passengers', 'Pasajeros', 'Passeggeri')}: {meta.passengers}</span>
      {unit !== undefined && <span>{manual ? t('Round-trip rate', 'Tarifa de ida y vuelta', 'Tariffa andata e ritorno') : t('Outbound rate', 'Tarifa de ida', 'Tariffa andata')}: {amount(unit)}{meta.outbound.pricingMode === 'PER_PERSON' ? ` × ${meta.passengers}` : ''}</span>}
      {tripType === 'Round Trip' && meta.returnPricing?.basis === 'legs' && meta.returnPricing.unitCents !== undefined && <span>{t('Return rate', 'Tarifa de regreso', 'Tariffa ritorno')} ({meta.returnPricing.pricingMode === 'PER_PERSON' ? t('per passenger', 'por pasajero', 'per passeggero') : t('vehicle total', 'total del vehículo', 'totale veicolo')}): {amount(meta.returnPricing.unitCents)}{meta.returnPricing.pricingMode === 'PER_PERSON' ? ` × ${meta.passengers}` : ''}</span>}
      {tripType === 'Round Trip' && meta.returnPricing?.basis === 'multiplier' && <span>{t('Round-trip multiplier', 'Multiplicador de ida y vuelta', 'Moltiplicatore andata e ritorno')}: ×{((meta.returnPricing.multiplierBp ?? 200) / 100).toFixed(2)}</span>}
    </>}
    <strong>{saved ? t('Saved quoted total', 'Total del presupuesto guardado', 'Totale preventivo salvato') : t('Total transfer price', 'Precio total del traslado', 'Prezzo totale del trasferimento')}: <span dir="ltr">{amount(quote.cents)}</span></strong>
    <small>{t('This is a transfer request, not an online payment. Our team will confirm the arrangements.', 'Es una solicitud de traslado, no un pago en línea. Nuestro equipo confirmará los detalles.', 'È una richiesta di trasferimento, non un pagamento online. Il nostro team confermerà i dettagli.')}</small>
  </div>
}
