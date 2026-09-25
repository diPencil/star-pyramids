export function localizeTourDuration(duration: string) {
  return duration.replace(/About /i, 'حوالي ')
    .replace(/(\d+)\s*Nights?/i, '$1 ليالٍ')
    .replace(/(\d+)\s*Days?/i, '$1 أيام')
    .replace(/(\d+)\s*Hours?/i, '$1 ساعات')
    .replace(/Full Day/i, 'يوم كامل')
    .replace(/Duration on request/i, 'المدة حسب الطلب')
}

const places: Record<string, string> = {
  Cairo: 'القاهرة', Giza: 'الجيزة', Luxor: 'الأقصر', Aswan: 'أسوان',
  Alexandria: 'الإسكندرية', Hurghada: 'الغردقة', 'Sharm El Sheikh': 'شرم الشيخ',
  'Port Said': 'بورسعيد', 'White Desert': 'الصحراء البيضاء',
  Safaga: 'سفاجا', 'Ain Sokhna': 'العين السخنة',
  'Nile Valley': 'وادي النيل', 'Red Sea': 'البحر الأحمر',
  Edfu: 'إدفو', 'Kom Ombo': 'كوم أمبو', Dendera: 'دندرة',
}

export function localizeTourLocation(location: string) {
  return location.split(',').map((place) => places[place.trim()] ?? place.trim()).join('، ')
}

export function formatTourDateRange(startDate: string | undefined, endDate: string | undefined, locale: 'en' | 'ar') {
  const format = (value: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
  if (startDate && endDate) return `${format(startDate)} - ${format(endDate)}`
  if (startDate) return format(startDate)
  if (endDate) return format(endDate)
  return ''
}
