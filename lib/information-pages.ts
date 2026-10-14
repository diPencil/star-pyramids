import type { EditorialSection, FaqHero } from './faq-hero'

export const INFORMATION_PAGE_IDS = ['guide', 'accessible'] as const
export type InformationPageId = typeof INFORMATION_PAGE_IDS[number]
export function isInformationPageId(value: string): value is InformationPageId {
  return INFORMATION_PAGE_IDS.some((id) => id === value)
}

function section(id: string, href: string, en: [string, string, string], es: [string, string, string], it: [string, string, string]): EditorialSection {
  const fields = ([heading, description, action]: [string, string, string]) => ({ heading, description, action })
  return { id, href, text: { en: fields(en), es: fields(es), it: fields(it) } }
}

export function originalInformationPage(id: InformationPageId): FaqHero {
  if (id === 'guide') return {
    text: {
      en: { eyebrow: 'Learn before you go', heading: 'Egypt travel guide', description: 'Attractions, tips, destinations, and honest advice for planning a smoother journey.', action: 'Plan my trip', alt: 'The pyramids of Giza in Egypt' },
      es: { eyebrow: 'Aprende antes de viajar', heading: 'Guía de viaje de Egipto', description: 'Atracciones, consejos, destinos y recomendaciones honestas para planificar un viaje sin contratiempos.', action: 'Planifica mi viaje', alt: 'Las pirámides de Guiza en Egipto' },
      it: { eyebrow: 'Impara prima di partire', heading: 'Guida di viaggio dell’Egitto', description: 'Attrazioni, consigli, destinazioni e suggerimenti onesti per pianificare un viaggio senza intoppi.', action: 'Pianifica il mio viaggio', alt: 'Le piramidi di Giza in Egitto' },
    },
    image: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=85', href: '/make-your-trip',
    sections: [
      section('civilization', '/blogs',
        ['Ancient civilization', 'Connect the pyramids, temples and tombs through the stories behind them. Our travel articles introduce Egypt’s ancient landmarks and help you choose what to explore in more detail.', 'Read the travel stories'],
        ['Civilización antigua', 'Relaciona pirámides, templos y tumbas a través de sus historias. Nuestros artículos presentan los monumentos del antiguo Egipto y te ayudan a elegir qué explorar con más detalle.', 'Lee las historias de viaje'],
        ['Civiltà antica', 'Collega piramidi, templi e tombe attraverso le loro storie. I nostri articoli presentano i monumenti dell’antico Egitto e ti aiutano a scegliere cosa approfondire.', 'Leggi le storie di viaggio']),
      section('attractions', '/trips',
        ['Tourist attractions', 'Start with the places that interest you, then compare the journeys that include them. Leave room between visits and tell us whether you prefer museums, archaeological sites or time by the water.', 'Explore the tours'],
        ['Atracciones turísticas', 'Empieza por los lugares que te interesan y compara los viajes que los incluyen. Deja tiempo entre visitas y dinos si prefieres museos, yacimientos arqueológicos o momentos junto al agua.', 'Explora las excursiones'],
        ['Attrazioni turistiche', 'Parti dai luoghi che ti interessano e confronta i viaggi che li includono. Lascia tempo tra le visite e dicci se preferisci musei, siti archeologici o momenti vicino all’acqua.', 'Esplora i tour']),
      section('practical', '/faq',
        ['Travel tips', 'Pack comfortable shoes, sun protection and layers suited to your itinerary. Discuss luggage, transfers and the pace of excursions before booking. Check current entry requirements with the relevant official authorities before travelling.', 'Read common questions'],
        ['Consejos de viaje', 'Lleva calzado cómodo, protección solar y ropa en capas adecuada a tu itinerario. Consulta el equipaje, los traslados y el ritmo de las excursiones antes de reservar. Comprueba los requisitos de entrada vigentes con las autoridades oficiales antes de viajar.', 'Lee las preguntas frecuentes'],
        ['Consigli di viaggio', 'Porta scarpe comode, protezione solare e abbigliamento a strati adatto all’itinerario. Concorda bagagli, trasferimenti e ritmo delle escursioni prima di prenotare. Verifica i requisiti d’ingresso aggiornati con le autorità competenti prima del viaggio.', 'Leggi le domande frequenti']),
      section('destinations', '/destinations',
        ['Destinations', 'Cities, the Nile, desert landscapes and the Red Sea offer different rhythms. Explore the destination stories and choose the places that fit your interests rather than trying to fit everything into one trip.', 'Discover the destinations'],
        ['Destinos', 'Las ciudades, el Nilo, los paisajes del desierto y el mar Rojo ofrecen ritmos diferentes. Explora nuestras historias de destinos y elige los lugares que encajen con tus intereses sin intentar verlo todo en un solo viaje.', 'Descubre los destinos'],
        ['Destinazioni', 'Le città, il Nilo, i paesaggi del deserto e il Mar Rosso offrono ritmi diversi. Esplora le storie delle destinazioni e scegli i luoghi adatti ai tuoi interessi senza cercare di vedere tutto in un solo viaggio.', 'Scopri le destinazioni']),
      section('packages', '/make-your-trip',
        ['Tour packages', 'A day tour, a multi-day journey and a Nile cruise each suit a different kind of holiday. Share your dates, interests and preferred pace so our team can propose a route and confirm the details with you.', 'Build my itinerary'],
        ['Paquetes turísticos', 'Una excursión de un día, un viaje de varios días y un crucero por el Nilo se adaptan a vacaciones diferentes. Comparte tus fechas, intereses y ritmo preferido para que nuestro equipo proponga una ruta y confirme contigo los detalles.', 'Crea mi itinerario'],
        ['Pacchetti di viaggio', 'Un’escursione giornaliera, un viaggio di più giorni e una crociera sul Nilo si adattano a vacanze diverse. Condividi date, interessi e ritmo preferito: il nostro team proporrà un itinerario e confermerà i dettagli con te.', 'Crea il mio itinerario']),
      section('responsible', '/accessible-travel',
        ['Sustainability and accessible travel', 'Respect local communities, follow site instructions and keep waste out of natural and historic places. Tell us about access requirements early so we can discuss a suitable route and confirm practical arrangements before booking.', 'Discuss accessible travel'],
        ['Sostenibilidad y viajes accesibles', 'Respeta a las comunidades locales, sigue las instrucciones de cada lugar y evita dejar residuos en espacios naturales e históricos. Cuéntanos con antelación tus necesidades de accesibilidad para estudiar una ruta y confirmar los preparativos antes de reservar.', 'Consulta sobre accesibilidad'],
        ['Sostenibilità e viaggi accessibili', 'Rispetta le comunità locali, segui le indicazioni dei siti e non lasciare rifiuti nei luoghi naturali e storici. Comunica in anticipo le tue esigenze di accessibilità per valutare un itinerario e confermare l’organizzazione prima di prenotare.', 'Parliamo di accessibilità']),
    ],
  }
  return {
    text: {
      en: { eyebrow: 'Travel for everyone', heading: 'Accessible travel in Egypt', description: 'Extra assistance, adapted pacing, and honest advice so every guest can enjoy Egypt comfortably.', action: 'Ask about assistance', alt: 'The Sphinx and pyramids at Giza' },
      es: { eyebrow: 'Viajar es para todos', heading: 'Viajes accesibles en Egipto', description: 'Asistencia extra, ritmo adaptado y consejos honestos para que cada viajero disfrute Egipto con comodidad.', action: 'Pregunta por asistencia', alt: 'La Esfinge y las pirámides de Guiza' },
      it: { eyebrow: 'Viaggiare è per tutti', heading: 'Viaggi accessibili in Egitto', description: 'Assistenza extra, ritmo adattato e consigli onesti perché ogni ospite possa godersi l’Egitto comodamente.', action: 'Chiedi assistenza', alt: 'La Sfinge e le piramidi di Giza' },
    },
    image: 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1200&q=85', href: '/contact',
    sections: [
      section('support', '/contact',
        ['Extra care, on us.', 'Guests requiring accessibility assistance receive 5% off our tour packages. Tell us what you need before booking so our team can confirm suitable arrangements and the applicable discount in your proposal.', 'Ask our team'],
        ['Cuidado extra, por nuestra cuenta.', 'Los viajeros que necesiten asistencia de accesibilidad reciben un 5 % de descuento en nuestros paquetes. Cuéntanos tus necesidades antes de reservar para que el equipo confirme los preparativos adecuados y el descuento aplicable en tu propuesta.', 'Consulta con nuestro equipo'],
        ['Attenzione extra, da parte nostra.', 'Gli ospiti che necessitano assistenza per l’accessibilità ricevono il 5% di sconto sui nostri pacchetti. Comunicaci le tue esigenze prima di prenotare affinché il team confermi l’organizzazione adatta e lo sconto applicabile nella proposta.', 'Chiedi al nostro team']),
      section('transport', '/contact',
        ['Vehicles and transfers', 'Describe your mobility equipment, its dimensions and whether you need help transferring into a vehicle. Adapted vehicles and assistance must be confirmed for your specific journey before booking.', 'Discuss my transfer'],
        ['Vehículos y traslados', 'Describe tu equipo de movilidad, sus dimensiones y si necesitas ayuda para entrar en un vehículo. Los vehículos adaptados y la asistencia deben confirmarse para tu viaje concreto antes de reservar.', 'Consulta mi traslado'],
        ['Veicoli e trasferimenti', 'Descrivi gli ausili per la mobilità, le dimensioni e se hai bisogno di aiuto per salire su un veicolo. Veicoli adattati e assistenza devono essere confermati per il tuo viaggio prima di prenotare.', 'Parliamo del trasferimento']),
      section('access', '/contact',
        ['Sightseeing and accommodation', 'Historic sites may have uneven ground, steps or limited access. Ask us to check entry routes, walking distances and room requirements for the places on your itinerary. Accessibility varies by site and accommodation.', 'Check my itinerary'],
        ['Visitas y alojamiento', 'Los lugares históricos pueden tener terrenos irregulares, escalones o acceso limitado. Pídenos revisar los accesos, las distancias a pie y las necesidades de habitación de tu itinerario. La accesibilidad varía según el lugar y el alojamiento.', 'Revisa mi itinerario'],
        ['Visite e alloggio', 'I siti storici possono avere terreno irregolare, gradini o accessi limitati. Chiedici di verificare percorsi d’ingresso, distanze a piedi ed esigenze della camera lungo l’itinerario. L’accessibilità varia tra siti e strutture.', 'Verifica il mio itinerario']),
      section('pace', '/make-your-trip',
        ['A journey at your pace', 'Tell us about preferred visit lengths, rest breaks and any accompanying support person. We will discuss a practical pace and confirm what can be arranged before you make a booking commitment.', 'Plan my journey'],
        ['Un viaje a tu ritmo', 'Cuéntanos la duración de visitas que prefieres, las pausas necesarias y si viajas con una persona de apoyo. Estudiaremos un ritmo práctico y confirmaremos los preparativos antes de que te comprometas a reservar.', 'Planifica mi viaje'],
        ['Un viaggio al tuo ritmo', 'Indicaci la durata preferita delle visite, le pause e l’eventuale presenza di un accompagnatore. Valuteremo un ritmo pratico e confermeremo l’organizzazione prima che tu prenda un impegno di prenotazione.', 'Pianifica il mio viaggio']),
    ],
  }
}
