export type AdminRole =
  | 'super-admin'
  | 'tours-manager'
  | 'content-editor'
  | 'support-agent'
  | 'accountant'
  | 'viewer'

export type AdminUser = {
  id: string
  name: string
  nameAr: string
  role: AdminRole
  roleLabel: string
  email: string
  avatar: string
  online?: boolean
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export type BookingRow = {
  id: string
  customer: string
  avatar: string
  tour: string
  date: string
  guests: number
  total: number
  status: BookingStatus
  channel: 'site' | 'chat' | 'whatsapp'
}

export type ChatChannel = 'live' | 'whatsapp'

export type ChatMessage = {
  id: string
  from: 'customer' | 'agent'
  text: string
  time: string
  seen?: boolean
}

export type Conversation = {
  id: string
  name: string
  avatar: string
  channel: ChatChannel
  country: string
  lastText: string
  time: string
  unread: number
  online: boolean
  tourInterest: string
  messages: ChatMessage[]
}

export const currentUser: AdminUser = {
  id: 'u-admin',
  name: 'Super Admin',
  nameAr: 'Super Admin',
  role: 'super-admin',
  roleLabel: 'Super Admin',
  email: 'admin@starpyramids.com',
  avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
  online: true,
}

export const staff: AdminUser[] = [
  currentUser,
  {
    id: 'u-tours',
    name: 'Mona Samy',
    nameAr: 'منى سامي',
    role: 'tours-manager',
    roleLabel: 'Tours Manager',
    email: 'tours@starpyramids.com',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    online: true,
  },
  {
    id: 'u-support',
    name: 'Omar Fathy',
    nameAr: 'عمر فتحي',
    role: 'support-agent',
    roleLabel: 'Support Agent',
    email: 'support@starpyramids.com',
    avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
    online: true,
  },
  {
    id: 'u-content',
    name: 'Salma Nabil',
    nameAr: 'سلمى نبيل',
    role: 'content-editor',
    roleLabel: 'Content Editor',
    email: 'content@starpyramids.com',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
  {
    id: 'u-acc',
    name: 'Hany Mahmoud',
    nameAr: 'هاني محمود',
    role: 'accountant',
    roleLabel: 'Accountant',
    email: 'accounts@starpyramids.com',
    avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
  },
]

export const dashboardStats = {
  revenue: 612917,
  revenueDelta: 2.08,
  bookings: 34760,
  bookingsDelta: 12.4,
  visitors: 14987,
  visitorsDelta: -2.09,
  soldTrips: 12987,
  soldTripsDelta: 12.1,
  totalProducts: 9829,
  productsDelta: 5.34,
}

export const bookingHabits = [
  { month: 'Jan', seen: 42, booked: 30 },
  { month: 'Feb', seen: 55, booked: 38 },
  { month: 'Mar', seen: 34, booked: 16 },
  { month: 'Apr', seen: 62, booked: 44 },
  { month: 'May', seen: 48, booked: 22 },
  { month: 'Jun', seen: 44, booked: 30 },
  { month: 'Jul', seen: 40, booked: 34 },
]

export const tourSplit = [
  { label: 'One-Day Tours', value: 2487, delta: 1.8 },
  { label: 'Multi-Days Tours', value: 1828, delta: 2.3 },
  { label: 'Nile Cruises', value: 1463, delta: -0.04 },
  { label: 'Shore Excursions', value: 1211, delta: 0.9 },
]

export type RevenuePoint = { label: string; full: string; revenue: number; payments: number }

export const revenueMonthly: RevenuePoint[] = [
  { label: 'Apr', full: 'April 2026', revenue: 48200, payments: 312 },
  { label: 'May', full: 'May 2026', revenue: 61400, payments: 401 },
  { label: 'Jun', full: 'June 2026', revenue: 55900, payments: 368 },
  { label: 'Jul', full: 'July 2026', revenue: 72300, payments: 452 },
  { label: 'Aug', full: 'August 2026', revenue: 68900, payments: 430 },
  { label: 'Sep', full: 'September 2026', revenue: 54100, payments: 345 },
]

export const revenueWeekly: RevenuePoint[] = [
  { label: 'W1', full: 'Week 1', revenue: 12800, payments: 85 },
  { label: 'W2', full: 'Week 2', revenue: 14200, payments: 95 },
  { label: 'W3', full: 'Week 3', revenue: 13500, payments: 90 },
  { label: 'W4', full: 'Week 4', revenue: 15100, payments: 101 },
  { label: 'W5', full: 'Week 5', revenue: 16300, payments: 109 },
  { label: 'W6', full: 'Week 6', revenue: 15800, payments: 105 },
  { label: 'W7', full: 'Week 7', revenue: 17400, payments: 116 },
  { label: 'W8', full: 'Week 8', revenue: 18900, payments: 126 },
  { label: 'W9', full: 'Week 9', revenue: 17600, payments: 117 },
  { label: 'W10', full: 'Week 10', revenue: 16400, payments: 109 },
  { label: 'W11', full: 'Week 11', revenue: 14900, payments: 99 },
  { label: 'W12', full: 'Week 12', revenue: 13700, payments: 91 },
]

const septemberDaily: readonly number[] = [
  1800, 2100, 1950, 2400, 2600, 2300, 1900, 1700, 2200, 2500,
  2800, 3100, 2900, 2400, 2000, 1850, 2300, 2700, 2950, 3200,
  3000, 2600, 2200, 1950, 2400, 2750, 3050, 2850, 2500, 2100,
]

export const revenueDaily: RevenuePoint[] = septemberDaily.map((revenue, i) => ({
  label: `${i + 1}`,
  full: `September ${i + 1}`,
  revenue,
  payments: Math.round(revenue / 150),
}))

export const markets = [  { country: 'United States', bookings: 2417, share: 287, flag: 'US' },
  { country: 'Germany', bookings: 812, share: 2281, flag: 'DE' },
  { country: 'United Kingdom', bookings: 694, share: 412, flag: 'GB' },
  { country: 'France', bookings: 538, share: 310, flag: 'FR' },
]

export const bookings: BookingRow[] = [
  { id: 'BK-9041', customer: 'James Carter', avatar: 'https://randomuser.me/api/portraits/men/22.jpg', tour: 'Cairo & Giza Pyramids Day Tour', date: '2026-10-02', guests: 2, total: 240, status: 'confirmed', channel: 'site' },
  { id: 'BK-9040', customer: 'Anna Schmidt', avatar: 'https://randomuser.me/api/portraits/women/12.jpg', tour: 'Luxury Nile Cruise Luxor - Aswan', date: '2026-10-11', guests: 4, total: 2890, status: 'pending', channel: 'whatsapp' },
  { id: 'BK-9039', customer: 'Pierre Dubois', avatar: 'https://randomuser.me/api/portraits/men/41.jpg', tour: 'White Desert Safari 2 Days', date: '2026-09-28', guests: 3, total: 1140, status: 'confirmed', channel: 'chat' },
  { id: 'BK-9038', customer: 'Emily Rose', avatar: 'https://randomuser.me/api/portraits/women/33.jpg', tour: 'Hurghada Red Sea Escape', date: '2026-10-05', guests: 2, total: 560, status: 'pending', channel: 'site' },
  { id: 'BK-9037', customer: 'Marco Rossi', avatar: 'https://randomuser.me/api/portraits/men/55.jpg', tour: 'Valley of the Kings Day Tour', date: '2026-09-25', guests: 5, total: 875, status: 'cancelled', channel: 'site' },
  { id: 'BK-9036', customer: 'Fatima Al-Sayed', avatar: 'https://randomuser.me/api/portraits/women/50.jpg', tour: 'Aswan & Nubian Village', date: '2026-10-08', guests: 2, total: 320, status: 'confirmed', channel: 'whatsapp' },
]

export const conversations: Conversation[] = [
  {
    id: 'c1',
    name: 'Anna Schmidt',
    avatar: 'https://randomuser.me/api/portraits/women/12.jpg',
    channel: 'whatsapp',
    country: 'Germany',
    lastText: 'هل الكروز يشمل الانتقالات من الأقصر؟',
    time: '10:24',
    unread: 2,
    online: true,
    tourInterest: 'Luxury Nile Cruise',
    messages: [
      { id: 'm1', from: 'customer', text: 'مرحبا، أريد الاستفسار عن كروز النيل في أكتوبر', time: '10:18' },
      { id: 'm2', from: 'agent', text: 'أهلا بك، متاح 4 و 5 ليال. كم عدد المسافرين؟', time: '10:20', seen: true },
      { id: 'm3', from: 'customer', text: 'نحن 4 أشخاص. هل الكروز يشمل الانتقالات من الأقصر؟', time: '10:24' },
    ],
  },
  {
    id: 'c2',
    name: 'James Carter',
    avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
    channel: 'live',
    country: 'United States',
    lastText: 'Perfect, I will confirm the Giza tour',
    time: '09:41',
    unread: 0,
    online: true,
    tourInterest: 'Cairo & Giza Pyramids',
    messages: [
      { id: 'm1', from: 'customer', text: 'Hi, is the Giza tour private?', time: '09:30' },
      { id: 'm2', from: 'agent', text: 'Yes, fully private with English guide and lunch included.', time: '09:33', seen: true },
      { id: 'm3', from: 'customer', text: 'Perfect, I will confirm the Giza tour', time: '09:41' },
    ],
  },
  {
    id: 'c3',
    name: 'Pierre Dubois',
    avatar: 'https://randomuser.me/api/portraits/men/41.jpg',
    channel: 'live',
    country: 'France',
    lastText: 'Merci, envoyez-moi le devis',
    time: 'Yesterday',
    unread: 0,
    online: false,
    tourInterest: 'White Desert Safari',
    messages: [
      { id: 'm1', from: 'customer', text: 'Bonjour, devis pour desert blanc 3 personnes ?', time: 'Yesterday' },
      { id: 'm2', from: 'agent', text: 'Bien sûr, je prépare le devis avec campement et 4x4.', time: 'Yesterday', seen: true },
      { id: 'm3', from: 'customer', text: 'Merci, envoyez-moi le devis', time: 'Yesterday' },
    ],
  },
  {
    id: 'c4',
    name: 'Fatima Al-Sayed',
    avatar: 'https://randomuser.me/api/portraits/women/50.jpg',
    channel: 'whatsapp',
    country: 'Egypt',
    lastText: 'تم، حولت العربون',
    time: 'Yesterday',
    unread: 0,
    online: false,
    tourInterest: 'Aswan & Nubian Village',
    messages: [
      { id: 'm1', from: 'customer', text: 'مساء الخير، متاح مكان يوم الجمعة؟', time: 'Yesterday' },
      { id: 'm2', from: 'agent', text: 'متاح يا فندم، الإجمالي 320 دولار لفردين.', time: 'Yesterday', seen: true },
      { id: 'm3', from: 'customer', text: 'تم، حولت العربون', time: 'Yesterday' },
    ],
  },
]

export const roleLabels: Record<AdminRole, string> = {
  'super-admin': 'Super Admin',
  'tours-manager': 'Tours Manager',
  'content-editor': 'Content Editor',
  'support-agent': 'Support Agent',
  accountant: 'Accountant',
  viewer: 'Viewer',
}

export const permissionRows = [
  { module: 'Dashboard', super: true, tours: true, content: true, support: true, accounts: true, viewer: true },
  { module: 'Bookings', super: true, tours: false, content: false, support: true, accounts: true, viewer: false },
  { module: 'Trips Builder', super: true, tours: true, content: false, support: false, accounts: false, viewer: false },
  { module: 'Events / Offers', super: true, tours: true, content: true, support: false, accounts: false, viewer: false },
  { module: 'Blogs / Destinations', super: true, tours: false, content: true, support: false, accounts: false, viewer: false },
  { module: 'Inbox (Chat / WhatsApp)', super: true, tours: false, content: false, support: true, accounts: false, viewer: false },
  { module: 'Transactions / Invoices', super: true, tours: false, content: false, support: false, accounts: true, viewer: false },
  { module: 'Settings / Email', super: true, tours: false, content: false, support: false, accounts: false, viewer: false },
  { module: 'Users & Roles', super: true, tours: false, content: false, support: false, accounts: false, viewer: false },
]
