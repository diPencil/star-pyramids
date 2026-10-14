import { siteImages } from '@/data/content'
import type { SectionItem } from './page-sections'
export const ORIGINAL_TEMPLATE_ITEMS: Record<string, Record<string, SectionItem[]>> = {
  "about": {
    "about-values": [
      {
        "id": "item-0",
        "visible": true,
        "text": {
          "en": {
            "heading": "Your kind of Egypt",
            "description": "Start with what you want to see, then leave room for the journey to breathe."
          },
          "es": {
            "heading": "Egipto a tu manera",
            "description": "Empieza por lo que quieres ver y deja espacio para que el viaje respire."
          },
          "it": {
            "heading": "Il tuo Egitto",
            "description": "Parti da ciò che vuoi vedere e lascia spazio al viaggio."
          }
        },
        "icon": "Compass"
      },
      {
        "id": "item-1",
        "visible": true,
        "text": {
          "en": {
            "heading": "Time to be there",
            "description": "Meaningful places deserve time to understand, not just a quick stop."
          },
          "es": {
            "heading": "Tiempo para estar allí",
            "description": "Los lugares especiales merecen tiempo para comprenderlos, no solo una parada rápida."
          },
          "it": {
            "heading": "Tempo per viverlo",
            "description": "I luoghi speciali meritano tempo per essere capiti, non solo una sosta veloce."
          }
        },
        "icon": "Clock3"
      },
      {
        "id": "item-2",
        "visible": true,
        "text": {
          "en": {
            "heading": "Clarity in the details",
            "description": "The route, services, and timing should be clear before you commit."
          },
          "es": {
            "heading": "Claridad en los detalles",
            "description": "La ruta, los servicios y los horarios deben estar claros antes de reservar."
          },
          "it": {
            "heading": "Chiarezza nei dettagli",
            "description": "Itinerario, servizi e orari devono essere chiari prima di prenotare."
          }
        },
        "icon": "HeartHandshake"
      }
    ],
    "travel-styles": [
      {
        "id": "item-0",
        "visible": true,
        "text": {
          "en": {
            "heading": "One-day tours",
            "description": "A focused day in Cairo, Luxor, or the place calling you most."
          },
          "es": {
            "heading": "Circuitos de un día",
            "description": "Un día completo en El Cairo, Luxor o el lugar que más te llame."
          },
          "it": {
            "heading": "Tour di un giorno",
            "description": "Una giornata intensa al Cairo, a Luxor o nel luogo che ti attira di più."
          }
        },
        "icon": "Sun",
        "href": "/egypt-tours/one-day-tours",
        "image": siteImages.cairo
      },
      {
        "id": "item-1",
        "visible": true,
        "text": {
          "en": {
            "heading": "Multi-day journeys",
            "description": "More time to connect the places and stories across Egypt."
          },
          "es": {
            "heading": "Viajes de varios días",
            "description": "Más tiempo para unir lugares e historias de todo Egipto."
          },
          "it": {
            "heading": "Viaggi di più giorni",
            "description": "Più tempo per collegare luoghi e storie di tutto l’Egitto."
          }
        },
        "icon": "Route",
        "href": "/egypt-tours/multi-days-tours",
        "image": siteImages.pyramids
      },
      {
        "id": "item-2",
        "visible": true,
        "text": {
          "en": {
            "heading": "Nile cruises",
            "description": "Follow the river through the temples and landscapes of the south."
          },
          "es": {
            "heading": "Cruceros por el Nilo",
            "description": "Sigue el río entre los templos y paisajes del sur."
          },
          "it": {
            "heading": "Crociere sul Nilo",
            "description": "Segui il fiume tra templi e paesaggi del sud."
          }
        },
        "icon": "Ship",
        "href": "/egypt-tours/nile-cruises",
        "image": siteImages.nile
      },
      {
        "id": "item-3",
        "visible": true,
        "text": {
          "en": {
            "heading": "Shore excursions",
            "description": "Make a ship call count with a route shaped around port time."
          },
          "es": {
            "heading": "Excursiones en tierra",
            "description": "Aprovecha la escala del barco con una ruta adaptada al horario del puerto."
          },
          "it": {
            "heading": "Escursioni a terra",
            "description": "Sfrutta lo scalo della nave con un itinerario pensato per i tempi del porto."
          }
        },
        "icon": "Anchor",
        "href": "/egypt-tours/shore-excursions",
        "image": siteImages.redSea
      }
    ],
    "about-process": [
      {
        "id": "item-0",
        "visible": true,
        "text": {
          "en": {
            "heading": "Tell us your plans",
            "description": "Share your dates, travel party, and the places you hope to see.",
            "step": "01"
          },
          "es": {
            "heading": "Cuéntanos tus planes",
            "description": "Comparte tus fechas, tu grupo de viaje y los lugares que quieres ver.",
            "step": "01"
          },
          "it": {
            "heading": "Raccontaci i tuoi piani",
            "description": "Condividi date, gruppo di viaggio e luoghi che vuoi vedere.",
            "step": "01"
          }
        }
      },
      {
        "id": "item-1",
        "visible": true,
        "text": {
          "en": {
            "heading": "Find your rhythm",
            "description": "Compare a listed journey with a tailored request and choose what matters.",
            "step": "02"
          },
          "es": {
            "heading": "Encuentra tu ritmo",
            "description": "Compara un viaje del catálogo con una propuesta a medida y elige lo que importa.",
            "step": "02"
          },
          "it": {
            "heading": "Trova il tuo ritmo",
            "description": "Confronta un viaggio a catalogo con una proposta su misura e scegli ciò che conta.",
            "step": "02"
          }
        }
      },
      {
        "id": "item-2",
        "visible": true,
        "text": {
          "en": {
            "heading": "Confirm the details",
            "description": "Review the itinerary, price, inclusions, and timing with the team before booking.",
            "step": "03"
          },
          "es": {
            "heading": "Confirma los detalles",
            "description": "Revisa el itinerario, el precio, las inclusiones y los horarios con el equipo antes de reservar.",
            "step": "03"
          },
          "it": {
            "heading": "Conferma i dettagli",
            "description": "Verifica itinerario, prezzo, inclusioni e orari con il team prima di prenotare.",
            "step": "03"
          }
        }
      }
    ]
  },
  "contact": {
    "contact-v2-process": [
      {
        "id": "item-0",
        "visible": true,
        "text": {
          "en": {
            "heading": "Tell us about your trip",
            "description": "Share your dates, group size, and the places you want to experience.",
            "step": "01"
          },
          "es": {
            "heading": "Cuéntanos tu viaje",
            "description": "Comparte tus fechas, el tamaño del grupo y los lugares que quieres conocer.",
            "step": "01"
          },
          "it": {
            "heading": "Raccontaci il tuo viaggio",
            "description": "Condividi date, numero di partecipanti e luoghi che vuoi scoprire.",
            "step": "01"
          }
        }
      },
      {
        "id": "item-1",
        "visible": true,
        "text": {
          "en": {
            "heading": "We shape the details",
            "description": "Our local team reviews your idea and connects the right route and experiences.",
            "step": "02"
          },
          "es": {
            "heading": "Damos forma a los detalles",
            "description": "Nuestro equipo local revisa tu idea y une la ruta y las experiencias adecuadas.",
            "step": "02"
          },
          "it": {
            "heading": "Diamo forma ai dettagli",
            "description": "Il nostro team locale esamina la tua idea e collega itinerario ed esperienze giusti.",
            "step": "02"
          }
        }
      },
      {
        "id": "item-2",
        "visible": true,
        "text": {
          "en": {
            "heading": "Receive a clear proposal",
            "description": "We return with an easy-to-review plan before you make any commitment.",
            "step": "03"
          },
          "es": {
            "heading": "Recibe una propuesta clara",
            "description": "Te devolvemos un plan fácil de revisar antes de ningún compromiso.",
            "step": "03"
          },
          "it": {
            "heading": "Ricevi una proposta chiara",
            "description": "Ti presentiamo un piano facile da rivedere prima di qualsiasi impegno.",
            "step": "03"
          }
        }
      }
    ],
    "contact-v2-trust": [
      {
        "id": "item-0",
        "visible": true,
        "text": {
          "en": {
            "heading": "Egypt-based local insight"
          },
          "es": {
            "heading": "Conocimiento local desde Egipto"
          },
          "it": {
            "heading": "Conoscenza locale dall'Egitto"
          }
        },
        "icon": "MapPin"
      },
      {
        "id": "item-1",
        "visible": true,
        "text": {
          "en": {
            "heading": "Planning around your time"
          },
          "es": {
            "heading": "Planificación a tu medida"
          },
          "it": {
            "heading": "Pianificazione sui tuoi tempi"
          }
        },
        "icon": "Clock3"
      },
      {
        "id": "item-2",
        "visible": true,
        "text": {
          "en": {
            "heading": "Clear details before booking"
          },
          "es": {
            "heading": "Detalles claros antes de reservar"
          },
          "it": {
            "heading": "Dettagli chiari prima di prenotare"
          }
        },
        "icon": "ShieldCheck"
      }
    ]
  },
  "offers": {
    "offers-trust": [
      {
        "id": "item-0",
        "visible": true,
        "text": {
          "en": {
            "heading": "Built around your dates",
            "description": "We match each offer to your travel window."
          },
          "es": {
            "heading": "Creadas en torno a tus fechas",
            "description": "Adaptamos cada oferta a tus fechas de viaje."
          },
          "it": {
            "heading": "Costruite intorno alle tue date",
            "description": "Adattiamo ogni offerta alle tue date di viaggio."
          }
        },
        "icon": "CalendarCheck"
      },
      {
        "id": "item-1",
        "visible": true,
        "text": {
          "en": {
            "heading": "Meaningful extras",
            "description": "Added value that improves the actual journey."
          },
          "es": {
            "heading": "Extras con sentido",
            "description": "Valor añadido que mejora el viaje de verdad."
          },
          "it": {
            "heading": "Extra significativi",
            "description": "Valore aggiunto che migliora davvero il viaggio."
          }
        },
        "icon": "Gift"
      },
      {
        "id": "item-2",
        "visible": true,
        "text": {
          "en": {
            "heading": "Local support",
            "description": "A real Egypt-based team from enquiry to arrival."
          },
          "es": {
            "heading": "Apoyo local",
            "description": "Un equipo real en Egipto, desde la consulta hasta la llegada."
          },
          "it": {
            "heading": "Supporto locale",
            "description": "Un vero team in Egitto, dalla richiesta."
          }
        },
        "icon": "Headphones"
      }
    ],
    "offers-process": [
      {
        "id": "item-0",
        "visible": true,
        "text": {
          "en": {
            "heading": "Choose your offer",
            "description": "Pick the value or travel style that feels right for your trip.",
            "step": "01"
          },
          "es": {
            "heading": "Elige tu oferta",
            "description": "Elige el valor o el estilo de viaje que encaje con tu viaje.",
            "step": "01"
          },
          "it": {
            "heading": "Scegli la tua offerta",
            "description": "Scegli il valore o lo stile di viaggio giusto per il tuo viaggio.",
            "step": "01"
          }
        }
      },
      {
        "id": "item-1",
        "visible": true,
        "text": {
          "en": {
            "heading": "Share your dates",
            "description": "Tell us who is traveling and the experience you have in mind.",
            "step": "02"
          },
          "es": {
            "heading": "Comparte tus fechas",
            "description": "Cuéntanos quién viaja y la experiencia que imaginas.",
            "step": "02"
          },
          "it": {
            "heading": "Condividi le tue date",
            "description": "Dicci chi viaggia e l'esperienza che immagini.",
            "step": "02"
          }
        }
      },
      {
        "id": "item-2",
        "visible": true,
        "text": {
          "en": {
            "heading": "Confirm the details",
            "description": "We verify availability and send the exact itinerary and inclusions.",
            "step": "03"
          },
          "es": {
            "heading": "Confirma los detalles",
            "description": "Verificamos la disponibilidad y te enviamos el itinerario exacto y las inclusiones.",
            "step": "03"
          },
          "it": {
            "heading": "Conferma i dettagli",
            "description": "Verifichiamo la disponibilità e ti inviamo itinerario esatto e inclusioni.",
            "step": "03"
          }
        }
      }
    ]
  }
}
