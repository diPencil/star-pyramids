'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { discardPendingBookingFunnel } from '@/lib/booking-funnel'
import { sanitizeLocale, type EnabledLocale } from '@/lib/locale-config'
import { chooseTrackingConsent, readTrackingConsent, readTrackingConsentPreference, subscribeToTrackingConsent, type TrackingConsent } from '@/lib/tracking-browser'
import styles from './consent-manager.module.css'

const optionalOff = { analytics: false, marketing: false }
const optionalOn = { analytics: true, marketing: true }

const en = {
  title: 'Your cookie choices',
  description: 'Essential cookies keep the site working. With your permission, we use optional cookies to understand how the site is used and measure our advertising.',
  accept: 'Accept all',
  reject: 'Reject optional',
  customize: 'Customize preferences',
  settings: 'Cookie settings',
  analytics: 'Analytics',
  analyticsHelp: 'Helps us understand which pages and features visitors use.',
  marketing: 'Marketing',
  marketingHelp: 'Helps us measure our ads and make them more relevant.',
  save: 'Save preferences',
  cancel: 'Cancel',
  privacy: 'Privacy policy',
  saved: 'Cookie preferences saved.',
  changed: 'Your preferences changed in another tab. Review them before saving.',
  unavailable: 'We couldn’t save your preferences. Optional tracking is off. You can continue using the site.',
}

const copy: Record<EnabledLocale, typeof en> = {
  en,
  es: {
    title: 'Tus preferencias de cookies',
    description: 'Las cookies esenciales permiten que el sitio funcione. Con tu permiso, usamos cookies opcionales para entender cómo se usa el sitio y medir nuestra publicidad.',
    accept: 'Aceptar todas',
    reject: 'Rechazar las opcionales',
    customize: 'Personalizar preferencias',
    settings: 'Configurar cookies',
    analytics: 'Analítica',
    analyticsHelp: 'Nos ayuda a saber qué páginas y funciones utilizan los visitantes.',
    marketing: 'Publicidad',
    marketingHelp: 'Nos ayuda a medir nuestros anuncios y hacerlos más relevantes.',
    save: 'Guardar preferencias',
    cancel: 'Cancelar',
    privacy: 'Política de privacidad',
    saved: 'Se han guardado tus preferencias de cookies.',
    changed: 'Tus preferencias han cambiado en otra pestaña. Revísalas antes de guardarlas.',
    unavailable: 'No hemos podido guardar tus preferencias. El seguimiento opcional está desactivado. Puedes seguir usando el sitio.',
  },
  it: {
    title: 'Le tue preferenze sui cookie',
    description: 'I cookie essenziali consentono al sito di funzionare. Con il tuo permesso, usiamo cookie facoltativi per capire come viene usato il sito e misurare la nostra pubblicità.',
    accept: 'Accetta tutti',
    reject: 'Rifiuta i facoltativi',
    customize: 'Personalizza le preferenze',
    settings: 'Impostazioni dei cookie',
    analytics: 'Analisi',
    analyticsHelp: 'Ci aiuta a capire quali pagine e funzioni usano i visitatori.',
    marketing: 'Pubblicità',
    marketingHelp: 'Ci aiuta a misurare gli annunci e a renderli più pertinenti.',
    save: 'Salva le preferenze',
    cancel: 'Annulla',
    privacy: 'Informativa sulla privacy',
    saved: 'Preferenze sui cookie salvate.',
    changed: 'Le tue preferenze sono cambiate in un’altra scheda. Controllale prima di salvarle.',
    unavailable: 'Non siamo riusciti a salvare le tue preferenze. Il tracciamento facoltativo è disattivato. Puoi continuare a usare il sito.',
  },
}

function subscribeToDocumentLanguage(update: () => void) {
  const observer = new MutationObserver(update)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  return () => observer.disconnect()
}

function documentLanguage() {
  return sanitizeLocale(document.documentElement.lang)
}

function samePreference(a: TrackingConsent | null, b: TrackingConsent | null) {
  return a?.analytics === b?.analytics && a?.marketing === b?.marketing
}

export function ConsentManager({ initialLocale }: { initialLocale: EnabledLocale }) {
  const locale = useSyncExternalStore(subscribeToDocumentLanguage, documentLanguage, () => initialLocale)
  const text = copy[locale]
  const id = useId()
  const settings = useRef<HTMLButtonElement>(null)
  const firstOption = useRef<HTMLInputElement>(null)
  const observedPreference = useRef<TrackingConsent | null>(null)
  const [preference, setPreference] = useState<TrackingConsent | null>()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<TrackingConsent>(optionalOff)
  const [feedback, setFeedback] = useState<'saved' | 'changed' | 'unavailable'>()

  useEffect(() => {
    const sync = (choice: TrackingConsent) => {
      const next = readTrackingConsentPreference(window)
      const previous = observedPreference.current
      if (!samePreference(previous, next)) {
        observedPreference.current = next
        setDraft(next ?? optionalOff)
      }
      setPreference(next)
      if (!choice.analytics) discardPendingBookingFunnel(window, process.env.NODE_ENV)
    }
    const unsubscribe = subscribeToTrackingConsent(window, sync)
    sync(readTrackingConsent(window))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (editing) firstOption.current?.focus()
  }, [editing])

  const close = () => {
    setEditing(false)
    settings.current?.focus()
  }
  const save = (choice: TrackingConsent) => {
    const saved = chooseTrackingConsent(window, choice)
    setFeedback(saved ? 'saved' : 'unavailable')
    if (saved) close()
    else setDraft(readTrackingConsent(window))
  }

  if (preference === undefined) return null
  const showChoices = preference === null || editing
  return (
    <section className={styles.region} aria-label={text.title} lang={locale} onKeyDown={event => {
      if (editing && event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }}>
      <div className={`container ${styles.inner}`}>
        {showChoices && (
          <div className={styles.copy}>
            <h2>{text.title}</h2>
            <p>{text.description} <a href="/privacy">{text.privacy}</a></p>
          </div>
        )}
        <div className={styles.actions}>
          {showChoices && <>
            <button className="outline-btn" type="button" onClick={() => save(optionalOn)}>{text.accept}</button>
            <button className="outline-btn" type="button" onClick={() => save(optionalOff)}>{text.reject}</button>
          </>}
          <button className={styles.settings} type="button" ref={settings} aria-expanded={editing} aria-controls={id}
            onClick={() => {
              if (editing) close()
              else {
                setDraft(readTrackingConsent(window))
                setFeedback(undefined)
                setEditing(true)
              }
            }}>
            {preference === null ? text.customize : text.settings}
          </button>
        </div>
        <div className={styles.panel} id={id} hidden={!editing}>
          {editing && (
            <form className={styles.preferences} onSubmit={event => {
              event.preventDefault()
              const current = readTrackingConsentPreference(window)
              if (!samePreference(preference, current)) {
                observedPreference.current = current
                setPreference(current)
                setDraft(current ?? optionalOff)
                setFeedback('changed')
                return
              }
              save(draft)
            }}>
              <fieldset aria-label={text.customize}>
                <label>
                  <input type="checkbox" ref={firstOption} checked={draft.analytics} aria-labelledby={`${id}-analytics-label`} aria-describedby={`${id}-analytics`}
                    onChange={event => setDraft({ ...draft, analytics: event.currentTarget.checked })} />
                  <span><strong id={`${id}-analytics-label`}>{text.analytics}</strong><small id={`${id}-analytics`}>{text.analyticsHelp}</small></span>
                </label>
                <label>
                  <input type="checkbox" checked={draft.marketing} aria-labelledby={`${id}-marketing-label`} aria-describedby={`${id}-marketing`}
                    onChange={event => setDraft({ ...draft, marketing: event.currentTarget.checked })} />
                  <span><strong id={`${id}-marketing-label`}>{text.marketing}</strong><small id={`${id}-marketing`}>{text.marketingHelp}</small></span>
                </label>
              </fieldset>
              <div className={styles.actions}>
                <button className="outline-btn" type="submit">{text.save}</button>
                <button className={styles.settings} type="button" onClick={close}>{text.cancel}</button>
              </div>
            </form>
          )}
        </div>
        <p className={feedback && feedback !== 'saved' ? styles.feedback : 'sr-only'} role="status">
          {feedback && text[feedback]}
        </p>
      </div>
    </section>
  )
}
