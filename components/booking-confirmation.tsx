'use client'

import Link from 'next/link'
import { Check, ShieldCheck } from 'lucide-react'
import { tx, useLocale } from './locale'

export function BookingConfirmation({ flow }: { flow: string | null }) {
  const { locale } = useLocale()
  // Deliberately do not mount SiteShell: its live chat and account widgets can
  // display private visitor information. Reuse receipt styles without its data.
  return <main className="container cart-page has-receipt">
    <section className="checkout-receipt" aria-labelledby="booking-confirmation-title">
      <header className="checkout-receipt-header">
        {flow && <span className="checkout-receipt-check"><Check size={30} aria-hidden="true" /></span>}
        <div>
          <span className="eyebrow">STAR PYRAMIDS</span>
          <h1 id="booking-confirmation-title">{flow
            ? tx(locale, { en: 'Booking request received', es: 'Solicitud de reserva recibida', it: 'Richiesta di prenotazione ricevuta' })
            : tx(locale, { en: 'Your booking confirmation', es: 'La confirmación de tu reserva', it: 'La conferma della tua prenotazione' })}</h1>
          <p>{flow
            ? tx(locale, { en: 'Your request is saved. Our team will review it before confirming the arrangements. Open your private details below.', es: 'Tu solicitud está guardada. Nuestro equipo la revisará antes de confirmar los detalles. Abre tus datos privados a continuación.', it: 'La richiesta è salvata. Il nostro team la esaminerà prima di confermare i dettagli. Apri i tuoi dettagli privati qui sotto.' })
            : tx(locale, { en: 'This confirmation link has expired or is unavailable in this browser. Your request may already be saved. Use the email we sent or your account to check it before submitting again.', es: 'Este enlace de confirmación ha caducado o no está disponible en este navegador. Tu solicitud puede estar guardada. Comprueba el correo que te enviamos o tu cuenta antes de volver a enviarla.', it: 'Il link di conferma è scaduto o non è disponibile in questo browser. La richiesta potrebbe essere già salvata. Controlla l’email ricevuta o il tuo account prima di inviarla di nuovo.' })}</p>
        </div>
      </header>
      <p className="checkout-receipt-unpaid"><ShieldCheck size={17} aria-hidden="true" />{tx(locale, { en: 'No charge has been made online.', es: 'No se ha realizado ningún cargo en línea.', it: 'Non è stato effettuato alcun addebito online.' })}</p>
      <div className="checkout-receipt-actions">
        {flow && <form action="/checkout/receipt" method="get">
          <input type="hidden" name="flow" value={flow} />
          <button type="submit" className="primary-btn">{tx(locale, { en: 'View private booking details', es: 'Ver los detalles privados de la reserva', it: 'Visualizza i dettagli privati della prenotazione' })}</button>
        </form>}
        <Link className="outline-btn" href="/trips">{tx(locale, { en: 'Browse more trips', es: 'Explorar más viajes', it: 'Sfoglia altri viaggi' })}</Link>
        {!flow && <a className="outline-btn" href="/account/bookings">{tx(locale, { en: 'Check your account', es: 'Consultar tu cuenta', it: 'Controlla il tuo account' })}</a>}
      </div>
    </section>
  </main>
}
