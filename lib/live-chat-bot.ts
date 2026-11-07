import type { Locale } from '@/lib/locale-config'

export type ChipId = 'prices' | 'agent' | 'booking' | 'browse' | 'trips' | 'plan' | 'contact' | 'wa'

export const chipsHome: ChipId[] = ['prices', 'agent', 'booking']
const chipsBrowse: ChipId[] = ['browse', 'trips']
const chipsPlan: ChipId[] = ['plan', 'browse']
const chipsContact: ChipId[] = ['wa', 'contact']

export const baseChipHrefs: Record<ChipId, string | undefined> = {
  prices: undefined, agent: undefined, booking: undefined,
  browse: '/egypt-tours/nile-cruises', trips: '/trips', plan: '/make-your-trip', contact: '/contact', wa: undefined,
}

const baseCopy = {
  en: {
    openLabel: 'Open live chat', closeLabel: 'Close live chat', sendLabel: 'Send message',
    name: 'STAR PYRAMIDS', online: 'Automated assistant', inputPh: 'Write a message...',
    teaser: 'Need help planning your Egypt trip? Chat with us!',
    greeting: "Hi there! I'm Nour from STAR PYRAMIDS. Ask me about Nile cruises, prices, or booking. Or pick a topic:",
    price: 'Our Nile cruises start from {price} per person, depending on the season and group size. Every cruise page has a season price table (solo, pair and group). Open any cruise and check "Cruise Prices".',
    cruise: 'We have 4 cruise levels: Standard, Deluxe, Superior, and Luxury, from 3 to 7 nights between Luxor and Aswan, with full board and guided temple visits.',
    booking: 'Booking is easy: open any trip and press "Book now", or tell us your dates on the Make Your Trip page and we will arrange everything.',
    human: 'Of course! Our team is on WhatsApp and on the Contact page. Choose Talk to an agent to request a reply.',
    thanks: 'You are welcome! I am here if you need anything else.',
    fallback: 'Got it! Choose Talk to an agent if you need our team. Meanwhile, pick a topic so I can help faster:',
    chipLabels: { prices: 'Nile cruise prices', agent: 'Talk to an agent', booking: 'How do I book?', browse: 'View Nile cruises', trips: 'See all trips', plan: 'Plan my trip', contact: 'Contact page', wa: 'WhatsApp us' },
  },
  ar: {
    openLabel: 'فتح المحادثة', closeLabel: 'إغلاق المحادثة', sendLabel: 'إرسال الرسالة',
    name: 'STAR PYRAMIDS', online: 'متصل الآن، يرد فورًا', inputPh: 'اكتب رسالة...',
    teaser: 'هل تحتاج إلى مساعدة في رحلتك إلى مصر؟ تحدث معنا!',
    greeting: 'أهلاً بك! أنا نور من STAR PYRAMIDS. اسألني عن الكروز النيلية أو الأسعار أو الحجز. أو اختر موضوعًا:',
    price: 'تبدأ أسعار الكروز النيلية من {price} للفرد حسب الموسم وعدد المسافرين. تتضمن كل رحلة جدول أسعار المواسم (الفردي والزوجي والمجموعات). افتح أي رحلة واطلع على قسم Cruise Prices.',
    cruise: 'لدينا ٤ فئات: عادية وديلوكس وسوبريور وفاخرة، من ٣ إلى ٧ ليالٍ بين الأقصر وأسوان بإقامة شاملة وزيارات معابد مع مرشد.',
    booking: 'الحجز سهل: افتح أي رحلة وانقر Book now، أو أرسل لنا مواعيدك في صفحة Make Your Trip وسنجهز لك كل شيء.',
    human: 'بالطبع! فريقنا متاح عبر واتساب وفي صفحة اتصل بنا. سيرد عليك أحد أفراد الفريق في أقرب وقت.',
    thanks: 'على الرحب والسعة! أنا هنا إن احتجت إلى أي شيء آخر.',
    fallback: 'حسنًا! سيتابع أحد أفراد فريقنا معك قريبًا. ويمكنك اختيار موضوع لأساعدك بشكل أسرع:',
    chipLabels: { prices: 'أسعار الكروز النيلية', agent: 'التحدث إلى موظف', booking: 'كيف أحجز؟', browse: 'استعرض الكروز النيلية', trips: 'كل الرحلات', plan: 'خطط رحلتك', contact: 'صفحة اتصل بنا', wa: 'واتساب' },
  },
} as const

export const copy = {
  ...baseCopy,
  es: {
    openLabel: 'Abrir chat', closeLabel: 'Cerrar chat', sendLabel: 'Enviar mensaje',
    name: 'STAR PYRAMIDS', online: 'Asistente automático', inputPh: 'Escribe un mensaje...',
    teaser: '¿Necesitas ayuda para planificar tu viaje a Egipto? ¡Chatea con nosotros!',
    greeting: '¡Hola! Soy Nour de STAR PYRAMIDS. Pregúntame sobre cruceros por el Nilo, precios o reservas. También puedes elegir un tema:',
    price: 'Nuestros cruceros por el Nilo cuestan desde {price} por persona, según la temporada y el tamaño del grupo. Cada página de crucero tiene una tabla de precios por temporada (individual, pareja y grupo). Abre un crucero y consulta «Precios del crucero».',
    cruise: 'Tenemos 4 categorías de cruceros: Standard, Deluxe, Superior y Luxury, de 3 a 7 noches entre Lúxor y Asuán, con pensión completa y visitas guiadas a los templos.',
    booking: 'Reservar es fácil: abre un viaje y pulsa «Reserva ahora», o indícanos tus fechas en la página «Crea tu viaje» y organizaremos los detalles.',
    human: '¡Por supuesto! Nuestro equipo está disponible en WhatsApp y en la página de contacto. Selecciona Hablar con un agente para solicitar una respuesta.',
    thanks: '¡De nada! Estoy aquí si necesitas algo más.',
    fallback: '¡Entendido! Selecciona Hablar con un agente si necesitas a nuestro equipo. Mientras tanto, elige un tema para que pueda ayudarte más rápido:',
    chipLabels: { prices: 'Precios de cruceros por el Nilo', agent: 'Hablar con un agente', booking: '¿Cómo reservo?', browse: 'Ver cruceros por el Nilo', trips: 'Ver todos los viajes', plan: 'Planificar mi viaje', contact: 'Página de contacto', wa: 'Escríbenos por WhatsApp' },
  },
  it: {
    openLabel: 'Apri la chat', closeLabel: 'Chiudi la chat', sendLabel: 'Invia messaggio',
    name: 'STAR PYRAMIDS', online: 'Assistente automatico', inputPh: 'Scrivi un messaggio...',
    teaser: 'Hai bisogno di aiuto per organizzare il tuo viaggio in Egitto? Chatta con noi!',
    greeting: 'Ciao! Sono Nour di STAR PYRAMIDS. Chiedimi informazioni su crociere sul Nilo, prezzi o prenotazioni. Oppure scegli un argomento:',
    price: 'Le nostre crociere sul Nilo partono da {price} a persona, in base alla stagione e alle dimensioni del gruppo. Ogni pagina della crociera ha una tabella dei prezzi stagionali (singolo, coppia e gruppo). Apri una crociera e consulta «Prezzi della crociera».',
    cruise: 'Abbiamo 4 categorie di crociere: Standard, Deluxe, Superior e Luxury, da 3 a 7 notti tra Luxor e Assuan, con pensione completa e visite guidate ai templi.',
    booking: 'Prenotare è semplice: apri un viaggio e premi «Prenota ora», oppure indica le tue date nella pagina «Crea il tuo viaggio» e organizzeremo i dettagli.',
    human: 'Certamente! Il nostro team è disponibile su WhatsApp e nella pagina dei contatti. Seleziona Parla con un operatore per richiedere una risposta.',
    thanks: 'Prego! Sono qui se hai bisogno di altro.',
    fallback: 'Ricevuto! Seleziona Parla con un operatore se hai bisogno del nostro team. Nel frattempo, scegli un argomento per aiutarti più rapidamente:',
    chipLabels: { prices: 'Prezzi delle crociere sul Nilo', agent: 'Parla con un operatore', booking: 'Come posso prenotare?', browse: 'Vedi le crociere sul Nilo', trips: 'Vedi tutti i viaggi', plan: 'Pianifica il mio viaggio', contact: 'Pagina dei contatti', wa: 'Scrivici su WhatsApp' },
  },
} as const

export function getBotReply(text: string, lang: Locale, priceStr: string): { text: string; chips: ChipId[] } {
  const t = copy[lang]
  const s = text.toLocaleLowerCase()
  const has = (...words: string[]) => words.some((w) => s.includes(w))
  if (/^(hi|hello|hey|good morning|good evening|hii+|hola|buenos días|buenas tardes|ciao|buongiorno|buonasera)\b/.test(s) || has('سلام', 'مرحبا', 'أهلا', 'اهلا', 'ازيك', 'هاي', 'صباح', 'مساء'))
    return { text: t.greeting, chips: [...chipsHome] }
  if (has('price', 'cost', 'much', 'cheap', 'discount', 'precio', 'cuánto', 'descuento', 'prezzo', 'prezzi', 'quanto', 'sconto', 'سعر', 'أسعار', 'اسعار', 'بكام', 'تكلفة', 'تكلفه', 'خصم'))
    return { text: t.price.replace('{price}', priceStr), chips: [...chipsBrowse] }
  if (has('book', 'reserve', 'reserv', 'prenot', 'حجز', 'احجز', 'الحجز'))
    return { text: t.booking, chips: [...chipsPlan] }
  if (has('cruise', 'nile', 'ship', 'luxor', 'aswan', 'crucero', 'nilo', 'crociera', 'crociere', 'كروز', 'نيل', 'النيل', 'مركب', 'الأقصر', 'الاقصر', 'أسوان', 'اسوان'))
    return { text: t.cruise, chips: [...chipsBrowse] }
  if (has('human', 'agent', 'person', 'someone', 'call', 'phone', 'contact', 'whatsapp', 'agente', 'operatore', 'contatt', 'teléfono', 'telefono', 'موظف', 'إنسان', 'انسان', 'بشر', 'مندوب', 'حد يكلمني', 'اتصل', 'تليفون', 'رقم', 'واتس', 'تواصل'))
    return { text: t.human, chips: [...chipsContact] }
  if (has('thank', 'thanks', 'gracias', 'grazie', 'شكرا', 'متشكر', 'ميرسي'))
    return { text: t.thanks, chips: [...chipsHome] }
  return { text: t.fallback, chips: [...chipsHome] }
}

