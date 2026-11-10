'use client'

import { beginFormLead, confirmFormLead, type FormLeadAttempt } from "@/lib/tracking/leads/form-lead";
import { CmsPublicLink } from "@/components/cms/cms-public-link";
import { usePresentation, PresentationSection, PresentationOrder, useSharedFaqs } from "@/components/cms/presentation-content-context";
import { useRef, useState } from "react";
import { ArrowRight, Check, CircleAlert, Mail, MapPin, MessageCircle, Phone, Send, ShieldCheck } from "lucide-react";
import { siteImages } from "@/data/content";
import { useBrandSettings } from "@/lib/admin-store";
import { phoneHref, whatsappHref } from "@/data/company";
import { useLocale, tx } from "../locale";
import { Breadcrumb, PageShowcaseHero, SiteShell, extra } from "@/components/site";
import { SharedSelect } from "@/components/shared/forms/shared-select";
import { customerErrorText } from "@/lib/account/customer-error-copy";


export function ContactPage() {
  return <SiteShell><ContactPageContent /></SiteShell>
}

function ContactPageContent() {
  const cms = usePresentation("contact")
  const contactFaqs = useSharedFaqs(3)

  const { locale: cl } = useLocale()
  const brand = useBrandSettings()
  const ar = cl === 'ar'
  const ex = extra[cl]
  const contactMethods = [
    { Icon: Mail, title: cms.text("contact-enquiry","descriptionMethod0",tx(cl, { en: 'Email our travel team', es: 'Escribe a nuestro equipo de viajes', it: 'Scrivi al nostro team di viaggio', ar: 'راسل فريق الرحلات' })), value: brand.email, note: cms.text("contact-enquiry","descriptionMethod1",tx(cl, { en: 'For itineraries and general questions', es: 'Para itinerarios y consultas generales', it: 'Per itinerari e domande generali', ar: 'لبرامج الرحلات والأسئلة العامة' })), href: `mailto:${brand.email}` },
    { Icon: Phone, title: cms.text("contact-enquiry","descriptionMethod2",tx(cl, { en: 'Call our travel team', es: 'Llama a nuestro equipo de viajes', it: 'Chiama il nostro team di viaggio', ar: 'اتصل بفريقنا' })), value: brand.phone, note: cms.text("contact-enquiry","descriptionMethod3",tx(cl, { en: 'For direct enquiries and travel help', es: 'Para consultas directas y ayuda con tu viaje', it: 'Per richieste dirette e assistenza di viaggio', ar: 'للتواصل المباشر والاستفسارات' })), href: phoneHref(brand.phone) },
    { Icon: MessageCircle, title: cms.text("contact-enquiry","descriptionMethod4",tx(cl, { en: 'Chat with us on WhatsApp', es: 'Escríbenos por WhatsApp', it: 'Scrivici su WhatsApp', ar: 'راسلنا على واتساب' })), value: brand.whatsapp, note: cms.text("contact-enquiry","descriptionMethod5",tx(cl, { en: 'Start a direct WhatsApp conversation', es: 'Inicia una conversación directa por WhatsApp', it: 'Avvia una conversazione WhatsApp diretta', ar: 'ابدأ محادثة واتساب مباشرة' })), href: whatsappHref(brand.whatsapp) },
  ]
  const steps = cms.items("contact-v2-process", [['01', tx(cl, { en: 'Tell us about your trip', es: 'Cuéntanos tu viaje', it: 'Raccontaci il tuo viaggio', ar: 'احكيلنا عن رحلتك' }), tx(cl, { en: 'Share your dates, group size, and the places you want to experience.', es: 'Comparte tus fechas, el tamaño del grupo y los lugares que quieres conocer.', it: 'Condividi date, numero di partecipanti e luoghi che vuoi scoprire.', ar: 'شاركنا مواعيدك، عدد المسافرين، والأماكن اللي نفسك تشوفها.' })], ['02', tx(cl, { en: 'We shape the details', es: 'Damos forma a los detalles', it: 'Diamo forma ai dettagli', ar: 'نرتب التفاصيل' }), tx(cl, { en: 'Our local team reviews your idea and connects the right route and experiences.', es: 'Nuestro equipo local revisa tu idea y une la ruta y las experiencias adecuadas.', it: 'Il nostro team locale esamina la tua idea e collega itinerario ed esperienze giusti.', ar: 'فريقنا المحلي يراجع فكرتك ويجمع أنسب مسار وتجارب ليك.' })], ['03', tx(cl, { en: 'Receive a clear proposal', es: 'Recibe una propuesta clara', it: 'Ricevi una proposta chiara', ar: 'تستلم تصور واضح' }), tx(cl, { en: 'We return with an easy-to-review plan before you make any commitment.', es: 'Te devolvemos un plan fácil de revisar antes de ningún compromiso.', it: 'Ti presentiamo un piano facile da rivedere prima di qualsiasi impegno.', ar: 'نرجعلك بخطة مفهومة وتفاصيل جاهزة للمراجعة قبل أي التزام.' })]])

  return <main className="contact-v2"><PresentationOrder pageId="contact">
      <PageShowcaseHero image={siteImages.nile} eyebrow={tx(cl, { en: 'Local team, personal planning', es: 'Equipo local, planificación personal', it: 'Team locale, pianificazione personale', ar: 'فريق محلي, تخطيط شخصي' })} title={tx(cl, { en: 'Your Egypt journey starts with a conversation.', es: 'Tu viaje a Egipto empieza con una conversación.', it: 'Il tuo viaggio in Egitto inizia con una conversazione.', ar: 'رحلتك لمصر تبدأ بمحادثة.' })} intro={tx(cl, { en: 'Tell us how you want to experience Egypt, and we will help turn the idea into a thoughtful route shaped around your time and interests.', es: 'Cuéntanos cómo quieres vivir Egipto y te ayudaremos a convertir la idea en una ruta a medida según tu tiempo e intereses.', it: 'Raccontaci come vuoi vivere l\'Egitto: ti aiuteremo a trasformare l\'idea in un itinerario pensato su tempi e interessi.', ar: 'قولنا نفسك تشوف مصر إزاي، وإحنا نساعدك تحول الفكرة لمسار متوازن يناسب وقتك واهتماماتك.' })} primaryLabel={tx(cl, { en: 'Start the conversation', es: 'Inicia la conversación', it: 'Avvia la conversazione', ar: 'ابدأ المحادثة' })} primaryHref="#contact-enquiry" secondaryLabel={tx(cl, { en: 'Build a detailed trip', es: 'Crea un viaje detallado', it: 'Crea un viaggio dettagliato', ar: 'خطط رحلتك بالتفصيل' })} secondaryHref="/make-your-trip" railLabel={tx(cl, { en: 'Start here', es: 'Empieza aquí', it: 'Inizia qui', ar: 'ابدأ من هنا' })} railTitle={tx(cl, { en: 'Tell us the journey you have in mind.', es: 'Cuéntanos el viaje que tienes en mente.', it: 'Raccontaci il viaggio che hai in mente.', ar: 'احكيلنا عن الرحلة اللي في بالك.' })} railHref="#contact-enquiry" railMeta={[{ Icon: MessageCircle, label: tx(cl, { en: 'Trip enquiry', es: 'Consulta de viaje', it: 'Richiesta di viaggio', ar: 'استفسار عن رحلة' }) }, { Icon: ShieldCheck, label: tx(cl, { en: 'Sent to our team', es: 'Enviada a nuestro equipo', it: 'Inviata al nostro team', ar: 'تُرسل إلى فريقنا' }) }]} statsLabel={tx(cl, { en: 'Contact summary', es: 'Resumen de contacto', it: 'Riepilogo contatti', ar: 'ملخص التواصل' })} stats={[{ value: contactMethods.length, label: tx(cl, { en: 'Ways to connect', es: 'Formas de contactar', it: 'Modi per contattarci', ar: 'طرق للتواصل' }) }, { value: steps.length, label: tx(cl, { en: 'Planning steps', es: 'Pasos de planificación', it: 'Fasi di pianificazione', ar: 'خطوات للتخطيط' }) }]}/>
      <Breadcrumb items={[cms.text("presentation","description0",tx(cl, { en: 'Contact Us', es: 'Contáctanos', it: 'Contattaci', ar: 'تواصل معنا' }))]}/>

      <PresentationSection pageId="contact" id="contact-v2-trust"><section className="contact-v2-trust" aria-label={tx(cl, { en: 'Reasons to contact us', es: 'Por qué contactarnos', it: 'Perché contattarci', ar: 'مميزات التواصل معنا' })}>
        <div className="container">{cms.cards("contact-v2-trust").map(({id,title,Icon})=><span key={id}><Icon size={20}/><b>{title}</b></span>)}</div>
      </section></PresentationSection>

      <PresentationSection pageId="contact" id="contact-enquiry"><section id="contact-enquiry" className="container contact-v2-main">
        <div className="contact-v2-intro">
          <span className="eyebrow">{cms.text("contact-enquiry","description0",tx(cl, { en: 'Let us plan it together', es: 'Planifiquémoslo juntos', it: 'Pianifichiamolo insieme', ar: 'خلينا نخططها سوا' }))}</span>
          <h2>{cms.text("contact-enquiry","description1",tx(cl, { en: 'What kind of journey do you have in mind?', es: '¿Qué tipo de viaje tienes en mente?', it: 'Che tipo di viaggio hai in mente?', ar: 'إيه شكل الرحلة اللي في بالك؟' }))}</h2>
          <p>{cms.text("contact-enquiry","description2",tx(cl, { en: 'Whether it is one day in Cairo, a complete package, a Nile cruise, or an airport transfer, send us the starting point and let our team connect the details.', es: 'Ya sea un día en El Cairo, un paquete completo, un crucero por el Nilo o un traslado al aeropuerto: envíanos la idea inicial y nuestro equipo unirá los detalles.', it: 'Che si tratti di un giorno al Cairo, di un pacchetto completo, di una crociera sul Nilo o di un trasferimento aeroportuale: inviaci l\'idea di partenza e il nostro team collegherà i dettagli.', ar: 'سواء يوم واحد في القاهرة، باكدج كاملة، نايل كروز، أو استقبال من المطار، ابعتلنا الفكرة الأساسية وسيب التفاصيل علينا.' }))}</p>
          <div className="contact-v2-methods">
            {contactMethods.map(({ Icon, ...method }) => <a href={method.href} key={method.title} className="contact-v2-method" target={method.href.startsWith('https://wa.me/') ? '_blank' : undefined} rel={method.href.startsWith('https://wa.me/') ? 'noreferrer' : undefined}>
              <Icon size={22} />
              <span><small>{method.title}</small><strong>{method.value}</strong><em>{method.note}</em></span>
              <ArrowRight size={18} />
            </a>)}
          </div>
          <a className="contact-v2-address" href={brand.mapUrl || undefined} target={brand.mapUrl ? '_blank' : undefined} rel={brand.mapUrl ? 'noreferrer' : undefined}><MapPin size={22} /><span><small>{ex.addrT}</small><strong>{brand.address}</strong></span></a>
        </div>
        <div className="contact-v2-form-wrap">
          <header><span>{cms.text("contact-enquiry","description3",tx(cl, { en: 'Trip enquiry', es: 'Solicitud de viaje', it: 'Richiesta di viaggio', ar: 'طلب رحلة' }))}</span><h2>{cms.text("contact-enquiry","description4",tx(cl, { en: 'Start here.', es: 'Empieza aquí.', it: 'Inizia qui.', ar: 'ابدأ من هنا.' }))}</h2><p>{cms.text("contact-enquiry","description5",tx(cl, { en: 'The more you share, the more useful our first response can be.', es: 'Cuanto más nos cuentes, más útil será nuestra primera respuesta.', it: 'Più ci racconti, più utile sarà la nostra prima risposta.', ar: 'كل ما تحكيلنا أكتر، نقدر نساعدك بصورة أدق.' }))}</p></header>
          <ContactForm />
        </div>
      </section></PresentationSection>

      <PresentationSection pageId="contact" id="contact-v2-process"><section className="contact-v2-process">
        <div className="container">
          <header><span className="eyebrow">{cms.text("contact-v2-process","description0",tx(cl, { en: 'What happens next', es: 'Qué pasa después', it: 'Cosa succede dopo', ar: 'بعد ما تبعتلنا' }))}</span><h2>{cms.text("contact-v2-process","description1",tx(cl, { en: 'From first message to a clear travel plan.', es: 'Del primer mensaje a un plan de viaje claro.', it: 'Dal primo messaggio a un piano di viaggio chiaro.', ar: 'من أول رسالة لخطة رحلة واضحة.' }))}</h2></header>
          <div>{steps.map(([number, title, copy]) => <article key={number}><b>{number}</b><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </div>
      </section></PresentationSection>

      <PresentationSection pageId="contact" id="contact-v2-faq"><section className="container contact-v2-faq">
        <div><span className="eyebrow">{cms.text("contact-v2-faq", "faqEyebrow", ex.faqTeaser)}</span><h2>{cms.text("contact-v2-faq","description0",tx(cl, { en: 'Before you get in touch.', es: 'Antes de contactarnos.', it: 'Prima di contattarci.', ar: 'قبل ما تراسلنا.' }))}</h2><p>{cms.text("contact-v2-faq","description1",tx(cl, { en: 'Quick answers to the questions that usually begin a journey.', es: 'Respuestas rápidas a las preguntas con las que suele empezar un viaje.', it: 'Risposte rapide alle domande con cui di solito inizia un viaggio.', ar: 'إجابات سريعة على الأسئلة اللي غالبًا بتبدأ بيها الرحلة.' }))}</p></div>
        <div>{contactFaqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}<CmsPublicLink className="text-link" href={cms.link("contact-v2-faq","links0","/faq")}>{cms.text("contact-v2-faq", "faqCta", ex.seeMore)} <ArrowRight size={15} /></CmsPublicLink></div>
      </section></PresentationSection>
    </PresentationOrder></main>
}

export function ContactForm() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const pendingRequest = useRef<{ payload: string; id: string; measurement: FormLeadAttempt } | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (status === 'error') setStatus('idle')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    if (!formData.subject) {
      setStatus('error')
      setError(tx(locale, { en: 'Choose a trip type.', es: 'Elige un tipo de viaje.', it: 'Scegli un tipo di viaggio.', ar: 'اختر نوع الرحلة.' }))
      document.getElementById('contact-trip-type')?.focus()
      return
    }
    submitting.current = true
    setStatus('submitting')
    setError('')

    try {
      const payload = JSON.stringify({ ...formData, sourcePage: '/contact' })
      if (pendingRequest.current?.payload !== payload) {
        const bytes = crypto.getRandomValues(new Uint8Array(16))
        bytes[6] = (bytes[6] & 15) | 64
        bytes[8] = (bytes[8] & 63) | 128
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
        const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
        pendingRequest.current = { payload, id, measurement: beginFormLead(window, process.env.NODE_ENV, 'contact') }
      }
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...formData, sourcePage: '/contact', requestId: pendingRequest.current.id }),
      })
      const data = await res.json().catch(() => null)
      const fallback = tx(locale, { en: 'Could not confirm your enquiry. Please retry without changing your details.', es: 'No se pudo confirmar tu consulta. Vuelve a intentarlo sin cambiar tus datos.', it: 'Impossibile confermare la tua richiesta. Riprova senza modificare i tuoi dati.', ar: 'تعذر تأكيد استفسارك. حاول مجددًا دون تغيير بياناتك.' })
      if (!res.ok) {
        throw new Error(customerErrorText(locale, data?.error, fallback))
      }
      if (typeof data?.enquiry?.publicId !== 'string' || !data.enquiry.publicId || typeof data.enquiry.createdAt !== 'string') throw new Error(fallback)
      confirmFormLead(window, process.env.NODE_ENV, pendingRequest.current.measurement, res.status, data)
      pendingRequest.current = null
      setStatus('success')
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : tx(locale, { en: 'Could not submit enquiry. Please try again.', es: 'No se pudo enviar la consulta. Inténtalo de nuevo.', it: 'Impossibile inviare la richiesta. Riprova.', ar: 'تعذر إرسال الاستفسار. حاول مجددًا.' }))
    } finally {
      submitting.current = false
    }
  }

  if (status === 'success') {
    return (
      <div className="form-success contact-v2-success">
        <Check size={38} />
        <span>{tx(locale, { en: 'Enquiry sent', es: 'Consulta enviada', it: 'Richiesta inviata', ar: 'تم إرسال الاستفسار' })}</span>
        <h2>{tx(locale, { en: 'We have received your enquiry.', es: 'Hemos recibido tu consulta.', it: 'Abbiamo ricevuto la tua richiesta.', ar: 'لقد تلقينا استفسارك.' })}</h2>
        <p>{tx(locale, { en: 'Our team will review your details and get back to you shortly.', es: 'Nuestro equipo revisará tus datos y se pondrá en contacto contigo en breve.', it: 'Il nostro team esaminerà i tuoi dati e ti contatterà a breve.', ar: 'سيراجع فريقنا تفاصيلك وسيعاود الاتصال بك قريباً.' })}</p>
        <button type="button" className="outline-btn" onClick={() => setStatus('idle')}>
          {tx(locale, { en: 'Send another enquiry', es: 'Enviar otra consulta', it: 'Invia un\'altra richiesta', ar: 'إرسال استفسار آخر' })}
        </button>
      </div>
    )
  }

  const tripTypes = [
    { key: 'one-day', en: 'One-day tour', es: 'Excursión de un día', it: 'Tour di un giorno', ar: 'رحلة يوم واحد' },
    { key: 'multi-day', en: 'Multi-day package', es: 'Paquete de varios días', it: 'Pacchetto di più giorni', ar: 'باكدج متعددة الأيام' },
    { key: 'nile-cruise', en: 'Nile cruise', es: 'Crucero por el Nilo', it: 'Crociera sul Nilo', ar: 'نايل كروز' },
    { key: 'shore', en: 'Shore excursion', es: 'Excursión en tierra', it: 'Escursione a terra', ar: 'رحلة شاطئية' },
    { key: 'car', en: 'Car hire or transfer', es: 'Alquiler de coche o traslado', it: 'Noleggio auto o trasferimento', ar: 'تأجير عربية أو استقبال' },
    { key: 'custom', en: 'Custom journey', es: 'Viaje a medida', it: 'Viaggio su misura', ar: 'رحلة مصممة مخصوص' },
  ] as const

  return (
    <form className="contact-form contact-v2-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          {tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم بالكامل' })}
          <input
            required
            autoComplete="name"
            placeholder={tx(locale, { en: 'Your name', es: 'Tu nombre', it: 'Il tuo nome', ar: 'اسمك' })}
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={status === 'submitting'}
          />
        </label>
        <label>
          {tx(locale, { en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email', ar: 'البريد الإلكتروني' })}
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            disabled={status === 'submitting'}
          />
        </label>
        <label>
          {tx(locale, { en: 'Phone (optional)', es: 'Teléfono (opcional)', it: 'Telefono (opzionale)', ar: 'الهاتف (اختياري)' })}
          <input
            type="tel"
            autoComplete="tel"
            placeholder={tx(locale, { en: 'Your phone number', es: 'Tu número de teléfono', it: 'Il tuo numero di telefono', ar: 'رقم هاتفك' })}
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            disabled={status === 'submitting'}
          />
        </label>
        <label className="full">
          {tx(locale, { en: 'What can we help with?', es: '¿En qué podemos ayudarte?', it: 'Come possiamo aiutarti?', ar: 'نوع الرحلة' })}
          <SharedSelect
            id="contact-trip-type"
            value={formData.subject}
            onChange={(value) => handleChange('subject', value)}
            locale={locale}
            label={tx(locale, { en: 'What can we help with?', es: '¿En qué podemos ayudarte?', it: 'Come possiamo aiutarti?', ar: 'نوع الرحلة' })}
            placeholder={tx(locale, { en: 'Choose a trip type', es: 'Elige un tipo de viaje', it: 'Scegli un tipo di viaggio', ar: 'اختار نوع الرحلة' })}
            options={tripTypes.map((t) => ({ value: t.key, label: tx(locale, { en: t.en, es: t.es, it: t.it, ar: t.ar }) }))}
            disabled={status === 'submitting'}
            popupWidth="trigger"
          />
        </label>
        <label className="full">
          {tx(locale, { en: 'Tell us about your trip', es: 'Cuéntanos tu viaje', it: 'Raccontaci il tuo viaggio', ar: 'احكيلنا عن الرحلة' })}
          <textarea
            required
            placeholder={tx(locale, { en: 'Dates, group size, and the places or experiences you are interested in...', es: 'Fechas, tamaño del grupo y lugares o experiencias que te interesen...', it: 'Date, numero di partecipanti e luoghi o esperienze di interesse...', ar: 'المواعيد، عدد المسافرين، والأماكن أو التجارب اللي مهتم بيها...' })}
            value={formData.message}
            onChange={(e) => handleChange('message', e.target.value)}
            disabled={status === 'submitting'}
          />
        </label>
      </div>
      {status === 'error' && (
        <p className="contact-v2-form-error" role="alert">
          <CircleAlert size={14} /> {error}
        </p>
      )}
      <button className="primary-btn" type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? (
          <>
            <span className="spinner" style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}><Send size={17} /></span>
            {tx(locale, { en: 'Sending...', es: 'Enviando...', it: 'Invio...', ar: 'جاري الإرسال...' })}
          </>
        ) : (
          <>
            {tx(locale, { en: 'Send enquiry', es: 'Enviar consulta', it: 'Invia richiesta', ar: 'إرسال الاستفسار' })} <Send size={17} />
          </>
        )}
      </button>
      <small className="contact-v2-form-note"><ShieldCheck size={14} />{tx(locale, { en: 'Your details are sent securely to our team.', es: 'Tus datos se envían de forma segura a nuestro equipo.', it: 'I tuoi dati vengono inviati in modo sicuro al nostro team.', ar: 'ترسل بياناتك بأمان إلى فريقنا.' })}</small>
    </form>
  )
}
