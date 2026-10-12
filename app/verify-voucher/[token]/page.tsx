import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { verifyVoucherToken, type VoucherVerification } from '@/lib/server/documents';

// Verification payloads must never be indexed, cached, or prerendered:
// the token in the URL is a bearer for the validity view.
export const metadata: Metadata = {
  title: 'Verify voucher | Star Pyramids',
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = 'force-dynamic';

type VerifyLocale = 'en' | 'es' | 'it' | 'ar';

async function pageLocale(): Promise<VerifyLocale> {
  const store = await cookies();
  return (store
    .get('star-locale')
    ?.value.toLowerCase()
    .match(/^(en|es|it|ar)$/)?.[0] as VerifyLocale | undefined) ?? 'en';
}

const COPY: Record<VerifyLocale, {
  eyebrow: string;
  validTitle: string;
  invalidTitle: string;
  unrecognized: string;
  cancelled: string;
  voucher: string;
  issued: string;
  service: string;
  serviceDate: string;
  openDate: string;
  status: string;
  upcoming: string;
  completed: string;
  openDateStatus: string;
  footer: string;
}> = {
  en: {
    eyebrow: 'Star Pyramids · Voucher verification',
    validTitle: 'This voucher is valid',
    invalidTitle: 'This voucher is not valid',
    unrecognized: 'We do not recognize this verification code. Check the QR code on your voucher.',
    cancelled: 'The booking behind this voucher was cancelled, so the voucher is no longer valid.',
    voucher: 'Voucher',
    issued: 'Issued',
    service: 'Service',
    serviceDate: 'Service date',
    openDate: 'Open date',
    status: 'Service status',
    upcoming: 'Upcoming',
    completed: 'Completed',
    openDateStatus: 'Open date',
    footer: 'This page confirms only voucher authenticity and booking standing. It never shows personal or payment data.',
  },
  es: {
    eyebrow: 'Star Pyramids · Verificación de bono',
    validTitle: 'Este bono es válido',
    invalidTitle: 'Este bono no es válido',
    unrecognized: 'No reconocemos este código de verificación. Comprueba el código QR de tu bono.',
    cancelled: 'La reserva de este bono fue cancelada, por lo que el bono ya no es válido.',
    voucher: 'Bono',
    issued: 'Emitido',
    service: 'Servicio',
    serviceDate: 'Fecha del servicio',
    openDate: 'Fecha abierta',
    status: 'Estado del servicio',
    upcoming: 'Próximo',
    completed: 'Completado',
    openDateStatus: 'Fecha abierta',
    footer: 'Esta página solo confirma la autenticidad del bono y el estado de la reserva. Nunca muestra datos personales ni de pago.',
  },
  it: {
    eyebrow: 'Star Pyramids · Verifica voucher',
    validTitle: 'Questo voucher è valido',
    invalidTitle: 'Questo voucher non è valido',
    unrecognized: 'Non riconosciamo questo codice di verifica. Controlla il codice QR del tuo voucher.',
    cancelled: 'La prenotazione di questo voucher è stata cancellata, quindi il voucher non è più valido.',
    voucher: 'Voucher',
    issued: 'Emesso',
    service: 'Servizio',
    serviceDate: 'Data del servizio',
    openDate: 'Data aperta',
    status: 'Stato del servizio',
    upcoming: 'In programma',
    completed: 'Completato',
    openDateStatus: 'Data aperta',
    footer: 'Questa pagina conferma solo autenticità del voucher e stato della prenotazione. Non mostra mai dati personali o di pagamento.',
  },
  ar: {
    eyebrow: 'ستار بيراميدز · التحقق من القسيمة',
    validTitle: 'هذه القسيمة صالحة',
    invalidTitle: 'هذه القسيمة غير صالحة',
    unrecognized: 'لا نتعرف على رمز التحقق هذا. تحقق من رمز QR على قسيمتك.',
    cancelled: 'تم إلغاء الحجز المرتبط بهذه القسيمة، لذا لم تعد صالحة.',
    voucher: 'القسيمة',
    issued: 'تاريخ الإصدار',
    service: 'الخدمة',
    serviceDate: 'تاريخ الخدمة',
    openDate: 'موعد مفتوح',
    status: 'حالة الخدمة',
    upcoming: 'قادمة',
    completed: 'مكتملة',
    openDateStatus: 'موعد مفتوح',
    footer: 'تؤكد هذه الصفحة فقط أصالة القسيمة وحالة الحجز. لا تعرض أبدًا بيانات شخصية أو مالية.',
  },
};

function formatDay(iso: string, locale: VerifyLocale): string {
  const tag = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB';
  return new Date(iso).toLocaleDateString(tag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await pageLocale();
  const copy = COPY[locale];
  const result: VoucherVerification = await verifyVoucherToken(decodeURIComponent(token));
  const rtl = locale === 'ar';

  const statusLabel =
    result.serviceStatus === 'upcoming'
      ? copy.upcoming
      : result.serviceStatus === 'completed'
        ? copy.completed
        : copy.openDateStatus;

  return (
    <main
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        margin: 0,
        background: '#F7F7F7',
        color: '#1D1F1F',
        fontFamily: 'Montserrat, Arial, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 560,
          background: '#fff',
          border: '1px solid #DEDEDE',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div style={{ borderTop: '5px solid #F7951D', padding: '22px 26px 0' }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: 1, color: '#6F7272', fontWeight: 700 }}>
            {copy.eyebrow}
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: 24 }}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 999,
                background: result.valid ? '#166534' : '#991B1B',
                marginInlineEnd: 10,
              }}
            />
            {result.valid ? copy.validTitle : copy.invalidTitle}
          </h1>
        </div>
        <div style={{ padding: '16px 26px 26px', display: 'grid', gap: 12, fontSize: 14 }}>
          {!result.valid && (
            <p role="status" style={{ margin: 0 }}>
              {result.reason === 'cancelled' ? copy.cancelled : copy.unrecognized}
            </p>
          )}
          {result.voucherNumber && (
            <p style={{ margin: 0 }}>
              <strong>{copy.voucher}: </strong>
              <code dir="ltr">{result.voucherNumber}</code>
            </p>
          )}
          {result.issuedAt && (
            <p style={{ margin: 0 }}>
              <strong>{copy.issued}: </strong>
              {formatDay(result.issuedAt, locale)}
            </p>
          )}
          {result.services.map((service, index) => (
            <p key={`${service.title}-${index}`} style={{ margin: 0 }}>
              <strong>{copy.service}: </strong>
              {service.title} · {service.date ? `${copy.serviceDate}: ${service.date}` : copy.openDate}
            </p>
          ))}
          {result.valid && (
            <p style={{ margin: 0 }}>
              <strong>{copy.status}: </strong>
              {statusLabel}
            </p>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6F7272' }}>{copy.footer}</p>
        </div>
      </section>
    </main>
  );
}
