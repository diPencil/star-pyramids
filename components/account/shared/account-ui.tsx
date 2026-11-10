'use client'

// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, MessageCircle, Plus, ReceiptText, Star, UserRound } from "lucide-react";
import { tx, useLocale } from "@/components/locale";
import { useBrandSettings } from "@/lib/admin-store";
import { whatsappHref } from "@/data/company";
import { SharedSelect } from "@/components/shared/forms/shared-select";
import { WhatsAppGlyph } from "@/components/support/whatsapp-chat";


function CustomerAvatar({ avatar, initials, className, name }: { avatar: string; initials: string; className: string; name: string }) {
  return <span className={className}>{initials}{avatar && <img src={avatar} alt={name} onError={(event) => { if (!event.currentTarget.src.endsWith('/placeholder-user.jpg')) event.currentTarget.src = '/placeholder-user.jpg'; else event.currentTarget.remove() }} />}</span>
}

function Metric({ Icon, value, label, note, tone }: { Icon: typeof Star; value: string | number; label: string; note: string; tone: string }) {
  return <div className={`customer-metric ${tone}`}><span><Icon size={19} /></span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></div>
}

function SupportPanel() {
  const { locale } = useLocale()

  const brand = useBrandSettings()
  return <aside className="customer-account-block customer-support-panel"><header><div><span>{tx(locale, { en: 'Trip support', es: 'Asistencia de viaje', it: 'Assistenza viaggio', ar: 'مساعدة الرحلة' })}</span><h2>{tx(locale, { en: 'Your team is close by', es: 'Tu equipo está cerca', it: 'Il tuo team è con te', ar: 'فريقنا قريب منك' })}</h2></div><span className="customer-online"><i />{tx(locale, { en: 'Available', es: 'Disponible', it: 'Disponibile', ar: 'متاح' })}</span></header><p>{tx(locale, { en: 'Connect a question to your booking or continue directly on WhatsApp.', es: 'Vincula tu pregunta a tu reserva o continúa directamente por WhatsApp.', it: 'Collega la domanda alla tua prenotazione oppure continua direttamente su WhatsApp.', ar: 'اربط سؤالك بالحجز أو تواصل معنا مباشرة عبر واتساب.' })}</p><div className="customer-advisor"><span>NS</span><div><strong>{tx(locale, { en: 'Nour, travel specialist', es: 'Nour, especialista en viajes', it: 'Nour, specialista di viaggio', ar: 'نور، خبيرة رحلات' })}</strong><small>{tx(locale, { en: 'Customer care team', es: 'Equipo de atención al cliente', it: 'Team assistenza clienti', ar: 'فريق خدمة العملاء' })}</small></div></div><div className="customer-support-actions"><Link href="/account/messages"><MessageCircle size={16} />{tx(locale, { en: 'Open messages', es: 'Abrir mensajes', it: 'Apri i messaggi', ar: 'افتح الرسائل' })}</Link><a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer"><WhatsAppGlyph size={16} />WhatsApp</a></div></aside>
}

function QuickActions() {
  const { locale } = useLocale()

  const actions = [
    { href: '/account/trip-requests', Icon: Plus, en: 'Plan a custom trip', es: 'Planifica un viaje a medida', it: 'Pianifica un viaggio su misura', ar: 'خطط رحلة مخصصة' },
    { href: '/account/payments', Icon: ReceiptText, en: 'Payment records', es: 'Registros de pago', it: 'Registri pagamenti', ar: 'سجل المدفوعات' },
    { href: '/account/profile', Icon: UserRound, en: 'Update profile', es: 'Actualizar el perfil', it: 'Aggiorna il profilo', ar: 'تحديث الملف' },
  ]
  return <section className="customer-account-block customer-quick-actions"><header><div><span>{tx(locale, { en: 'Shortcuts', es: 'Accesos directos', it: 'Scorciatoie', ar: 'اختصارات' })}</span><h2>{tx(locale, { en: 'Quick actions', es: 'Acciones rápidas', it: 'Azioni rapide', ar: 'إجراءات سريعة' })}</h2></div></header>{actions.map(({ href, Icon, en, es, it, ar: arLabel }) => <Link key={href} href={href}><Icon size={17} /><span>{tx(locale, { en, es, it, ar: arLabel })}</span><ChevronRight size={15} /></Link>)}</section>
}

export function EmptyState({ Icon, title, copy, href, action }: { Icon: typeof CalendarDays; title: string; copy: string; href: string; action: string }) {
  return <div className="customer-empty"><span><Icon size={24} /></span><h3>{title}</h3><p>{copy}</p><Link href={href}>{action} <ArrowRight size={15} /></Link></div>
}

export function CustomerPagination({ page, pageCount, onPage, pageSize, onPageSize, from, to, total }: {
  page: number; pageCount: number; onPage: (page: number) => void; pageSize: number; onPageSize: (size: number) => void; from: number; to: number; total: number
}) {
  const { locale } = useLocale()

  const numbers: (number | '…')[] = []
  if (pageCount <= 7) {
    for (let n = 1; n <= pageCount; n++) numbers.push(n)
  } else {
    const set = new Set([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount].filter((n) => n >= 1 && n <= pageCount))
    const sorted = [...set].sort((a, b) => a - b)
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) numbers.push('…')
      numbers.push(n)
    })
  }
  return <div className="customer-pagination">
    <div className="customer-pagination-group">
      <span className="customer-pagination-info">{locale === 'es' ? `Mostrando ${from}-${to} de ${total}` : locale === 'it' ? `Visualizzazione di ${from}-${to} su ${total}` : locale === 'ar' ? `عرض ${from}-${to} من ${total}` : `Showing ${from}-${to} of ${total}`}</span>
      <label className="customer-pagination-size">{tx(locale, { en: 'Rows:', es: 'Filas:', it: 'Righe:', ar: 'الصفوف:' })}
        <SharedSelect value={String(pageSize)} onChange={(next) => onPageSize(Number(next))} locale={locale} label={tx(locale, { en: 'Rows per page', es: 'Filas por página', it: 'Righe per pagina', ar: 'عدد الصفوف في الصفحة' })} options={[10, 20, 30, 50].map((n) => ({ value: String(n), label: String(n) }))} />
      </label>
    </div>
    <div className="customer-page-btns" role="navigation" aria-label={tx(locale, { en: 'Pagination', es: 'Paginación', it: 'Paginazione', ar: 'ترقيم الصفحات' })}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={tx(locale, { en: 'Previous page', es: 'Página anterior', it: 'Pagina precedente', ar: 'الصفحة السابقة' })}>‹</button>
      {numbers.map((n, i) => n === '…' ? <span key={`gap-${i}`}>…</span> : (
        <button key={n} type="button" className={n === page ? 'active' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
      ))}
      <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label={tx(locale, { en: 'Next page', es: 'Página siguiente', it: 'Pagina successiva', ar: 'الصفحة التالية' })}>›</button>
    </div>
  </div>
}

export { CustomerAvatar, Metric, SupportPanel, QuickActions }
