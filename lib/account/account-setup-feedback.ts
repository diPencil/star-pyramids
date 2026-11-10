import {pickLocaleText,type Locale} from '../i18n/locale-config'
export type SetupFailure='invalid'|'rate'|'service'|'network'|'password'|'identity'
export function setupFailure(status:number,code?:string):SetupFailure {
  if(status===429)return 'rate'
  if(status>=500)return 'service'
  if(code==='PASSWORD_INVALID')return 'password'
  if(code==='ACCOUNT_MISMATCH')return 'identity'
  return 'invalid'
}
export function setupFailureText(locale:Locale,failure:SetupFailure){
  const messages={
    invalid:{en:'This verification link is invalid, expired or already used. Request a new link from your booking receipt, or sign in if you already confirmed.',es:'El enlace no es válido, ha caducado o ya se ha utilizado. Solicita otro desde el comprobante o inicia sesión si ya confirmaste.',it:'Il link non è valido, è scaduto o è già stato utilizzato. Richiedine uno dalla ricevuta oppure accedi se hai già confermato.'},
    rate:{en:'Too many attempts. Wait before trying again. Your booking remains saved.',es:'Demasiados intentos. Espera antes de volver a intentarlo. Tu reserva sigue guardada.',it:'Troppi tentativi. Attendi prima di riprovare. La prenotazione resta salvata.'},
    service:{en:'The service is temporarily unavailable. Try again later; this does not mean your link has expired.',es:'El servicio no está disponible temporalmente. Inténtalo más tarde; esto no significa que el enlace haya caducado.',it:'Il servizio è temporaneamente non disponibile. Riprova più tardi; questo non significa che il link sia scaduto.'},
    network:{en:'We could not reach the service. Check your connection and retry. If confirmation succeeded before the connection failed, sign in normally.',es:'No se pudo conectar con el servicio. Comprueba tu conexión y vuelve a intentarlo. Si la confirmación se completó antes del fallo, inicia sesión normalmente.',it:'Impossibile contattare il servizio. Controlla la connessione e riprova. Se la conferma era riuscita prima del problema, accedi normalmente.'},
    password:{en:'Use matching passwords of 6–64 characters.',es:'Usa contraseñas iguales de entre 6 y 64 caracteres.',it:'Usa password corrispondenti di 6–64 caratteri.'},
    identity:{en:'Another account is signed in. Sign out before using this private link.',es:'Hay otra cuenta abierta. Cierra sesión antes de usar este enlace privado.',it:'È aperto un altro account. Esci prima di usare questo link privato.'},
  }
  return pickLocaleText(locale,messages[failure])
}
export async function readSetupResponse(response:Response):Promise<{data:Record<string,unknown>;failure?:never;retryAfter?:never}|{failure:SetupFailure;retryAfter?:number;data?:never}> {
  const retry=Number(response.headers.get('Retry-After'))
  if(response.status===429)return {failure:'rate',...(Number.isFinite(retry)&&retry>0?{retryAfter:retry}:{})}
  if(response.status>=500)return {failure:'service'}
  let data:Record<string,unknown>
  try {data=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))return {failure:'service'}}catch{return {failure:'service'}}
  if(!response.ok)return {failure:setupFailure(response.status,typeof data.code==='string'?data.code:undefined)}
  return {data}
}
