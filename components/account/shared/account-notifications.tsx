'use client'

import { useRouter } from "next/navigation";
import { Bell, FileText, ReceiptText, ShoppingBag } from "lucide-react";
import { tx, useLocale } from "@/components/locale";
import { useCustomerNotifications, type CustomerNotification } from "@/lib/account/customer-notifications";
import { localizedNotification } from "@/lib/marketing/marketing-notifications";
import { NotificationPanel as SharedNotificationPanel } from "@/components/notifications/notification-panel";
import { customerErrorText } from "@/lib/account/customer-error-copy";


function notificationIcon(type: string) {
  if (type.startsWith('booking_')) return ShoppingBag
  if (type.startsWith('payment_')) return ReceiptText
  if (type.includes('request')) return FileText
  return Bell
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { locale } = useLocale()
  const router = useRouter()
  const { recent, unreadCount, loading, loadError, markRead, markAllRead, refresh } = useCustomerNotifications()
  const dateLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB'
  const openItem = (item: CustomerNotification) => {
    if (!item.readAt) void markRead(item.id)
    onClose()
    if (item.href) router.push(item.href)
  }
  return (
    <SharedNotificationPanel
      items={recent.map(item => localizedNotification(item, locale))}
      unreadCount={unreadCount}
      loading={loading}
      loadError={loadError ? customerErrorText(locale, loadError, tx(locale, { en: 'Could not load notifications.', es: 'No se pudieron cargar las notificaciones.', it: 'Impossibile caricare le notifiche.', ar: 'تعذر تحميل الإشعارات.' })) : ''}
      title={tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'الإشعارات' })}
      dialogLabel={tx(locale, { en: 'Notifications', es: 'Notificaciones', it: 'Notifiche', ar: 'الإشعارات' })}
      unreadLabel={unreadCount > 0 ? tx(locale, { en: `${unreadCount} unread`, es: `${unreadCount} sin leer`, it: `${unreadCount} da leggere`, ar: `${unreadCount} غير مقروء` }) : null}
      markAllLabel={tx(locale, { en: 'Mark all read', es: 'Marcar todo como leído', it: 'Segna tutto come letto', ar: 'تعيين الكل كمقروء' })}
      markingAllLabel={tx(locale, { en: 'Clearing…', es: 'Borrando…', it: 'Cancellazione…', ar: 'جارٍ المسح…' })}
      loadingLabel={tx(locale, { en: 'Loading notifications', es: 'Cargando notificaciones', it: 'Caricamento notifiche', ar: 'جارٍ تحميل الإشعارات' })}
      retryLabel={tx(locale, { en: 'Try again', es: 'Reintentar', it: 'Riprova', ar: 'حاول مجددًا' })}
      emptyTitle={tx(locale, { en: "You're all caught up", es: 'Estás al día', it: 'Sei aggiornato', ar: 'لا جديد لديك' })}
      emptyHint={tx(locale, { en: 'Booking, payment, and request updates will appear here.', es: 'Las novedades de reservas, pagos y solicitudes aparecerán aquí.', it: 'Gli aggiornamenti di prenotazioni, pagamenti e richieste appariranno qui.', ar: 'ستظهر تحديثات الحجوزات والمدفوعات والطلبات هنا.' })}
      iconForType={notificationIcon}
      formatTime={(iso) => new Date(iso).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      linkItems
      onOpenItem={openItem}
      onMarkAll={() => markAllRead()}
      onRetry={refresh}
    />
  )
}

export { NotificationPanel }
