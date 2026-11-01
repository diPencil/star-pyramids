import type { Tour } from '@/data/types'

// Synthetic editorial data: no prepared client tours or database snapshots.
export const translationTour = {
  slug: 'translation-fixture', title: 'Test journey', category: 'one-day-tours',
  destinationSlug: 'cairo', location: 'Cairo', duration: 'Full day', price: 100,
  status: 'draft', image: '', gallery: [], summary: 'Test description', groupSize: 'Private group', travelStyle: 'Private',
  dayDetail: {
    overview: ['English overview'], included: ['Lunch'], excluded: ['Drinks'], locations: ['Cairo'],
    translations: {
      es: { title: 'Viaje de prueba', summary: 'Descripción de prueba', overview: 'Descripción general', included: 'Almuerzo', excluded: 'Bebidas', groupSize: 'Grupo privado', travelStyle: 'Privado' },
      it: { title: 'Viaggio di prova', summary: 'Descrizione di prova', overview: 'Panoramica', included: 'Pranzo', excluded: 'Bevande', groupSize: 'Gruppo privato', travelStyle: 'Privato' },
    },
    stops: [{ day: 'Stop 1', title: 'Test stop', description: 'Test description', meals: 'Lunch', translations: {
      es: { day: 'Parada 1', title: 'Parada de prueba', description: 'Descripción', meals: 'Almuerzo' },
      it: { day: 'Tappa 1', title: 'Tappa di prova', description: 'Descrizione', meals: 'Pranzo' },
    } }],
    highlightGroups: [],
    travelerPrices: [{ travelers: 1, adultPrice: 100, childPrice: 100, infantPrice: 100 }],
    addOns: [{ title: 'Test extra', price: 5, translations: { es: { title: 'Extra de prueba' }, it: { title: 'Extra di prova' } } }],
  },
} as Tour
