import type { Metadata } from 'next'
import { pickLocaleText, type Locale } from './locale-config'

const copy = {
  login: {
    title: { en: 'Sign In', es: 'Iniciar sesión', it: 'Accedi' },
    description: { en: 'Sign in to your STAR PYRAMIDS account to manage bookings and trips.', es: 'Inicia sesión en tu cuenta de STAR PYRAMIDS para gestionar reservas y viajes.', it: 'Accedi al tuo account STAR PYRAMIDS per gestire prenotazioni e viaggi.' },
  },
  register: {
    title: { en: 'Create Account', es: 'Crear cuenta', it: 'Crea un account' },
    description: { en: 'Create your STAR PYRAMIDS account to book Egypt trips and manage your travel.', es: 'Crea tu cuenta de STAR PYRAMIDS para reservar viajes a Egipto y gestionar tu viaje.', it: 'Crea il tuo account STAR PYRAMIDS per prenotare viaggi in Egitto e gestire il tuo viaggio.' },
  },
  forgotPassword: {
    title: { en: 'Forgot Password', es: 'Recuperar contraseña', it: 'Recupera password' },
    description: { en: 'Reset your STAR PYRAMIDS account password.', es: 'Restablece la contraseña de tu cuenta de STAR PYRAMIDS.', it: 'Reimposta la password del tuo account STAR PYRAMIDS.' },
  },
  resetPassword: {
    title: { en: 'Reset Password', es: 'Restablecer contraseña', it: 'Reimposta password' },
    description: { en: 'Set a new password for your STAR PYRAMIDS account.', es: 'Establece una nueva contraseña para tu cuenta de STAR PYRAMIDS.', it: 'Imposta una nuova password per il tuo account STAR PYRAMIDS.' },
  },
} as const

export function authPageMetadata(page: keyof typeof copy, locale: Locale): Metadata {
  return {
    title: pickLocaleText(locale, copy[page].title),
    description: pickLocaleText(locale, copy[page].description),
    robots: { index: false, follow: false, nocache: true },
  }
}
