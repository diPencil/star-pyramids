'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Check, CircleAlert, Clock3, Compass, LockKeyhole, Mail, ShieldCheck, Trash2, Users } from 'lucide-react'
import { Breadcrumb, SiteShell } from '@/components/site'
import { formatPrice, tx, useLocale } from './locale'
import { clearCart, removeFromCart, removeCartItems, useCart } from '@/lib/cart'
import {
  hasContactErrors, validateBookingContact, OFFICIAL_BOOKING_REF_PATTERN,
  type Booking, type BookingContact, type ContactErrors,type BookingCheckoutDraft,
} from '@/lib/booking'
import { InternationalPhoneInput } from './international-phone-input'
import { PaymentInstructions } from './booking-payment'
import { customerErrorText } from '@/lib/customer-error-copy'
import { useCartCatalogue } from '@/lib/cart-catalogue'
import { checkoutAttemptKey, finishCheckoutAttempt } from '@/lib/checkout-attempt'
import { bookingRequestNotes, MAX_BOOKING_NOTE_LENGTH } from '@/lib/booking-selection'
import { CartLineIssues } from './cart-line-issues'
import { CartCatalogueStatus } from './cart-catalogue-status'
import { useCurrentUser } from '@/lib/use-current-user'
import {bookingPriceSnapshot,parseAcceptedPrice,type BookingPriceSnapshot} from '@/lib/booking-price'
import {CustomerConfirmDialog} from './customer-confirm-dialog'

type CheckoutReply=Booking&{code?:string;slug?:string;price?:unknown;quote?:string;existing?:boolean;success?:boolean;error?:string;guestAccessUrl?:string|null;guest?:boolean}

/**
 * Checkout (Phase 2E: real backend).
 * Sends SELECTIONS ONLY to `POST /api/bookings`  -  the server resolves
 * canonical tours/prices, computes totals in integer cents, links
 * ownership from the session, and returns the official `SP-BK-…`
 * reference. A per-attempt idempotency key makes double clicks, slow
 * networks, and re-renders create exactly ONE booking.
 */
export function CheckoutPage() {
  const { currency, locale } = useLocale()
  const { items } = useCart()
  const catalogue = useCartCatalogue(items)
  const { estimate } = catalogue
  const { user } = useCurrentUser()
  // null means untouched: late account data may fill it. An explicit edit,
  // including clearing a field, belongs to the customer and is never replaced.
  const [nameInput, setName] = useState<string | null>(null)
  const [emailInput, setEmail] = useState<string | null>(null)
  const [phoneInput, setPhone] = useState<string | null>(null)
  const name = nameInput ?? [user?.firstName, user?.lastName].filter((part): part is string => typeof part === 'string' && !!part.trim()).map(part => part.trim()).join(' ')
  const email = emailInput ?? (typeof user?.email === 'string' ? user.email.trim() : '')
  const phone = phoneInput ?? (typeof user?.phone === 'string' ? user.phone.trim() : '')
  const [notes, setNotes] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const requiresAccountConsent = !user?.roles.includes('CUSTOMER')
  const [errors, setErrors] = useState<ContactErrors>({})
  const [attempted, setAttempted] = useState(false)
  const [sending, setSending] = useState(false)
  const pending = useRef(false)
  const [recovery, setRecovery] = useState<'idle' | 'sending' | 'accepted' | 'error'>('idle')
  const [submitError, setSubmitError] = useState('')
  const [placed, setPlaced] = useState<{ reference: string; total: number|null; existing:boolean;linked: boolean; guest: boolean; email: string; guestAccessUrl: string | null } | null>(null)
  const [priceChange,setPriceChange]=useState<{previous:BookingPriceSnapshot;price:BookingPriceSnapshot;quote:string}|null>(null)
  const [unavailable,setUnavailable]=useState<string[]>([])
  const lastRequest=useRef<{body:BookingCheckoutDraft&{acceptedPrice:BookingPriceSnapshot;priceQuote?:string};keys:string[]}|null>(null)
  const sendFailed = tx(locale, { en: 'Could not send the request. Please try again.', es: 'No se pudo enviar la solicitud. Inténtalo de nuevo.', it: 'Impossibile inviare la richiesta. Riprova.', ar: 'تعذر إرسال الطلب. حاول مجددًا.' })

  const copy = {
    nameRequired: tx(locale, { en: 'Enter your full name.', es: 'Escribe tu nombre completo.', it: 'Inserisci il tuo nome completo.', ar: 'اكتب الاسم الكامل.' }),
    emailRequired: tx(locale, { en: 'Enter your email address.', es: 'Escribe tu correo electrónico.', it: 'Inserisci il tuo indirizzo email.', ar: 'اكتب البريد الإلكتروني.' }),
    emailInvalid: tx(locale, { en: 'Enter a valid email address.', es: 'Escribe un correo electrónico válido.', it: 'Inserisci un indirizzo email valido.', ar: 'اكتب بريدًا إلكترونيًا صحيحًا.' }),
    phoneRequired: tx(locale, { en: 'Enter your phone number.', es: 'Escribe tu número de teléfono.', it: 'Inserisci il tuo numero di telefono.', ar: 'اكتب رقم الهاتف.' }),
    phoneInvalid: tx(locale, { en: 'Enter a valid phone number (at least 7 digits).', es: 'Escribe un teléfono válido (al menos 7 dígitos).', it: 'Inserisci un numero di telefono valido (almeno 7 cifre).', ar: 'اكتب رقم هاتف صحيحًا (7 أرقام على الأقل).' }),
    staleBlocked: tx(locale, { en: 'Review traveler counts, prices and unavailable extras in your cart before sending the request.', es: 'Revisa viajeros, precios y extras no disponibles antes de enviar la solicitud.', it: 'Controlla viaggiatori, prezzi ed extra non disponibili prima di inviare la richiesta.', ar: 'أزل الرحلات غير المتاحة من السلة قبل إرسال الطلب.' }),
    fixErrors: tx(locale, { en: 'Review the required fields before sending the request.', es: 'Revisa los campos obligatorios antes de enviar la solicitud.', it: 'Controlla i campi obbligatori prima di inviare la richiesta.', ar: 'راجع الحقول المطلوبة قبل إرسال الطلب.' }),
  }

  const errorText = (field: keyof ContactErrors): string | null => {
    const code = errors[field]
    if (!code) return null
    if (field === 'name') return copy.nameRequired
    if (field === 'email') return code === 'required' ? copy.emailRequired : copy.emailInvalid
    return code === 'required' ? copy.phoneRequired : copy.phoneInvalid
  }

  const staleBlocked = estimate.blocked||items.some(item=>unavailable.includes(item.key))
  const showSummary = attempted && (hasContactErrors(errors) || staleBlocked)

  async function acceptBookingResult(data:CheckoutReply,draftEmail:string,submittedKeys:string[],idempotencyKey:string) {
        // Guest checkouts get a private link from the server: the booking is
        // not linked to an account, so the reference alone opens nothing.
        const safeReplay=data.success===true&&data.existing===true&&data.guest===true
        if (!OFFICIAL_BOOKING_REF_PATTERN.test(data.reference) || !safeReplay&&(!Number.isFinite(data.total) || data.total < 0)) throw Error(sendFailed)
        const guestAccessUrl = data.guest !== false && typeof data.guestAccessUrl === 'string' && /^\/booking\/[A-Za-z0-9_-]{43}$/.test(data.guestAccessUrl) ? data.guestAccessUrl : null
        let linked = data.guest === false
        if (!guestAccessUrl && data.guest === undefined) {
          try {
            const detail = await fetch(`/api/account/bookings/${encodeURIComponent(data.reference)}`, { credentials: 'same-origin' })
            linked = detail.ok
          } catch { linked = false }
        }
        setPlaced({ reference: data.reference, total: safeReplay?null:data.total,existing:data.existing===true, linked, guest: data.guest === true || !!guestAccessUrl, email: draftEmail, guestAccessUrl })
        removeCartItems(submittedKeys)
        finishCheckoutAttempt(idempotencyKey)
  }

  const placeOrder = async (e: Pick<FormEvent,'preventDefault'>, confirmation?: {price:BookingPriceSnapshot;quote:string}) => {
    e.preventDefault()
    if (pending.current || sending || placed || !catalogue.ready) return
    const contact: BookingContact = { name: name.trim(), email: email.trim(), phone: phone.trim() }
    const fieldErrors = validateBookingContact(contact)
    setErrors(fieldErrors)
    setAttempted(true)
    setSubmitError('')
    if (!estimate.validLines.length || staleBlocked || hasContactErrors(fieldErrors) || requiresAccountConsent && !acceptedTerms) return
    if (bookingRequestNotes(notes.trim(), estimate.validLines.map(line => ({title: line.tour!.title, slug: line.item.tourSlug, requested: line.onRequestAddons}))).length > MAX_BOOKING_NOTE_LENGTH) {
      setSubmitError(tx(locale, { en: 'Shorten your notes or reduce requested extras before submitting.', es: 'Acorta tus notas o reduce los extras solicitados antes de enviar.', it: 'Abbrevia le note o riduci gli extra richiesti prima di inviare.' }))
      return
    }
    pending.current = true
    setSending(true)
    const submittedKeys = items.map(item => item.key)
    const draft = {
      lines: estimate.validLines.map((line) => ({
        tourSlug: line.item.tourSlug,
        date: line.item.date,
        adults: line.item.adults,
        children: line.item.children,
        infants: line.item.infants,
        addons: [...line.item.addons],
      })),
      contact,
      notes: notes.trim(),
      currency: 'USD' as const,
      acceptedTerms,
    }
    try {
      const idempotencyKey = await checkoutAttemptKey(draft)
      const confirmed=confirmation
      const acceptedPrice=confirmed?.price??bookingPriceSnapshot(estimate.validLines.map(line=>line.price!))
      const body={...draft,idempotencyKey,acceptedPrice,...(confirmed?{priceQuote:confirmed.quote}:{})}
      lastRequest.current={body,keys:submittedKeys}
      const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
      })
        const data = (await res.json()) as CheckoutReply
        if(data.code==='TOUR_UNAVAILABLE'&&typeof data.slug==='string')setUnavailable(previous=>[...new Set([...previous,...estimate.lines.filter(line=>line.item.tourSlug===data.slug).map(line=>line.item.key)])])
        if(res.status===409&&data.code==='PRICE_CHANGED'&&typeof data.quote==='string'&&data.quote.length<=1024){
          const price=parseAcceptedPrice(data.price)
          // Retain server display titles without trusting them for pricing.
          const server=data.price as BookingPriceSnapshot
          price.lines=price.lines.map(line=>({...line,title:server.lines.find(x=>x.selection===line.selection)?.title??''}))
          setPriceChange({previous:acceptedPrice,price,quote:data.quote});return
        }
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : sendFailed)
        await acceptBookingResult(data,contact.email,submittedKeys,idempotencyKey)
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? customerErrorText(locale, error.message, sendFailed) : sendFailed)
    } finally { pending.current = false; setSending(false) }
  }

  const recoverAttempt=async()=>{
    if(pending.current||placed)return
    pending.current=true;setSending(true);setSubmitError('')
    try{
      let previous=lastRequest.current
      if(!previous){
        if(requiresAccountConsent&&!acceptedTerms){setSubmitError(customerErrorText(locale,'You must accept the Terms and Privacy Policy.',sendFailed));return}
        const contact={name:name.trim(),email:email.trim(),phone:phone.trim()}
        const invalid=validateBookingContact(contact);setErrors(invalid);setAttempted(true)
        if(hasContactErrors(invalid))return
        const draft={lines:estimate.lines.map(line=>({tourSlug:line.item.tourSlug,date:line.item.date,adults:line.item.adults,children:line.item.children,infants:line.item.infants,addons:[...line.item.addons]})),contact,notes:notes.trim(),currency:'USD' as const,acceptedTerms}
        const idempotencyKey=await checkoutAttemptKey(draft)
        const res=await fetch('/api/bookings',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({...draft,idempotencyKey,recoverOnly:true})})
        const data=await res.json() as CheckoutReply
        if(!res.ok)throw Error(data.error??sendFailed)
        await acceptBookingResult(data,contact.email,items.map(item=>item.key),idempotencyKey)
        return
      }
      const res=await fetch('/api/bookings',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({...previous.body,recoverOnly:true})})
      const data=await res.json() as CheckoutReply
      if(!res.ok)throw Error(data.error??sendFailed)
      await acceptBookingResult(data,previous.body.contact.email,previous.keys,previous.body.idempotencyKey)
    }catch(error){setSubmitError(error instanceof Error?customerErrorText(locale,error.message,sendFailed):sendFailed)}
    finally{pending.current=false;setSending(false)}
  }

  const requestAccess = async () => {
    if (!placed || recovery === 'sending' || pending.current) return
    pending.current = true
    setRecovery('sending')
    try {
      const res = await fetch('/api/bookings/request-access', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reference: placed.reference, email: placed.email }) })
      setRecovery(res.ok ? 'accepted' : 'error')
    } catch { setRecovery('error') } finally { pending.current = false }
  }

  return <SiteShell>
    <CustomerConfirmDialog open={!!priceChange} primary busy={sending}
      title={tx(locale,{en:'Review updated prices',es:'Revisa los precios actualizados',it:'Controlla i prezzi aggiornati'})}
      copy={tx(locale,{en:'Prices were refreshed before booking. Review the changes in USD. Nothing has been booked yet; accepting rechecks these prices.',es:'Los precios se actualizaron antes de reservar. Revisa los cambios en USD. Aún no se ha creado ninguna reserva; al aceptar se vuelven a comprobar.',it:'I prezzi sono stati aggiornati prima della prenotazione. Controlla le variazioni in USD. Nessuna prenotazione è stata creata; accettando, i prezzi saranno ricontrollati.'})}
      confirmLabel={tx(locale,{en:'Accept Updated Price',es:'Aceptar el precio actualizado',it:'Accetta il prezzo aggiornato'})}
      cancelLabel={tx(locale,{en:'Review Cart',es:'Revisar carrito',it:'Controlla il carrello'})}
      onClose={()=>{setPriceChange(null);document.getElementById('checkout-summary')?.focus()}}
      onConfirm={()=>{if(priceChange){const accepted=priceChange;setPriceChange(null);void placeOrder({preventDefault:()=>undefined},accepted)}}}>
      {priceChange&&<div className="checkout-price-changes">
        <p><strong>{tx(locale,{en:'Previously shown',es:'Precio anterior',it:'Prezzo precedente'})}: {formatPrice(priceChange.previous.total/100,'USD',locale)}</strong><br/>
        <strong>{tx(locale,{en:'Updated total',es:'Total actualizado',it:'Totale aggiornato'})}: {formatPrice(priceChange.price.total/100,'USD',locale)}</strong></p>
        {priceChange.price.lines.map(line=>{const old=priceChange.previous.lines.find(x=>x.selection===line.selection);return <div key={line.selection}>
          <strong>{line.title}</strong><p>{formatPrice((old?.total??0)/100,'USD',locale)} → {formatPrice(line.total/100,'USD',locale)}</p>
          {old&&(old.base!==line.base||JSON.stringify(old.units)!==JSON.stringify(line.units)||JSON.stringify(old.originalUnits)!==JSON.stringify(line.originalUnits))&&<p>{tx(locale,{en:'Tour or traveler rates changed.',es:'Han cambiado las tarifas del tour o de los viajeros.',it:'Le tariffe del tour o dei viaggiatori sono cambiate.'})}</p>}
          {old&&old.base!==line.base&&<p>{tx(locale,{en:'Base price',es:'Precio base',it:'Prezzo base'})}: {formatPrice(old.base/100,'USD',locale)} → {formatPrice(line.base/100,'USD',locale)}</p>}
          {old&&line.units.map((unit,index)=>unit!==old.units[index]&&<p key={index}>{tx(locale,[{en:'Adult rate',es:'Tarifa de adulto',it:'Tariffa adulto'},{en:'Child rate',es:'Tarifa infantil',it:'Tariffa bambino'},{en:'Infant rate',es:'Tarifa de bebé',it:'Tariffa neonato'}][index])}: {formatPrice(old.units[index]/100,'USD',locale)} → {formatPrice(unit/100,'USD',locale)}</p>)}
          {old&&(old.discount!==line.discount||JSON.stringify(old.deal)!==JSON.stringify(line.deal))&&<p>{tx(locale,{en:'Discount updated',es:'Descuento actualizado',it:'Sconto aggiornato'})}: {formatPrice(old.discount/100,'USD',locale)} → {formatPrice(line.discount/100,'USD',locale)}</p>}
          {line.extras.filter(extra=>old?.extras.find(x=>x.title===extra.title)?.cents!==extra.cents).map(extra=><p key={extra.title}>{extra.title}: {old?.extras.find(x=>x.title===extra.title)?.cents==null?'—':formatPrice(old.extras.find(x=>x.title===extra.title)!.cents!/100,'USD',locale)} → {extra.cents===null?tx(locale,{en:'On request',es:'A petición',it:'Su richiesta'}):formatPrice(extra.cents/100,'USD',locale)}</p>)}
        </div>})}
      </div>}
    </CustomerConfirmDialog>
    <Breadcrumb items={[tx(locale, { en: 'Checkout', es: 'Compra', it: 'Checkout', ar: 'إتمام الحجز' })]} />
    <main className={`container cart-page${placed?' has-receipt':''}`}>
      {!placed&&<header className="car-request-head">
        <span className="eyebrow">{tx(locale, { en: 'Almost done', es: 'Ya casi terminas', it: 'Quasi fatto', ar: 'لم يتبق إلا خطوة واحدة' })}</span>
        <h1>{tx(locale, { en: 'Checkout', es: 'Finalizar compra', it: 'Checkout', ar: 'إتمام الحجز' })}</h1>
      </header>}
      {placed ? <section className="checkout-receipt" aria-labelledby="checkout-receipt-title">
        <header className="checkout-receipt-header">
          <span className="checkout-receipt-check"><Check size={30} aria-hidden="true"/></span>
          <div>
            <span className="eyebrow">STAR PYRAMIDS · {tx(locale,{en:'Your journey',es:'Tu viaje',it:'Il tuo viaggio'})}</span>
            <h1 id="checkout-receipt-title">{placed.existing?tx(locale,{en:'Your request is already saved',es:'Tu solicitud ya está guardada',it:'La tua richiesta è già salvata'}):tx(locale,{en:'Booking request received',es:'Solicitud de reserva recibida',it:'Richiesta di prenotazione ricevuta'})}</h1>
            <p>{placed.existing?tx(locale,{en:'Your earlier request is on file. Open the booking or use your reference when contacting our team.',es:'Tu solicitud anterior está guardada. Abre la reserva o indica la referencia al contactar con nuestro equipo.',it:'La richiesta precedente è salvata. Apri la prenotazione o indica il riferimento quando contatti il nostro team.'}):tx(locale,{en:'Keep your reference handy. Our team will review your request before confirming the arrangements.',es:'Guarda tu referencia. Nuestro equipo revisará la solicitud antes de confirmar los detalles.',it:'Conserva il riferimento. Il nostro team esaminerà la richiesta prima di confermare i dettagli.'})}</p>
          </div>
        </header>
        <div className="checkout-receipt-grid">
          <aside className="checkout-receipt-summary" aria-labelledby="checkout-summary-title">
            <Compass className="checkout-receipt-compass" size={130} aria-hidden="true"/>
            <span className="checkout-receipt-status" role="status"><Clock3 size={15} aria-hidden="true"/>{tx(locale,{en:'Request saved',es:'Solicitud guardada',it:'Richiesta salvata'})}</span>
            <h2 id="checkout-summary-title">{tx(locale,{en:'Your booking details',es:'Los detalles de tu reserva',it:'I dettagli della prenotazione'})}</h2>
            <dl>
              <div><dt>{tx(locale,{en:'Official reference',es:'Referencia oficial',it:'Riferimento ufficiale'})}</dt><dd className="checkout-receipt-reference" dir="ltr">{placed.reference}</dd></div>
              {placed.total!==null&&<div className="checkout-receipt-total"><dt>{tx(locale,{en:'Booking total',es:'Total de la reserva',it:'Totale prenotazione'})}</dt><dd>{formatPrice(placed.total,currency,locale)}</dd></div>}
            </dl>
            {placed.total===null&&<p>{tx(locale,{en:'Open your saved booking to review its original total.',es:'Abre tu reserva guardada para consultar el importe original.',it:'Apri la prenotazione salvata per consultare il totale originale.'})}</p>}
            <p className="checkout-receipt-unpaid"><ShieldCheck size={17} aria-hidden="true"/>{tx(locale,{en:'No charge has been made online.',es:'No se ha realizado ningún cargo en línea.',it:'Non è stato effettuato alcun addebito online.'})}</p>
        <div className="checkout-receipt-actions">{placed.guestAccessUrl
          ? <Link className="primary-btn" href={placed.guestAccessUrl}>{tx(locale, { en: 'View your booking', es: 'Ver tu reserva', it: 'Visualizza la prenotazione', ar: 'عرض حجزك' })}</Link>
          : placed.linked && <Link className="primary-btn" href={`/account/bookings/detail?ref=${encodeURIComponent(placed.reference)}`}>{tx(locale, { en: 'View booking', es: 'Ver reserva', it: 'Visualizza prenotazione', ar: 'عرض الحجز' })}</Link>}<Link className="outline-btn" href="/trips">{tx(locale, { en: 'Browse more trips', es: 'Explorar más viajes', it: 'Sfoglia altri viaggi', ar: 'تصفح المزيد من الرحلات' })}</Link></div>
          </aside>
          <div className="checkout-receipt-content">
            <section className="checkout-receipt-next" aria-labelledby="checkout-next-title">
              <div className="checkout-receipt-section-title"><Mail size={22} aria-hidden="true"/><h2 id="checkout-next-title">{tx(locale,{en:'What happens next?',es:'¿Qué ocurre ahora?',it:'Cosa succede adesso?'})}</h2></div>
              <ol className="checkout-receipt-steps" role="list">
                <li><span className="checkout-receipt-step-number" aria-hidden="true">01</span><div>
                  <h3>{placed.existing?tx(locale,{en:'Access your saved request',es:'Accede a tu solicitud guardada',it:'Accedi alla richiesta salvata'}):placed.guest?tx(locale,{en:'Check your email',es:'Revisa tu correo',it:'Controlla la tua email'}):tx(locale,{en:'Follow your request',es:'Sigue tu solicitud',it:'Segui la tua richiesta'})}</h3>
                  <p>{placed.existing?tx(locale,{en:'Use your account, or request a private link by email. Your earlier request is already saved.',es:'Accede desde tu cuenta o solicita un enlace privado por correo. Tu solicitud anterior ya está guardada.',it:'Accedi dal tuo account o richiedi un link privato via email. La richiesta precedente è già salvata.'}):placed.guest?tx(locale,{en:'Verify your email to link this booking to your account. New customers can set a password; existing customers keep theirs. Your request is already saved.',es:'Verifica tu correo para vincular esta reserva a tu cuenta. Los nuevos clientes pueden crear una contraseña; los existentes conservan la suya. Tu solicitud ya está guardada.',it:'Verifica l’email per collegare la prenotazione al tuo account. I nuovi clienti possono impostare una password; gli altri mantengono la propria. La richiesta è già salvata.'}):placed.linked?tx(locale,{en:'Track this request from your account using the booking reference.',es:'Sigue esta solicitud desde tu cuenta con la referencia de reserva.',it:'Segui la richiesta dal tuo account con il riferimento della prenotazione.'}):tx(locale,{en:'Use your reference when you contact our team about this request.',es:'Indica tu referencia al contactar con nuestro equipo sobre esta solicitud.',it:'Indica il riferimento quando contatti il nostro team per questa richiesta.'})}</p>
                </div></li>
                <li><span className="checkout-receipt-step-number" aria-hidden="true">02</span><div>
                  <h3>{placed.existing?tx(locale,{en:'Review the latest details',es:'Consulta los detalles actuales',it:'Consulta i dettagli aggiornati'}):tx(locale,{en:'Our team reviews the details',es:'Nuestro equipo revisa los detalles',it:'Il nostro team verifica i dettagli'})}</h3>
                  <p>{placed.existing?tx(locale,{en:'Open your saved booking for its latest status and payment details.',es:'Abre tu reserva guardada para consultar el estado y los datos de pago actuales.',it:'Apri la prenotazione salvata per consultarne lo stato e i dettagli di pagamento aggiornati.'}):tx(locale,{en:'Your request still needs confirmation. Payment arrangements are handled with our team.',es:'Tu solicitud aún necesita confirmación. El pago se acuerda con nuestro equipo.',it:'La richiesta deve ancora essere confermata. Il pagamento viene concordato con il nostro team.'})}</p>
                </div></li>
              </ol>
        {placed.guest && <div className="checkout-receipt-recovery">
          <button type="button" className="outline-btn" disabled={recovery === 'sending'} onClick={requestAccess}>{tx(locale, { en: 'Request a private link by email', es: 'Solicitar un enlace privado por email', it: 'Richiedi un link privato via email' })}</button>
          {recovery === 'accepted' && <p role="status">{tx(locale, { en: 'If the details match a guest booking, check its saved email address for a private link. Check spam too. Wait at least one minute before retrying, and contact our team if no email arrives.', es: 'Si los datos coinciden con una reserva de invitado, revisa el correo guardado para buscar el enlace privado, incluida la carpeta de spam. Espera al menos un minuto antes de repetir la solicitud y contacta con el equipo si no llega el correo.', it: 'Se i dati corrispondono a una prenotazione ospite, controlla l’indirizzo email salvato per il link privato, inclusa la cartella spam. Attendi almeno un minuto prima di riprovare e contatta il team se non ricevi l’email.' })}</p>}
          {recovery === 'error' && <p role="alert">{tx(locale, { en: 'The link could not be requested. Try later or contact our team with your reference.', es: 'No se pudo solicitar el enlace. Inténtalo más tarde o contacta con el equipo indicando tu referencia.', it: 'Impossibile richiedere il link. Riprova più tardi o contatta il team indicando il riferimento.' })}</p>}
        </div>}

              {placed.existing&&<p className="checkout-receipt-notice">{tx(locale,{en:'Your earlier request was already saved. Its original pricing has not been changed.',es:'Tu solicitud anterior ya estaba guardada. Su precio original no ha cambiado.',it:'La richiesta precedente era già salvata. Il prezzo originale non è stato modificato.'})}</p>}
              {placed.guestAccessUrl&&<p className="checkout-receipt-privacy"><LockKeyhole size={16} aria-hidden="true"/>{tx(locale,{en:'Keep your private booking link confidential. Request a new email link if you need to recover access.',es:'Mantén confidencial el enlace privado de tu reserva. Solicita un nuevo enlace por correo si necesitas recuperar el acceso.',it:'Mantieni riservato il link privato della prenotazione. Richiedi un nuovo link via email per recuperare l’accesso.'})}</p>}
            </section>
            <section className="checkout-receipt-payment" aria-labelledby="checkout-payment-title">
              <div className="checkout-receipt-section-title"><ShieldCheck size={22} aria-hidden="true"/><h2 id="checkout-payment-title">{tx(locale,{en:'Payment arrangements',es:'Acuerdos de pago',it:'Modalità di pagamento'})}</h2></div>
              <PaymentInstructions layout="note"/>
            </section>
          </div>
        </div>
      </section> : !items.length ? <div className="cart-empty">
        <h2>{tx(locale, { en: 'Nothing to check out', es: 'Nada que comprar', it: 'Niente da acquistare', ar: 'لا توجد عناصر لإتمامها' })}</h2>
        <p>{tx(locale, { en: 'Add a trip to the cart first.', es: 'Añade primero un viaje al carrito.', it: 'Aggiungi prima un viaggio al carrello.', ar: 'أضف رحلة إلى السلة أولًا.' })}</p>
        <Link href="/trips" className="primary-btn">{tx(locale, { en: 'Browse trips', es: 'Explorar viajes', it: 'Sfoglia i viaggi', ar: 'تصفح الرحلات' })} <ArrowRight size={17} /></Link>
      </div> : !catalogue.ready ? <CartCatalogueStatus error={catalogue.error} retry={catalogue.retry}/> : <form className="co-layout" onSubmit={placeOrder} noValidate>
        <div className="co-form-card">
          {!estimate.validLines.length&&<div className="cart-empty">
        <CircleAlert size={40} />
        <h2>{tx(locale, { en: 'No available trips to check out', es: 'No hay viajes disponibles para comprar', it: 'Nessun viaggio disponibile da acquistare', ar: 'لا توجد رحلات متاحة لإتمامها' })}</h2>
        <p>{tx(locale, { en: 'The trips saved in your cart are no longer available. Clear the cart and pick current trips.', es: 'Los viajes guardados en tu carrito ya no están disponibles. Vacía el carrito y elige viajes actuales.', it: 'I viaggi salvati nel carrello non sono più disponibili. Svuota il carrello e scegli viaggi attuali.', ar: 'الرحلات المحفوظة في السلة لم تعد متاحة. أفرغ السلة واختر رحلات حالية.' })}</p>
        <div className="car-success-actions"><button type="button" className="primary-btn" onClick={clearCart}>{tx(locale, { en: 'Clear cart', es: 'Vaciar carrito', it: 'Svuota carrello', ar: 'إفراغ السلة' })}</button><Link href="/trips" className="outline-btn">{tx(locale, { en: 'Browse trips', es: 'Explorar viajes', it: 'Sfoglia i viaggi', ar: 'تصفح الرحلات' })}</Link></div>
      </div>}

          <h2>{tx(locale, { en: 'Contact details', es: 'Datos de contacto', it: 'Dati di contatto', ar: 'بيانات التواصل' })}</h2>
          {showSummary && <p className="co-error" role="alert"><CircleAlert size={15} />{staleBlocked ? copy.staleBlocked : copy.fixErrors}</p>}
          <div className="form-grid">
            <label className="full">{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم الكامل' })}<input required value={name} onChange={(e) => { setName(e.target.value); setAttempted(false) }} placeholder={tx(locale, { en: 'Your name', es: 'Tu nombre', it: 'Il tuo nome', ar: 'اكتب اسمك الكامل' })} maxLength={80} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'co-name-error' : undefined} />{errorText('name') && <span className="field-error" id="co-name-error">{errorText('name')}</span>}</label>
            <label>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })}<input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setAttempted(false) }} placeholder="you@example.com" maxLength={120} autoComplete="email" dir="ltr" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'co-email-error' : undefined} />{errorText('email') && <span className="field-error" id="co-email-error">{errorText('email')}</span>}</label>
            <label>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'رقم الهاتف' })}<InternationalPhoneInput required value={phone} onChange={(value) => { setPhone(value); setAttempted(false) }} locale={locale} invalid={Boolean(errors.phone)} describedBy={errors.phone ? 'co-phone-error' : undefined} />{errorText('phone') && <span className="field-error" id="co-phone-error">{errorText('phone')}</span>}</label>
            <label className="full">{tx(locale, { en: 'Notes (optional)', es: 'Notas (opcional)', it: 'Note (facoltativo)', ar: 'ملاحظات (اختياري)' })}<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tx(locale, { en: 'Anything else we should know', es: 'Cualquier otra cosa que debamos saber', it: 'Altro che dovremmo sapere', ar: 'أية تفاصيل إضافية' })} maxLength={500} /></label>
          </div>
          {requiresAccountConsent && <label className="auth-v2-check"><input type="checkbox" required checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} /><span><Check size={13}/></span><em>{tx(locale,{en:'I agree to the Terms and Privacy Policy and to creating or linking my customer account after email verification.',es:'Acepto los términos y la política de privacidad, y la creación o vinculación de mi cuenta tras verificar el correo.',it:'Accetto i termini e l’informativa sulla privacy e la creazione o il collegamento dell’account dopo la verifica dell’email.'})} <Link href="/terms">{tx(locale,{en:'Terms',es:'Términos',it:'Termini'})}</Link> · <Link href="/privacy">{tx(locale,{en:'Privacy',es:'Privacidad',it:'Privacy'})}</Link></em></label>}
          <h2>{tx(locale, { en: 'Payment arrangements', es: 'Detalles del pago', it: 'Dettagli di pagamento', ar: 'ترتيبات الدفع' })}</h2>
          <p className="co-payment-note"><ShieldCheck size={16} /><span>{tx(locale, { en: 'No charge is made online. Payment details are arranged with our team after your booking request is reviewed.', es: 'No se cobra nada en línea. Los detalles del pago se acuerdan con nuestro equipo después de revisar tu solicitud de reserva.', it: 'Nessun addebito online. I dettagli di pagamento sono concordati con il nostro team dopo la revisione della richiesta.', ar: 'لا يتم خصم أي مبلغ عبر الإنترنت. تُرتب تفاصيل الدفع مع فريقنا بعد مراجعة طلب الحجز.' })}</span></p>
          {submitError && <p className="co-error" role="alert"><CircleAlert size={15} />{submitError}</p>}
        </div>
        <aside className="cart-summary" id="checkout-summary" tabIndex={-1}>
          {items.filter(item=>unavailable.includes(item.key)).map(item=><div key={item.key} className="co-error" role="alert">
            <span>{item.title}: {tx(locale,{en:'No longer available. Other selections are preserved.',es:'Ya no está disponible. Las demás selecciones se conservan.',it:'Non è più disponibile. Le altre selezioni restano salvate.'})}</span>
            <button type="button" className="outline-btn" onClick={()=>removeFromCart(item.key)}>{tx(locale,{en:'Remove selection',es:'Quitar selección',it:'Rimuovi selezione'})}</button>
          </div>)}
          <h2>{tx(locale, { en: 'Order summary', es: 'Resumen del pedido', it: 'Riepilogo ordine', ar: 'ملخص الطلب' })}</h2>
          {estimate.validLines.map(({ item, canonicalTotal, pricedAddons, onRequestAddons, invalidTravelers, invalidPrice, duplicateSelection, unavailableAddons }) => <div key={item.key} className="co-line">
            <div className="cart-summary-row"><span>{item.title}</span><strong>{invalidPrice ? "—" : formatPrice(canonicalTotal, currency, locale)}</strong></div>
            <small className="co-line-sub"><CalendarDays size={13} />{item.date || tx(locale, { en: 'Open date', es: 'Fecha abierta', it: 'Data aperta', ar: 'التاريخ مفتوح' })} {item.date ? tx(locale, { en: '(preferred)', es: '(preferida)', it: '(preferita)', ar: '(مفضل)' }) : ''} · <Users size={13} />{item.adults + item.children + item.infants} {tx(locale, { en: 'guest(s)', es: 'viajeros', it: 'viaggiatori', ar: 'ضيوف' })}</small>
            {(pricedAddons.length > 0 || onRequestAddons.length > 0) && <small className="co-line-sub co-line-addons">{[...pricedAddons, ...onRequestAddons.map((a) => `${a} (${tx(locale, { en: 'on request', es: 'bajo petición', it: 'su richiesta', ar: 'حسب الطلب' })})`)].join(' · ')}</small>}
            <CartLineIssues line={{item, invalidTravelers, invalidPrice, duplicateSelection, unavailableAddons, onRequestAddons}}/>
          </div>)}
          {estimate.staleLines.map(({ item }) => <div key={item.key} className="co-line is-stale">
            <div className="cart-summary-row"><span>{item.title}</span><button type="button" className="cart-remove" onClick={() => removeFromCart(item.key)} aria-label={tx(locale, { en: 'Remove from cart', es: 'Quitar del carrito', it: 'Rimuovi dal carrello', ar: 'إزالة من السلة' })}><Trash2 size={16} /></button></div>
            <small className="co-line-sub">{tx(locale, { en: 'No longer available - remove it to continue.', es: 'Ya no disponible - quítalo para continuar.', it: 'Non più disponibile - rimuovilo per continuare.', ar: 'لم تعد متاحة - أزلها للمتابعة.' })}</small>
          </div>)}
          {estimate.discount > 0 && <div className="cart-summary-row discount"><span>{tx(locale, { en: 'Deal savings', es: 'Ahorro por oferta', it: 'Risparmio offerta', ar: 'توفير العروض' })}</span><strong>−{formatPrice(estimate.discount, currency, locale)}</strong></div>}
          <div className="cart-summary-row total"><span>{tx(locale, { en: 'Estimated total', es: 'Total estimado', it: 'Totale stimato', ar: 'الإجمالي التقديري' })}</span><strong>{estimate.priceUnavailable ? "—" : formatPrice(estimate.subtotal, currency, locale)}</strong></div>
          <p>{tx(locale, { en: 'Frontend estimate only. The final price is recalculated from our catalogue before the booking is confirmed.', es: 'Solo estimación inicial. El precio final se recalcula desde nuestro catálogo antes de confirmar la reserva.', it: 'Solo stima iniziale. Il prezzo finale è ricalcolato dal nostro catalogo prima della conferma.', ar: 'تقدير مبدئي فقط. يُعاد حساب السعر النهائي من قائمتنا قبل تأكيد الحجز.' })}</p>
          {staleBlocked && <p className="co-error" role="alert">{copy.staleBlocked}</p>}
          {(submitError||staleBlocked)&&<button type="button" className="outline-btn" disabled={sending} onClick={recoverAttempt}>{tx(locale,{en:'Recover a previous request',es:'Recuperar una solicitud anterior',it:'Recupera una richiesta precedente'})}</button>}
          <button type="submit" className="primary-btn" disabled={staleBlocked || sending || requiresAccountConsent && !acceptedTerms}>{sending ? tx(locale, { en: 'Sending...', es: 'Enviando...', it: 'Invio in corso...', ar: 'جارٍ الإرسال...' }) : tx(locale, { en: 'Request booking', es: 'Solicitar reserva', it: 'Richiedi prenotazione', ar: 'إرسال طلب الحجز' })} <ArrowRight size={17} /></button>
        </aside>
      </form>}
    </main>
  </SiteShell>
}
