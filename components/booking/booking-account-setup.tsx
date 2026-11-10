'use client'
import Link from 'next/link'
import { useEffect,useRef,useState,type FormEvent } from 'react'
import { SiteShell } from '../site'
import { tx,useLocale } from '../locale'
import {readSetupResponse,setupFailureText,type SetupFailure} from '@/lib/account/account-setup-feedback'

export function BookingAccountSetup(){
  const {locale}=useLocale()
  const [link,setLink]=useState<{reference:string;token:string}|null>(null)
  const [info,setInfo]=useState<{email:string;needsPassword:boolean}|null>(null)
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('')
  const [error,setError]=useState<SetupFailure|null>(null),[busy,setBusy]=useState(false),[redirect,setRedirect]=useState('')
  const [retryAfter,setRetryAfter]=useState<number|undefined>(),[retry,setRetry]=useState(0),[sessionRecovery,setSessionRecovery]=useState(false)
  const pending=useRef(false)
  const initialLink=useRef<{reference:string;token:string}|null>(null)
  useEffect(()=>{
    if(!initialLink.current){
      const params=new URLSearchParams(window.location.hash.slice(1))
      initialLink.current={reference:params.get('reference')??'',token:params.get('token')??''}
      window.history.replaceState(null,'',window.location.pathname)
    }
    // Keep credentials in this mounted component only, including StrictMode's
    // effect replay. A full refresh requires reopening the private email link.
    const selection=initialLink.current
    setLink(selection)
    setError(null);setRetryAfter(undefined)
    let active=true
    fetch('/api/bookings/account',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({...selection,mode:'inspect'})})
      .then(readSetupResponse).then(result=>{
        if(!active)return
        if(result.failure){setError(result.failure);setRetryAfter(result.retryAfter);return}
        const data=result.data
        if(typeof data.email!=='string'||typeof data.needsPassword!=='boolean'){setError('service');return}
        setInfo({email:data.email,needsPassword:data.needsPassword})
      })
      .catch(()=>{if(active)setError('network')})
    return()=>{active=false}
  },[retry])
  async function submit(event:FormEvent){
    event.preventDefault()
    if(pending.current||!info||!link)return
    if(info.needsPassword&&(password.length<6||password.length>64||password!==confirmation)){setError('password');return}
    pending.current=true;setBusy(true);setError(null);setRetryAfter(undefined)
    try{
      const res=await fetch('/api/bookings/account',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({...link,mode:'complete',password,confirmPassword:confirmation})})
      const result=await readSetupResponse(res)
      if(result.failure){setError(result.failure);setRetryAfter(result.retryAfter);return}
      const data=result.data
      if(data.success!==true||typeof data.redirectTo!=='string'||!['/account','/login?next=%2Faccount'].includes(data.redirectTo)){setError('service');return}
      window.history.replaceState(null,'',window.location.pathname)
      setRedirect(data.redirectTo)
      setSessionRecovery(data.sessionRecovery===true)
    }catch{setError('network')}finally{pending.current=false;setBusy(false)}
  }
  return <SiteShell><main className="container cart-page"><div className="co-form-card">
    <h1>{tx(locale,{en:'Confirm your booking account',es:'Confirma tu cuenta de reservas',it:'Conferma il tuo account di prenotazione'})}</h1>
    {redirect&&sessionRecovery&&<p role="status">{tx(locale,{en:'Your account and booking are ready, but automatic sign-in was unavailable. Sign in normally to continue.',es:'Tu cuenta y reserva están listas, pero no se pudo iniciar sesión automáticamente. Accede de la forma habitual.',it:'Account e prenotazione sono pronti, ma l’accesso automatico non era disponibile. Accedi normalmente per continuare.'})}</p>}
    {redirect?<div className="form-success"><p>{tx(locale,{en:'Your email is confirmed and this booking is linked to your account. Complete your profile after signing in.',es:'Tu correo está confirmado y esta reserva está vinculada a tu cuenta. Completa tu perfil después de iniciar sesión.',it:'La tua email è confermata e questa prenotazione è collegata al tuo account. Completa il profilo dopo l’accesso.'})}</p><Link className="primary-btn" href={redirect}>{tx(locale,{en:'Continue to your account',es:'Continuar a tu cuenta',it:'Continua al tuo account'})}</Link></div>:<>
      {!info&&!error&&<p role="status">{tx(locale,{en:'Checking your private link…',es:'Comprobando tu enlace privado…',it:'Verifica del link privato…'})}</p>}
      {info&&<form onSubmit={submit} className="form-grid">
        <p className="full">{info.email}</p>
        <p className="full">{tx(locale,{en:'Confirm only if this is your email and you requested this booking. Existing accounts keep their password and use normal sign-in.',es:'Confirma solo si este es tu correo y solicitaste esta reserva. Las cuentas existentes conservan su contraseña y usan el acceso habitual.',it:'Conferma solo se questa è la tua email e hai richiesto la prenotazione. Gli account esistenti mantengono la password e usano l’accesso normale.'})}</p>
        {info.needsPassword&&<><label>{tx(locale,{en:'Set your password (6–64 characters)',es:'Crea tu contraseña (6–64 caracteres)',it:'Imposta la password (6–64 caratteri)'})}<input required type="password" autoComplete="new-password" minLength={6} maxLength={64} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>{tx(locale,{en:'Confirm password',es:'Confirma la contraseña',it:'Conferma la password'})}<input required type="password" autoComplete="new-password" minLength={6} maxLength={64} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></>}
        <button className="primary-btn" type="submit" disabled={busy}>{tx(locale,{en:'Confirm email and link booking',es:'Confirmar correo y vincular reserva',it:'Conferma email e collega prenotazione'})}</button>
      </form>}
      {error&&<p role="alert" className="co-error">{setupFailureText(locale,error)} {retryAfter!==undefined&&tx(locale,{en:`Retry after ${retryAfter} seconds.`,es:`Vuelve a intentarlo después de ${retryAfter} segundos.`,it:`Riprova dopo ${retryAfter} secondi.`})}</p>}
      {error&&!info&&['network','service','rate'].includes(error)&&<button type="button" className="outline-btn" onClick={()=>setRetry(value=>value+1)}>{tx(locale,{en:'Retry checking this link',es:'Volver a comprobar el enlace',it:'Ricontrolla questo link'})}</button>}
      {error&&<p><Link href="/login?next=%2Faccount">{tx(locale,{en:'Already confirmed? Sign in',es:'¿Ya confirmaste? Inicia sesión',it:'Hai già confermato? Accedi'})}</Link> · <Link href="/forgot-password">{tx(locale,{en:'Reset password',es:'Restablecer contraseña',it:'Reimposta password'})}</Link></p>}
    </>}
  </div></main></SiteShell>
}
