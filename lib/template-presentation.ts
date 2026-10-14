import { siteImages } from '@/data/content'
import type { PageContent, SectionDefinition } from './page-sections'
import { ENABLED_LOCALES } from './locale-config'
import { ORIGINAL_TEMPLATE_ITEMS } from './template-items'
import { SHARED_TEMPLATE } from './shared-template'

export const TEMPLATE_CONTENT = {
  shared: SHARED_TEMPLATE,
  "about": {
    "name": "About company",
    "route": "/about",
    "sections": [
      {
        "id": "hero",
        "name": "Existing hero editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "our-story",
        "name": "our story",
        "mandatory": false,
        "copy": {
  "description0": {
    "en": "Who we are",
    "es": "Quiénes somos",
    "it": "Chi siamo"
  },
  "description1": {
    "en": "Egypt is more than a checklist.",
    "es": "Egipto es más que una lista de lugares.",
    "it": "L’Egitto è più di una lista di luoghi."
  },
  "description2": {
    "en": "At STAR PYRAMIDS, a good journey makes room for the landmarks you have dreamed of and the smaller moments that bring a place closer. That is why we offer different ways to explore Egypt, from a single day to a journey across its cities.",
    "es": "En STAR PYRAMIDS, un buen viaje deja espacio para los monumentos con los que soñaste y para los pequeños momentos que te acercan al lugar. Por eso ofrecemos distintas formas de explorar Egipto, desde un solo día hasta un viaje entre sus ciudades.",
    "it": "In STAR PYRAMIDS, un buon viaggio lascia spazio ai monumenti che hai sognato e ai piccoli momenti che ti avvicinano al luogo. Per questo offriamo diversi modi per esplorare l’Egitto, da un solo giorno a un viaggio tra le sue città."
  },
  "description3": {
    "en": "Browse the journeys and destinations, or tell us what you have in mind to start a conversation about a route that fits your time and interests.",
    "es": "Explora los viajes y destinos, o cuéntanos tu idea para empezar a diseñar una ruta a medida de tu tiempo e intereses.",
    "it": "Sfoglia viaggi e destinazioni, oppure raccontaci la tua idea per iniziare a disegnare un itinerario su misura per tempi e interessi."
  },
  "description4": {
    "en": "Talk to us",
    "es": "Habla con nosotros",
    "it": "Parla con noi"
  },
  "imageAlt": {
    "en": "The Sphinx and Pyramids of Giza",
    "es": "The Sphinx and Pyramids of Giza",
    "it": "The Sphinx and Pyramids of Giza"
  },
  "caption": {
    "en": "Giza, Egypt",
    "es": "Giza, Egypt",
    "it": "Giza, Egypt"
  }
},
        "media": {
          "media0": siteImages.pyramids
        },
        "links": {
          "links0": "/contact"
        }
      },
      {
        "id": "about-values",
        "name": "about values",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Our approach",
            "es": "Nuestro enfoque",
            "it": "Il nostro approccio"
          },
          "description1": {
            "en": "The details make the difference.",
            "es": "Los detalles marcan la diferencia.",
            "it": "I dettagli fanno la differenza."
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "about-destinations",
        "name": "about destinations",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Across Egypt",
            "es": "Por todo Egipto",
            "it": "In tutto l’Egitto"
          },
          "description1": {
            "en": "Every place has a different story.",
            "es": "Cada lugar tiene una historia distinta.",
            "it": "Ogni luogo ha una storia diversa."
          },
          "description2": {
            "en": "Follow the place that catches your eye and start your journey there.",
            "es": "Sigue el lugar que te llame la atención y empieza tu viaje allí.",
            "it": "Segui il luogo che ti colpisce e inizia il tuo viaggio da lì."
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "travel-styles",
        "name": "travel styles",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Ways to travel",
            "es": "Formas de viajar",
            "it": "Modi di viaggiare"
          },
          "description1": {
            "en": "A journey for the time you have.",
            "es": "Un viaje a medida del tiempo que tienes.",
            "it": "Un viaggio su misura per il tempo che hai."
          },
          "description2": {
            "en": "From a few hours in one city to days along the Nile, start with the format that feels right.",
            "es": "Desde unas horas en una ciudad hasta días en el Nilo: empieza por el formato que prefieras.",
            "it": "Da poche ore in una città a giorni sul Nilo: inizia dal formato che preferisci."
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "about-process",
        "name": "about process",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "From idea to itinerary",
            "es": "De la idea al itinerario",
            "it": "Dall’idea all’itinerario"
          },
          "description1": {
            "en": "Begin with a question. Go with a clear plan.",
            "es": "Empieza con una pregunta. Viaja con un plan claro.",
            "it": "Inizia con una domanda. Parti con un piano chiaro."
          },
          "description2": {
            "en": "You do not need every answer at the start. Begin with what you know, then review your options before making a decision.",
            "es": "No necesitas tener todas las respuestas al principio. Empieza por lo que sabes y revisa tus opciones antes de decidir.",
            "it": "Non serve avere tutte le risposte all’inizio. Parti da ciò che sai e valuta le opzioni prima di decidere."
          },
          "description3": {
            "en": "Start planning",
            "es": "Empieza a planificar",
            "it": "Inizia a pianificare"
          }
        },
        "media": {},
        "links": {
          "links0": "/make-your-trip"
        }
      },
      {
        "id": "about-closing",
        "name": "about closing",
        "mandatory": false,
        "copy": {
  "description0": {
    "en": "The next chapter",
    "es": "El próximo capítulo",
    "it": "Il prossimo capitolo"
  },
  "description1": {
    "en": "Your Egypt is waiting.",
    "es": "Tu Egipto te espera.",
    "it": "Il tuo Egitto ti aspetta."
  },
  "description2": {
    "en": "Choose a journey to explore or tell us the one you have in mind.",
    "es": "Elige un viaje para explorar o cuéntanos el que tienes en mente.",
    "it": "Scegli un viaggio da esplorare o raccontaci quello che hai in mente."
  },
  "ctaSeeTrips": {
    "en": "See all trips",
    "es": "Ver todos los viajes",
    "it": "Vedi tutti i viaggi"
  },
  "ctaContact": {
    "en": "Contact us",
    "es": "Contáctanos",
    "it": "Contattaci"
  }
},
        "media": {},
        "links": {
          "links0": "/trips",
          "links1": "/contact"
        }
      }
    ]
  },
  "contact": {
    "name": "Contact",
    "route": "/contact",
    "sections": [
      {
        "id": "hero",
        "name": "Existing hero editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "presentation",
        "name": "Supporting labels",
        "mandatory": true,
        "copy": {
          "description0": {
            "en": "Contact Us",
            "es": "Contáctanos",
            "it": "Contattaci"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "contact-v2-trust",
        "name": "contact v2 trust",
        "mandatory": false,
        "copy": {},
        "media": {},
        "links": {}
      },
      {
        "id": "contact-enquiry",
        "name": "contact enquiry",
        "mandatory": true,
        "copy": {
  "description0": {
    "en": "Let us plan it together",
    "es": "Planifiquémoslo juntos",
    "it": "Pianifichiamolo insieme"
  },
  "description1": {
    "en": "What kind of journey do you have in mind?",
    "es": "¿Qué tipo de viaje tienes en mente?",
    "it": "Che tipo di viaggio hai in mente?"
  },
  "description2": {
    "en": "Whether it is one day in Cairo, a complete package, a Nile cruise, or an airport transfer, send us the starting point and let our team connect the details.",
    "es": "Ya sea un día en El Cairo, un paquete completo, un crucero por el Nilo o un traslado al aeropuerto: envíanos la idea inicial y nuestro equipo unirá los detalles.",
    "it": "Che si tratti di un giorno al Cairo, di un pacchetto completo, di una crociera sul Nilo o di un trasferimento aeroportuale: inviaci l'idea di partenza e il nostro team collegherà i dettagli."
  },
  "description3": {
    "en": "Trip enquiry",
    "es": "Solicitud de viaje",
    "it": "Richiesta di viaggio"
  },
  "description4": {
    "en": "Start here.",
    "es": "Empieza aquí.",
    "it": "Inizia qui."
  },
  "description5": {
    "en": "The more you share, the more useful our first response can be.",
    "es": "Cuanto más nos cuentes, más útil será nuestra primera respuesta.",
    "it": "Più ci racconti, più utile sarà la nostra prima risposta."
  },
  "descriptionMethod0": {
    "en": "Email our travel team",
    "es": "Escribe a nuestro equipo de viajes",
    "it": "Scrivi al nostro team di viaggio"
  },
  "descriptionMethod1": {
    "en": "For itineraries and general questions",
    "es": "Para itinerarios y consultas generales",
    "it": "Per itinerari e domande generali"
  },
  "descriptionMethod2": {
    "en": "Call our travel team",
    "es": "Llama a nuestro equipo de viajes",
    "it": "Chiama il nostro team di viaggio"
  },
  "descriptionMethod3": {
    "en": "For direct enquiries and travel help",
    "es": "Para consultas directas y ayuda con tu viaje",
    "it": "Per richieste dirette e assistenza di viaggio"
  },
  "descriptionMethod4": {
    "en": "Chat with us on WhatsApp",
    "es": "Escríbenos por WhatsApp",
    "it": "Scrivici su WhatsApp"
  },
  "descriptionMethod5": {
    "en": "Start a direct WhatsApp conversation",
    "es": "Inicia una conversación directa por WhatsApp",
    "it": "Avvia una conversazione WhatsApp diretta"
  }
},
        "media": {},
        "links": {}
      },
      {
        "id": "contact-v2-process",
        "name": "contact v2 process",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "What happens next",
            "es": "Qué pasa después",
            "it": "Cosa succede dopo"
          },
          "description1": {
            "en": "From first message to a clear travel plan.",
            "es": "Del primer mensaje a un plan de viaje claro.",
            "it": "Dal primo messaggio a un piano di viaggio chiaro."
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "contact-v2-faq",
        "name": "contact v2 faq",
        "mandatory": false,
        "copy": {
  "description0": {
    "en": "Before you get in touch.",
    "es": "Antes de contactarnos.",
    "it": "Prima di contattarci."
  },
  "description1": {
    "en": "Quick answers to the questions that usually begin a journey.",
    "es": "Respuestas rápidas a las preguntas con las que suele empezar un viaje.",
    "it": "Risposte rapide alle domande con cui di solito inizia un viaggio."
  },
  "faqEyebrow": {
    "en": "Frequently Asked Questions",
    "es": "Preguntas frecuentes",
    "it": "Domande frequenti"
  },
  "faqCta": {
    "en": "See more",
    "es": "Ver más",
    "it": "Vedi di più"
  }
},
        "media": {},
        "links": {
          "links0": "/faq"
        }
      }
    ]
  },
  "cars": {
    "name": "Rent cars",
    "route": "/rent-car",
    "sections": [
      {
        "id": "hero",
        "name": "Existing hero editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "content",
        "name": "content",
        "mandatory": true,
        "copy": {
          "description0": {
            "en": "Our fleet",
            "es": "Nuestra flota",
            "it": "La nostra flotta"
          },
          "description1": {
            "en": "No vehicles listed right now",
            "es": "Sin vehículos disponibles ahora mismo",
            "it": "Nessun veicolo disponibile al momento"
          },
          "description2": {
            "en": "Check back later or contact us and we will help arrange your transfer.",
            "es": "Vuelve más tarde o contáctanos y te ayudaremos a organizar tu traslado.",
            "it": "Torna più tardi o contattaci: ti aiuteremo a organizzare il trasferimento."
          },
          "description3": {
            "en": "Contact us",
            "es": "Contáctanos",
            "it": "Contattaci"
          }
        },
        "media": {},
        "links": {
          "links0": "/contact"
        }
      },
      {
        "id": "fleet",
        "name": "fleet",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Our fleet",
            "es": "Nuestra flota",
            "it": "La nostra flotta"
          },
          "description1": {
            "en": "Comfort for every kind of journey",
            "es": "Comodidad para cada tipo de viaje",
            "it": "Comfort per ogni tipo di viaggio"
          },
          "description2": {
            "en": "Need a custom vehicle?",
            "es": "¿Necesitas un vehículo a medida?",
            "it": "Serve un veicolo su misura?"
          }
        },
        "media": {},
        "links": {
          "links0": "/rent-car/request"
        }
      }
    ]
  },
  "destinations": {
    "name": "Destinations",
    "route": "/destinations",
    "sections": [
      {
        "id": "hero",
        "name": "Existing hero editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "presentation",
        "name": "Supporting labels",
        "mandatory": true,
        "copy": {
          "description0": {
            "en": "Discover Egypt",
            "es": "Descubre Egipto",
            "it": "Scopri l'Egitto"
          },
          "description1": {
            "en": "Explore destination",
            "es": "Descubre el destino",
            "it": "Scopri la destinazione"
          }
        },
        "media": {},
        "links": {}
      }
    ]
  },
  "blogs": {
    "name": "Blogs",
    "route": "/blogs",
    "sections": [
      {
        "id": "hero",
        "name": "Existing hero editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "blog-stories",
        "name": "blog stories",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Editor's pick",
            "es": "Selección del editor",
            "it": "Scelta del redattore"
          },
          "description1": {
            "en": "Featured story",
            "es": "Historia destacada",
            "it": "Storia in evidenza"
          },
          "description2": {
            "en": "Read the full story",
            "es": "Lee la historia completa",
            "it": "Leggi la storia completa"
          },
          "description3": {
            "en": "From the travel journal",
            "es": "De nuestro diario de viajes",
            "it": "Dal diario di viaggio"
          },
          "description4": {
            "en": "Fresh perspectives for your next Egypt journey.",
            "es": "Nuevas perspectivas para tu próximo viaje a Egipto.",
            "it": "Nuove prospettive per il tuo prossimo viaggio in Egitto."
          }
        },
        "media": {},
        "links": {}
      }
    ]
  },
  "offers": {
    "name": "Special offers",
    "route": "/special-offers",
    "sections": [
      {
        "id": "hero",
        "name": "Existing hero editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "offers-trust",
        "name": "offers trust",
        "mandatory": false,
        "copy": {},
        "media": {},
        "links": {}
      },
      {
        "id": "current-offers",
        "name": "current offers",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Current opportunities",
            "es": "Oportunidades actuales",
            "it": "Opportunità attuali"
          },
          "description1": {
            "en": "Choose the value that fits your journey.",
            "es": "Elige el valor que encaje con tu viaje.",
            "it": "Scegli il valore adatto al tuo viaggio."
          },
          "description2": {
            "en": "Every offer can be shaped around your dates, group, and preferred pace. Ask our team for the exact inclusions before you commit.",
            "es": "Cada oferta puede adaptarse a tus fechas, tu grupo y tu ritmo. Pregunta a nuestro equipo por las inclusiones exactas antes de decidirte.",
            "it": "Ogni offerta può essere modellata su date, gruppo e ritmo. Chiedi al nostro team le inclusioni esatte prima di impegnarti."
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "offers-process",
        "name": "offers process",
        "mandatory": false,
        "copy": {"description0": {
            "en": "Simple and personal",
            "es": "Sencillo y personal",
            "it": "Semplice e personale"
          },"description1": {
            "en": "From offer to confirmed journey.",
            "es": "De la oferta al viaje confirmado.",
            "it": "Dall'offerta al viaggio confermato."
          }},
        "media": {},
        "links": {}
      },
      {
        "id": "offers-final",
        "name": "offers final",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "A Nile journey through Egypt",
            "es": "Un viaje por el Nilo en Egipto",
            "it": "Un viaggio sul Nilo in Egitto"
          },
          "description1": {
            "en": "Need a different kind of value?",
            "es": "¿Buscas otro tipo de valor?",
            "it": "Cerchi un altro tipo di valore?"
          },
          "description2": {
            "en": "Let us shape an offer around your Egypt plans.",
            "es": "Diseñemos una oferta en torno a tus planes en Egipto.",
            "it": "Creiamo un'offerta intorno ai tuoi piani in Egitto."
          },
          "description3": {
            "en": "Tell us your dates, group size, and wish list. Our travel designers will recommend the best available route and inclusions.",
            "es": "Cuéntanos tus fechas, el tamaño del grupo y tu lista de deseos. Nuestros diseñadores de viajes te recomendarán la mejor ruta y las mejores inclusiones disponibles.",
            "it": "Dicci date, numero di partecipanti e desideri: i nostri travel designer consiglieranno il miglior itinerario e le migliori inclusioni disponibili."
          },
          "description4": {
            "en": "Make your trip",
            "es": "Crea tu viaje",
            "it": "Crea il tuo viaggio"
          }
        },
        "media": {
          "media0": siteImages.nile
        },
        "links": {
          "links0": "/make-your-trip"
        }
      }
    ]
  },
  "destination-detail": {
    "name": "Destination template",
    "route": "/destinations/[slug]",
    "sections": [
      {
        "id": "hero",
        "name": "Original record content editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "destination-story",
        "name": "destination story",
        "mandatory": false,
        "copy": {
  "description0": {
    "en": "The destination story",
    "es": "La historia del destino",
    "it": "La storia della destinazione"
  },
  "description1": {
    "en": "Come for the icons. Stay for the rhythm.",
    "es": "Ven por los iconos. Quédate por el ritmo.",
    "it": "Vieni per le icone. Resta per il ritmo."
  },
  "description2": {
    "en": "We shape each day around proximity, light, energy, and the moments that deserve more than a quick stop.",
    "es": "Diseñamos cada día en torno a la cercanía, la luz, la energía y los momentos que merecen más que una parada rápida.",
    "it": "Modelliamo ogni giornata su vicinanza, luce, energia e momenti che meritano più di una sosta veloce."
  },
  "description3": {
    "en": "Especially good for",
    "es": "Ideal para",
    "it": "Ideale per"
  },
  "planDestination": {
    "en": "Plan this destination",
    "es": "Planifica este destino",
    "it": "Pianifica questa destinazione"
  },
  "seeDestination": {
    "en": "See what awaits",
    "es": "Descubre lo que te espera",
    "it": "Scopri cosa ti aspetta"
  }
},
        "media": {},
        "links": {}
      },
      {
        "id": "destination-experiences",
        "name": "destination experiences",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Signature experiences",
            "es": "Experiencias emblemáticas",
            "it": "Esperienze imperdibili"
          },
          "description1": {
            "en": "The moments that define",
            "es": "Los momentos que definen",
            "it": "I momenti che definiscono"
          },
          "description2": {
            "en": "Not a checklist. A considered mix of landmarks, local texture, and enough space to actually feel the place.",
            "es": "No es una lista de tareas: es una mezcla cuidada de monumentos, ambiente local y espacio suficiente para sentir de verdad el lugar.",
            "it": "Non una lista di cose da spuntare, ma un mix studiato di monumenti, atmosfera locale e spazio per vivere davvero il luogo."
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "destination-rhythm",
        "name": "destination rhythm",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Suggested rhythm",
            "es": "Ritmo sugerido",
            "it": "Ritmo suggerito"
          },
          "description1": {
            "en": "A route that breathes",
            "es": "Una ruta que respira",
            "it": "Un itinerario che respira"
          },
          "description2": {
            "en": "How to experience",
            "es": "Cómo vivir",
            "it": "Come vivere"
          },
          "description3": {
            "en": "without rushing it.",
            "es": "sin prisas.",
            "it": "senza fretta."
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "destination-practical",
        "name": "destination practical",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Travel well",
            "es": "Viaja bien",
            "it": "Viaggia bene"
          },
          "description1": {
            "en": "Small choices. Better days.",
            "es": "Pequeñas decisiones. Días mejores.",
            "it": "Piccole scelte. Giorni migliori."
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "destination-related",
        "name": "destination related",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Travel with us",
            "es": "Viaja con nosotros",
            "it": "Viaggia con noi"
          },
          "description1": {
            "en": "Ways to experience",
            "es": "Formas de vivir",
            "it": "Modi per vivere"
          },
          "description2": {
            "en": "View all tours",
            "es": "Ver todas las excursiones",
            "it": "Vedi tutti i tour"
          }
        },
        "media": {},
        "links": {
          "links0": "/egypt-tours/one-day-tours"
        }
      },
      {
        "id": "destination-plan-cta",
        "name": "destination plan cta",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Your Egypt, thoughtfully arranged",
            "es": "Tu Egipto, organizado con esmero",
            "it": "Il tuo Egitto, organizzato con cura"
          },
          "description1": {
            "en": "Make",
            "es": "Haz de",
            "it": "Fai di"
          },
          "description2": {
            "en": "part of a journey built around you.",
            "es": "parte de un viaje creado a tu medida.",
            "it": "parte di un viaggio costruito intorno a te."
          },
          "description3": {
            "en": "Share your dates, pace, and interests. Our local team will connect the details into one smooth itinerary.",
            "es": "Comparte tus fechas, tu ritmo y tus intereses. Nuestro equipo local unirá los detalles en un itinerario fluido.",
            "it": "Condividi date, ritmo e interessi: il nostro team locale collegherà i dettagli in un itinerario fluido."
          },
          "description4": {
            "en": "Build my trip",
            "es": "Crea mi viaje",
            "it": "Crea il mio viaggio"
          }
        },
        "media": {},
        "links": {
          "links0": "/make-your-trip"
        }
      }
    ]
  },
  "blog-detail": {
    "name": "Blog template",
    "route": "/blogs/[slug]",
    "sections": [
      {
        "id": "hero",
        "name": "Original record content editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "presentation",
        "name": "Supporting labels",
        "mandatory": true,
        "copy": {
          "description0": {
            "en": "Home",
            "es": "Inicio",
            "it": "Home"
          },
          "description1": {
            "en": "Blogs",
            "es": "Blog",
            "it": "Blog"
          },
          "description2": {
            "en": "In this guide",
            "es": "En esta guía",
            "it": "In questa guida"
          },
          "description3": {
            "en": "View the tour",
            "es": "Ver la excursión",
            "it": "Vedi il tour"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "guide-checklist",
        "name": "guide checklist",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Before you go",
            "es": "Antes de viajar",
            "it": "Prima di partire"
          },
          "description1": {
            "en": "Your trip, simplified",
            "es": "Tu viaje, simplificado",
            "it": "Il tuo viaggio, semplificato"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "guide-related",
        "name": "guide related",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Keep exploring",
            "es": "Sigue explorando",
            "it": "Continua a esplorare"
          },
          "description1": {
            "en": "More stories from Egypt",
            "es": "Más historias de Egipto",
            "it": "Altre storie dall'Egitto"
          },
          "description2": {
            "en": "All travel stories",
            "es": "Todas las historias de viaje",
            "it": "Tutte le storie di viaggio"
          }
        },
        "media": {},
        "links": {
          "links0": "/blogs"
        }
      },
      {
        "id": "guide-cta",
        "name": "guide cta",
        "mandatory": false,
        "copy": {},
        "media": {},
        "links": {
          "links0": "/make-your-trip"
        }
      }
    ]
  },
  "event-detail": {
    "name": "Event template",
    "route": "/events/[slug]",
    "sections": [
      {
        "id": "hero",
        "name": "Original record content editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "presentation",
        "name": "Supporting labels",
        "mandatory": true,
        "copy": {
          "description0": {
            "en": "This event is currently hidden",
            "es": "Este evento está oculto ahora mismo",
            "it": "Questo evento è attualmente nascosto"
          },
          "description1": {
            "en": "Browse the other published events.",
            "es": "Descubre los otros eventos publicados.",
            "it": "Scopri gli altri eventi pubblicati."
          },
          "description2": {
            "en": "See all events",
            "es": "Ver todos los eventos",
            "it": "Vedi tutti gli eventi"
          },
          "description3": {
            "en": "Events",
            "es": "Eventos",
            "it": "Eventi"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "event-about",
        "name": "event about",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "About this event",
            "es": "Sobre este evento",
            "it": "Su questo evento"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "event-experience",
        "name": "event experience",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Why this journey works",
            "es": "Por qué funciona este viaje",
            "it": "Perché questo viaggio funziona"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "event-program",
        "name": "event program",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Event program",
            "es": "Programa del evento",
            "it": "Programma dell'evento"
          },
          "description1": {
            "en": "Day by day",
            "es": "Día a día",
            "it": "Giorno per giorno"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "event-addons-wrap",
        "name": "event addons wrap",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Optional add-ons",
            "es": "Extras opcionales",
            "it": "Extra facoltativi"
          },
          "description1": {
            "en": "Enhance your experience",
            "es": "Mejora tu experiencia",
            "it": "Arricchisci la tua esperienza"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "event-related",
        "name": "event related",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "More events",
            "es": "Más eventos",
            "it": "Altri eventi"
          },
          "description1": {
            "en": "View all",
            "es": "Ver todo",
            "it": "Vedi tutto"
          }
        },
        "media": {},
        "links": {
          "links0": "/events"
        }
      }
    ]
  },
  "campaign-detail": {
    "name": "Campaign template",
    "route": "/special-offers/[slug]",
    "sections": [
      {
        "id": "hero",
        "name": "Original record content editor",
        "mandatory": true,
        "copy": {},
        "links": {},
        "media": {}
      },
      {
        "id": "presentation",
        "name": "Supporting labels",
        "mandatory": true,
        "copy": {
  "description0": {
    "en": "Loading offer…",
    "es": "Cargando oferta…",
    "it": "Caricamento offerta…"
  },
  "description1": {
    "en": "Offer unavailable",
    "es": "Oferta no disponible",
    "it": "Offerta non disponibile"
  },
  "kicker": {
    "en": "Curated Egypt offer",
    "es": "Oferta seleccionada de Egipto",
    "it": "Offerta selezionata per l’Egitto"
  }
},
        "media": {},
        "links": {}
      },
      {
        "id": "campaign-story",
        "name": "campaign story",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "The offer",
            "es": "La oferta",
            "it": "L’offerta"
          },
          "description1": {
            "en": "More value, shaped around your Egypt journey.",
            "es": "Más valor, diseñado para tu viaje por Egipto.",
            "it": "Più valore, pensato per il tuo viaggio in Egitto."
          }
        },
        "media": {},
        "links": {
          "links0": "/special-offers"
        }
      },
      {
        "id": "campaign-benefits-section",
        "name": "campaign benefits section",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Included value",
            "es": "Valor incluido",
            "it": "Valore incluso"
          },
          "description1": {
            "en": "Built into this offer",
            "es": "Incluido en esta oferta",
            "it": "Incluso in questa offerta"
          }
        },
        "media": {},
        "links": {}
      },
      {
        "id": "campaign-gallery-section",
        "name": "campaign gallery section",
        "mandatory": false,
        "copy": {
          "description0": {
            "en": "Picture the journey",
            "es": "Imagina el viaje",
            "it": "Immagina il viaggio"
          },
          "description1": {
            "en": "A closer look at the experience",
            "es": "Una mirada más cercana a la experiencia",
            "it": "Uno sguardo più vicino all’esperienza"
          }
        },
        "media": {},
        "links": {}
      }
    ]
  }
} as const

export type TemplatePageId = keyof typeof TEMPLATE_CONTENT
export function isTemplatePageId(id: string): id is TemplatePageId { return Object.hasOwn(TEMPLATE_CONTENT, id) }
export const TEMPLATE_PAGES = Object.fromEntries(Object.entries(TEMPLATE_CONTENT).map(([id, page]) => [id, { name: page.name, route: page.route }])) as { [K in TemplatePageId]: { name: string; route: string } }
export function templateSections(id: TemplatePageId): readonly SectionDefinition[] {
  return TEMPLATE_CONTENT[id].sections.map((section) => ({
    id: section.id, name: section.name, mandatory: section.mandatory,
    fields: Object.keys(section.copy), fieldLabels: Object.fromEntries(Object.entries(section.copy).map(([key, value]) => [key, (value as { en: string }).en])),
    mediaFields: Object.keys(section.media), linkFields: Object.keys(section.links),
    ...(ORIGINAL_TEMPLATE_ITEMS[id]?.[section.id] ? { itemFields: Object.keys(ORIGINAL_TEMPLATE_ITEMS[id][section.id][0].text.en), minItems: 0, maxItems: 12, icons: !!ORIGINAL_TEMPLATE_ITEMS[id][section.id][0].icon, itemHref: !!ORIGINAL_TEMPLATE_ITEMS[id][section.id][0].href, itemImage: !!ORIGINAL_TEMPLATE_ITEMS[id][section.id][0].image } : {}),
    ...(section.id === 'hero' ? { editor: id === 'shared' ? '/admin/settings' : id.includes('detail') ? ({ 'blog-detail': '/admin/blogs', 'destination-detail': '/admin/destinations', 'event-detail': '/admin/events', 'campaign-detail': '/admin/offers' } as Record<string, string>)[id] : '/admin/website-cms/hero-sections/' + id } : {}),
  }))
}
export function originalTemplateContent(id: TemplatePageId): PageContent {
  const translated = (factory: (locale: typeof ENABLED_LOCALES[number]) => Record<string, string>) => Object.fromEntries(ENABLED_LOCALES.map(locale => [locale, factory(locale)])) as PageContent['sections'][number]['text']
  return { sections: TEMPLATE_CONTENT[id].sections.map((section) => ({
    id: section.id, visible: true,
    ...(ORIGINAL_TEMPLATE_ITEMS[id]?.[section.id] ? { items: structuredClone(ORIGINAL_TEMPLATE_ITEMS[id][section.id]) } : {}),
    text: translated(locale => Object.fromEntries(Object.entries(section.copy).map(([key, value]) => [key, (value as Record<string, string>)[locale]]))),
    ...(Object.keys(section.media).length ? { media: { ...section.media } } : {}),
    ...(Object.keys(section.links).length ? { links: { ...section.links } } : {}),
  })), seo: { text: translated(() => ({ title: '', description: '' })) as PageContent['seo']['text'], image: '' } }
}
