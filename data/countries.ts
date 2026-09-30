export type CountryOption = {
  code: string
  name: string
  /** Arabic display name. Every canonical entry carries one. */
  nameAr: string
  dialCode: string
}

export const countries: CountryOption[] = [
  { code: 'AF', name: 'Afghanistan', nameAr: 'أفغانستان', dialCode: '+93' },
  { code: 'AL', name: 'Albania', nameAr: 'ألبانيا', dialCode: '+355' },
  { code: 'DZ', name: 'Algeria', nameAr: 'الجزائر', dialCode: '+213' },
  { code: 'AD', name: 'Andorra', nameAr: 'أندورا', dialCode: '+376' },
  { code: 'AO', name: 'Angola', nameAr: 'أنغولا', dialCode: '+244' },
  { code: 'AG', name: 'Antigua and Barbuda', nameAr: 'أنتيغوا وباربودا', dialCode: '+1268' },
  { code: 'AR', name: 'Argentina', nameAr: 'الأرجنتين', dialCode: '+54' },
  { code: 'AM', name: 'Armenia', nameAr: 'أرمينيا', dialCode: '+374' },
  { code: 'AU', name: 'Australia', nameAr: 'أستراليا', dialCode: '+61' },
  { code: 'AT', name: 'Austria', nameAr: 'النمسا', dialCode: '+43' },
  { code: 'AZ', name: 'Azerbaijan', nameAr: 'أذربيجان', dialCode: '+994' },
  { code: 'BS', name: 'Bahamas', nameAr: 'جزر البهاما', dialCode: '+1242' },
  { code: 'BH', name: 'Bahrain', nameAr: 'البحرين', dialCode: '+973' },
  { code: 'BD', name: 'Bangladesh', nameAr: 'بنغلاديش', dialCode: '+880' },
  { code: 'BB', name: 'Barbados', nameAr: 'باربادوس', dialCode: '+1246' },
  { code: 'BY', name: 'Belarus', nameAr: 'بيلاروسيا', dialCode: '+375' },
  { code: 'BE', name: 'Belgium', nameAr: 'بلجيكا', dialCode: '+32' },
  { code: 'BZ', name: 'Belize', nameAr: 'بليز', dialCode: '+501' },
  { code: 'BJ', name: 'Benin', nameAr: 'بنين', dialCode: '+229' },
  { code: 'BT', name: 'Bhutan', nameAr: 'بوتان', dialCode: '+975' },
  { code: 'BO', name: 'Bolivia', nameAr: 'بوليفيا', dialCode: '+591' },
  { code: 'BA', name: 'Bosnia and Herzegovina', nameAr: 'البوسنة والهرسك', dialCode: '+387' },
  { code: 'BW', name: 'Botswana', nameAr: 'بوتسوانا', dialCode: '+267' },
  { code: 'BR', name: 'Brazil', nameAr: 'البرازيل', dialCode: '+55' },
  { code: 'BN', name: 'Brunei', nameAr: 'بروناي', dialCode: '+673' },
  { code: 'BG', name: 'Bulgaria', nameAr: 'بلغاريا', dialCode: '+359' },
  { code: 'BF', name: 'Burkina Faso', nameAr: 'بوركينا فاسو', dialCode: '+226' },
  { code: 'BI', name: 'Burundi', nameAr: 'بوروندي', dialCode: '+257' },
  { code: 'CV', name: 'Cabo Verde', nameAr: 'الرأس الأخضر', dialCode: '+238' },
  { code: 'KH', name: 'Cambodia', nameAr: 'كمبوديا', dialCode: '+855' },
  { code: 'CM', name: 'Cameroon', nameAr: 'الكاميرون', dialCode: '+237' },
  { code: 'CA', name: 'Canada', nameAr: 'كندا', dialCode: '+1' },
  { code: 'CF', name: 'Central African Republic', nameAr: 'جمهورية أفريقيا الوسطى', dialCode: '+236' },
  { code: 'TD', name: 'Chad', nameAr: 'تشاد', dialCode: '+235' },
  { code: 'CL', name: 'Chile', nameAr: 'تشيلي', dialCode: '+56' },
  { code: 'CN', name: 'China', nameAr: 'الصين', dialCode: '+86' },
  { code: 'CO', name: 'Colombia', nameAr: 'كولومبيا', dialCode: '+57' },
  { code: 'KM', name: 'Comoros', nameAr: 'جزر القمر', dialCode: '+269' },
  { code: 'CG', name: 'Congo', nameAr: 'الكونغو', dialCode: '+242' },
  { code: 'CD', name: 'Congo, Democratic Republic', nameAr: 'جمهورية الكونغو الديمقراطية', dialCode: '+243' },
  { code: 'CR', name: 'Costa Rica', nameAr: 'كوستاريكا', dialCode: '+506' },
  { code: 'CI', name: "Cote d'Ivoire", nameAr: 'ساحل العاج', dialCode: '+225' },
  { code: 'HR', name: 'Croatia', nameAr: 'كرواتيا', dialCode: '+385' },
  { code: 'CU', name: 'Cuba', nameAr: 'كوبا', dialCode: '+53' },
  { code: 'CY', name: 'Cyprus', nameAr: 'قبرص', dialCode: '+357' },
  { code: 'CZ', name: 'Czechia', nameAr: 'التشيك', dialCode: '+420' },
  { code: 'DK', name: 'Denmark', nameAr: 'الدنمارك', dialCode: '+45' },
  { code: 'DJ', name: 'Djibouti', nameAr: 'جيبوتي', dialCode: '+253' },
  { code: 'DM', name: 'Dominica', nameAr: 'دومينيكا', dialCode: '+1767' },
  { code: 'DO', name: 'Dominican Republic', nameAr: 'جمهورية الدومينيكان', dialCode: '+1809' },
  { code: 'EC', name: 'Ecuador', nameAr: 'الإكوادور', dialCode: '+593' },
  { code: 'EG', name: 'Egypt', nameAr: 'مصر', dialCode: '+20' },
  { code: 'SV', name: 'El Salvador', nameAr: 'السلفادور', dialCode: '+503' },
  { code: 'GQ', name: 'Equatorial Guinea', nameAr: 'غينيا الاستوائية', dialCode: '+240' },
  { code: 'ER', name: 'Eritrea', nameAr: 'إريتريا', dialCode: '+291' },
  { code: 'EE', name: 'Estonia', nameAr: 'إستونيا', dialCode: '+372' },
  { code: 'SZ', name: 'Eswatini', nameAr: 'إسواتيني', dialCode: '+268' },
  { code: 'ET', name: 'Ethiopia', nameAr: 'إثيوبيا', dialCode: '+251' },
  { code: 'FJ', name: 'Fiji', nameAr: 'فيجي', dialCode: '+679' },
  { code: 'FI', name: 'Finland', nameAr: 'فنلندا', dialCode: '+358' },
  { code: 'FR', name: 'France', nameAr: 'فرنسا', dialCode: '+33' },
  { code: 'GA', name: 'Gabon', nameAr: 'الغابون', dialCode: '+241' },
  { code: 'GM', name: 'Gambia', nameAr: 'غامبيا', dialCode: '+220' },
  { code: 'GE', name: 'Georgia', nameAr: 'جورجيا', dialCode: '+995' },
  { code: 'DE', name: 'Germany', nameAr: 'ألمانيا', dialCode: '+49' },
  { code: 'GH', name: 'Ghana', nameAr: 'غانا', dialCode: '+233' },
  { code: 'GR', name: 'Greece', nameAr: 'اليونان', dialCode: '+30' },
  { code: 'GD', name: 'Grenada', nameAr: 'غرينادا', dialCode: '+1473' },
  { code: 'GT', name: 'Guatemala', nameAr: 'غواتيمالا', dialCode: '+502' },
  { code: 'GN', name: 'Guinea', nameAr: 'غينيا', dialCode: '+224' },
  { code: 'GW', name: 'Guinea-Bissau', nameAr: 'غينيا بيساو', dialCode: '+245' },
  { code: 'GY', name: 'Guyana', nameAr: 'غيانا', dialCode: '+592' },
  { code: 'HT', name: 'Haiti', nameAr: 'هايتي', dialCode: '+509' },
  { code: 'HN', name: 'Honduras', nameAr: 'هندوراس', dialCode: '+504' },
  { code: 'HU', name: 'Hungary', nameAr: 'المجر', dialCode: '+36' },
  { code: 'IS', name: 'Iceland', nameAr: 'آيسلندا', dialCode: '+354' },
  { code: 'IN', name: 'India', nameAr: 'الهند', dialCode: '+91' },
  { code: 'ID', name: 'Indonesia', nameAr: 'إندونيسيا', dialCode: '+62' },
  { code: 'IR', name: 'Iran', nameAr: 'إيران', dialCode: '+98' },
  { code: 'IQ', name: 'Iraq', nameAr: 'العراق', dialCode: '+964' },
  { code: 'IE', name: 'Ireland', nameAr: 'أيرلندا', dialCode: '+353' },
  { code: 'IL', name: 'Israel', nameAr: 'إسرائيل', dialCode: '+972' },
  { code: 'IT', name: 'Italy', nameAr: 'إيطاليا', dialCode: '+39' },
  { code: 'JM', name: 'Jamaica', nameAr: 'جامايكا', dialCode: '+1876' },
  { code: 'JP', name: 'Japan', nameAr: 'اليابان', dialCode: '+81' },
  { code: 'JO', name: 'Jordan', nameAr: 'الأردن', dialCode: '+962' },
  { code: 'KZ', name: 'Kazakhstan', nameAr: 'كازاخستان', dialCode: '+7' },
  { code: 'KE', name: 'Kenya', nameAr: 'كينيا', dialCode: '+254' },
  { code: 'KI', name: 'Kiribati', nameAr: 'كيريباتي', dialCode: '+686' },
  { code: 'KP', name: 'Korea, North', nameAr: 'كوريا الشمالية', dialCode: '+850' },
  { code: 'KR', name: 'Korea, South', nameAr: 'كوريا الجنوبية', dialCode: '+82' },
  { code: 'XK', name: 'Kosovo', nameAr: 'كوسوفو', dialCode: '+383' },
  { code: 'KW', name: 'Kuwait', nameAr: 'الكويت', dialCode: '+965' },
  { code: 'KG', name: 'Kyrgyzstan', nameAr: 'قيرغيزستان', dialCode: '+996' },
  { code: 'LA', name: 'Laos', nameAr: 'لاوس', dialCode: '+856' },
  { code: 'LV', name: 'Latvia', nameAr: 'لاتفيا', dialCode: '+371' },
  { code: 'LB', name: 'Lebanon', nameAr: 'لبنان', dialCode: '+961' },
  { code: 'LS', name: 'Lesotho', nameAr: 'ليسوتو', dialCode: '+266' },
  { code: 'LR', name: 'Liberia', nameAr: 'ليبيريا', dialCode: '+231' },
  { code: 'LY', name: 'Libya', nameAr: 'ليبيا', dialCode: '+218' },
  { code: 'LI', name: 'Liechtenstein', nameAr: 'ليختنشتاين', dialCode: '+423' },
  { code: 'LT', name: 'Lithuania', nameAr: 'ليتوانيا', dialCode: '+370' },
  { code: 'LU', name: 'Luxembourg', nameAr: 'لوكسمبورغ', dialCode: '+352' },
  { code: 'MG', name: 'Madagascar', nameAr: 'مدغشقر', dialCode: '+261' },
  { code: 'MW', name: 'Malawi', nameAr: 'مالاوي', dialCode: '+265' },
  { code: 'MY', name: 'Malaysia', nameAr: 'ماليزيا', dialCode: '+60' },
  { code: 'MV', name: 'Maldives', nameAr: 'جزر المالديف', dialCode: '+960' },
  { code: 'ML', name: 'Mali', nameAr: 'مالي', dialCode: '+223' },
  { code: 'MT', name: 'Malta', nameAr: 'مالطا', dialCode: '+356' },
  { code: 'MH', name: 'Marshall Islands', nameAr: 'جزر مارشال', dialCode: '+692' },
  { code: 'MR', name: 'Mauritania', nameAr: 'موريتانيا', dialCode: '+222' },
  { code: 'MU', name: 'Mauritius', nameAr: 'موريشيوس', dialCode: '+230' },
  { code: 'MX', name: 'Mexico', nameAr: 'المكسيك', dialCode: '+52' },
  { code: 'FM', name: 'Micronesia', nameAr: 'ميكرونيزيا', dialCode: '+691' },
  { code: 'MD', name: 'Moldova', nameAr: 'مولدوفا', dialCode: '+373' },
  { code: 'MC', name: 'Monaco', nameAr: 'موناكو', dialCode: '+377' },
  { code: 'MN', name: 'Mongolia', nameAr: 'منغوليا', dialCode: '+976' },
  { code: 'ME', name: 'Montenegro', nameAr: 'الجبل الأسود', dialCode: '+382' },
  { code: 'MA', name: 'Morocco', nameAr: 'المغرب', dialCode: '+212' },
  { code: 'MZ', name: 'Mozambique', nameAr: 'موزمبيق', dialCode: '+258' },
  { code: 'MM', name: 'Myanmar', nameAr: 'ميانمار', dialCode: '+95' },
  { code: 'NA', name: 'Namibia', nameAr: 'ناميبيا', dialCode: '+264' },
  { code: 'NR', name: 'Nauru', nameAr: 'ناورو', dialCode: '+674' },
  { code: 'NP', name: 'Nepal', nameAr: 'نيبال', dialCode: '+977' },
  { code: 'NL', name: 'Netherlands', nameAr: 'هولندا', dialCode: '+31' },
  { code: 'NZ', name: 'New Zealand', nameAr: 'نيوزيلندا', dialCode: '+64' },
  { code: 'NI', name: 'Nicaragua', nameAr: 'نيكاراغوا', dialCode: '+505' },
  { code: 'NE', name: 'Niger', nameAr: 'النيجر', dialCode: '+227' },
  { code: 'NG', name: 'Nigeria', nameAr: 'نيجيريا', dialCode: '+234' },
  { code: 'MK', name: 'North Macedonia', nameAr: 'مقدونيا الشمالية', dialCode: '+389' },
  { code: 'NO', name: 'Norway', nameAr: 'النرويج', dialCode: '+47' },
  { code: 'OM', name: 'Oman', nameAr: 'عمان', dialCode: '+968' },
  { code: 'PK', name: 'Pakistan', nameAr: 'باكستان', dialCode: '+92' },
  { code: 'PW', name: 'Palau', nameAr: 'بالاو', dialCode: '+680' },
  { code: 'PS', name: 'Palestine', nameAr: 'فلسطين', dialCode: '+970' },
  { code: 'PA', name: 'Panama', nameAr: 'بنما', dialCode: '+507' },
  { code: 'PG', name: 'Papua New Guinea', nameAr: 'بابوا غينيا الجديدة', dialCode: '+675' },
  { code: 'PY', name: 'Paraguay', nameAr: 'باراغواي', dialCode: '+595' },
  { code: 'PE', name: 'Peru', nameAr: 'بيرو', dialCode: '+51' },
  { code: 'PH', name: 'Philippines', nameAr: 'الفلبين', dialCode: '+63' },
  { code: 'PL', name: 'Poland', nameAr: 'بولندا', dialCode: '+48' },
  { code: 'PT', name: 'Portugal', nameAr: 'البرتغال', dialCode: '+351' },
  { code: 'QA', name: 'Qatar', nameAr: 'قطر', dialCode: '+974' },
  { code: 'RO', name: 'Romania', nameAr: 'رومانيا', dialCode: '+40' },
  { code: 'RU', name: 'Russia', nameAr: 'روسيا', dialCode: '+7' },
  { code: 'RW', name: 'Rwanda', nameAr: 'رواندا', dialCode: '+250' },
  { code: 'KN', name: 'Saint Kitts and Nevis', nameAr: 'سانت كيتس ونيفيس', dialCode: '+1869' },
  { code: 'LC', name: 'Saint Lucia', nameAr: 'سانت لوسيا', dialCode: '+1758' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', nameAr: 'سانت فنسنت والغرينادين', dialCode: '+1784' },
  { code: 'WS', name: 'Samoa', nameAr: 'ساموا', dialCode: '+685' },
  { code: 'SM', name: 'San Marino', nameAr: 'سان مارينو', dialCode: '+378' },
  { code: 'ST', name: 'Sao Tome and Principe', nameAr: 'ساو تومي وبرينسيب', dialCode: '+239' },
  { code: 'SA', name: 'Saudi Arabia', nameAr: 'السعودية', dialCode: '+966' },
  { code: 'SN', name: 'Senegal', nameAr: 'السنغال', dialCode: '+221' },
  { code: 'RS', name: 'Serbia', nameAr: 'صربيا', dialCode: '+381' },
  { code: 'SC', name: 'Seychelles', nameAr: 'سيشل', dialCode: '+248' },
  { code: 'SL', name: 'Sierra Leone', nameAr: 'سيراليون', dialCode: '+232' },
  { code: 'SG', name: 'Singapore', nameAr: 'سنغافورة', dialCode: '+65' },
  { code: 'SK', name: 'Slovakia', nameAr: 'سلوفاكيا', dialCode: '+421' },
  { code: 'SI', name: 'Slovenia', nameAr: 'سلوفينيا', dialCode: '+386' },
  { code: 'SB', name: 'Solomon Islands', nameAr: 'جزر سليمان', dialCode: '+677' },
  { code: 'SO', name: 'Somalia', nameAr: 'الصومال', dialCode: '+252' },
  { code: 'ZA', name: 'South Africa', nameAr: 'جنوب أفريقيا', dialCode: '+27' },
  { code: 'SS', name: 'South Sudan', nameAr: 'جنوب السودان', dialCode: '+211' },
  { code: 'ES', name: 'Spain', nameAr: 'إسبانيا', dialCode: '+34' },
  { code: 'LK', name: 'Sri Lanka', nameAr: 'سريلانكا', dialCode: '+94' },
  { code: 'SD', name: 'Sudan', nameAr: 'السودان', dialCode: '+249' },
  { code: 'SR', name: 'Suriname', nameAr: 'سورينام', dialCode: '+597' },
  { code: 'SE', name: 'Sweden', nameAr: 'السويد', dialCode: '+46' },
  { code: 'CH', name: 'Switzerland', nameAr: 'سويسرا', dialCode: '+41' },
  { code: 'SY', name: 'Syria', nameAr: 'سوريا', dialCode: '+963' },
  { code: 'TW', name: 'Taiwan', nameAr: 'تايوان', dialCode: '+886' },
  { code: 'TJ', name: 'Tajikistan', nameAr: 'طاجيكستان', dialCode: '+992' },
  { code: 'TZ', name: 'Tanzania', nameAr: 'تنزانيا', dialCode: '+255' },
  { code: 'TH', name: 'Thailand', nameAr: 'تايلند', dialCode: '+66' },
  { code: 'TL', name: 'Timor-Leste', nameAr: 'تيمور الشرقية', dialCode: '+670' },
  { code: 'TG', name: 'Togo', nameAr: 'توغو', dialCode: '+228' },
  { code: 'TO', name: 'Tonga', nameAr: 'تونغا', dialCode: '+676' },
  { code: 'TT', name: 'Trinidad and Tobago', nameAr: 'ترينيداد وتوباغو', dialCode: '+1868' },
  { code: 'TN', name: 'Tunisia', nameAr: 'تونس', dialCode: '+216' },
  { code: 'TR', name: 'Turkey', nameAr: 'تركيا', dialCode: '+90' },
  { code: 'TM', name: 'Turkmenistan', nameAr: 'تركمانستان', dialCode: '+993' },
  { code: 'TV', name: 'Tuvalu', nameAr: 'توفالو', dialCode: '+688' },
  { code: 'UG', name: 'Uganda', nameAr: 'أوغندا', dialCode: '+256' },
  { code: 'UA', name: 'Ukraine', nameAr: 'أوكرانيا', dialCode: '+380' },
  { code: 'AE', name: 'United Arab Emirates', nameAr: 'الإمارات', dialCode: '+971' },
  { code: 'GB', name: 'United Kingdom', nameAr: 'بريطانيا', dialCode: '+44' },
  { code: 'US', name: 'United States', nameAr: 'أمريكا', dialCode: '+1' },
  { code: 'UY', name: 'Uruguay', nameAr: 'أوروغواي', dialCode: '+598' },
  { code: 'UZ', name: 'Uzbekistan', nameAr: 'أوزبكستان', dialCode: '+998' },
  { code: 'VU', name: 'Vanuatu', nameAr: 'فانواتو', dialCode: '+678' },
  { code: 'VA', name: 'Vatican City', nameAr: 'الفاتيكان', dialCode: '+39' },
  { code: 'VE', name: 'Venezuela', nameAr: 'فنزويلا', dialCode: '+58' },
  { code: 'VN', name: 'Vietnam', nameAr: 'فيتنام', dialCode: '+84' },
  { code: 'YE', name: 'Yemen', nameAr: 'اليمن', dialCode: '+967' },
  { code: 'ZM', name: 'Zambia', nameAr: 'زامبيا', dialCode: '+260' },
  { code: 'ZW', name: 'Zimbabwe', nameAr: 'زيمبابوي', dialCode: '+263' },
]

export const defaultCountry = countries.find((country) => country.code === 'EG') ?? countries[0]

export function countryFlag(code: string) {
  return code.toUpperCase().replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
}

const preferredSharedDialCodes: Record<string, string> = {
  '+1': 'US',
  '+7': 'RU',
  '+39': 'IT',
}

export function countryByCode(code: string | undefined) {
  return countries.find((country) => country.code === code) ?? defaultCountry
}

export function countryByName(name: string | undefined) {
  const needle = (name ?? '').trim().toLowerCase()
  if (!needle) return undefined
  return countries.find((country) => country.name.toLowerCase() === needle)
    ?? countries.find((country) => country.nameAr === (name ?? '').trim())
}

/**
 * Canonical country resolver. Understands ISO codes (`EG`, `eg`),
 * English names (`Egypt`) and Arabic names, case-insensitively.
 * Returns null for unknown values so callers fall back explicitly.
 */
export function resolveCountry(input: string | undefined): CountryOption | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const byCode = countries.find((country) => country.code === raw.toUpperCase())
    if (byCode) return byCode
  }
  return countryByName(raw) ?? null
}

/** Canonical machine value (ISO alpha-2) for a code-or-name input, or ''. */
export function countryCode(input: string | undefined): string {
  return resolveCountry(input)?.code ?? ''
}

/** Display name in the requested locale with safe fallback to the raw input. */
export function countryDisplayName(input: string | undefined, locale: import('@/lib/locale-config').Locale = 'en'): string {
  const resolved = resolveCountry(input)
  if (!resolved) return (input ?? '').trim()
  return locale === 'ar' ? resolved.nameAr : resolved.name
}

/**
 * Presentation label for nationality / country-only selectors: flag plus
 * localized name, never a phone dial code. Dial codes belong to phone
 * controls only. Unknown codes fall back to the raw input.
 */
export function countrySelectLabel(input: string | undefined, locale: import('@/lib/locale-config').Locale = 'en'): string {
  const raw = (input ?? '').trim()
  if (!raw) return ''
  const resolved = resolveCountry(raw)
  if (!resolved) return raw
  const name = locale === 'ar' ? resolved.nameAr : resolved.name
  return `${countryFlag(resolved.code)} ${name}`
}

export function countryByDialCode(dialCode: string | undefined) {
  if (!dialCode) return defaultCountry
  const preferredCode = preferredSharedDialCodes[dialCode]
  return countries.find((country) => country.code === preferredCode)
    ?? countries.find((country) => country.dialCode === dialCode)
    ?? defaultCountry
}

export function countryFromPhone(phone: string | undefined) {
  const normalized = (phone ?? '').trim().replace(/[\s()-]/g, '')
  if (!normalized.startsWith('+')) return defaultCountry
  const dialCode = Array.from(new Set(countries.map((country) => country.dialCode)))
    .sort((a, b) => b.length - a.length)
    .find((dial) => normalized.startsWith(dial))
  return countryByDialCode(dialCode)
}

export function nationalPhone(phone: string | undefined, dialCode: string) {
  const value = (phone ?? '').trim()
  return value.startsWith(dialCode) ? value.slice(dialCode.length).trimStart() : value.replace(/^\+\d{1,4}\s*/, '')
}

export function internationalPhone(dialCode: string, phone: string) {
  const local = phone.trim().replace(/^\+\d{1,4}\s*/, '')
  return local ? `${dialCode} ${local}` : ''
}
