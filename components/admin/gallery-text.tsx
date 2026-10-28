'use client'
import type { ComponentProps } from 'react'
import { useLocale } from '../locale'
import { sanitizeLocale } from '@/lib/locale-config'
import { PageHead } from './admin-shell'

const labels: Record<string, [string, string]> = {
  'Journey Gallery':['Galería de viajes','Galleria dei viaggi'], 'Content':['Contenido','Contenuti'],
  'Homepage rows and tour video reels, managed in one place':['Fotos de inicio y vídeos de viajes, en un solo lugar','Foto della homepage e video dei viaggi, in un solo posto'],
  'New item':['Nuevo elemento','Nuovo elemento'], 'New gallery item':['Nuevo elemento de galería','Nuovo elemento galleria'], 'Edit gallery item':['Editar elemento','Modifica elemento'],
  'Photos':['Fotos','Foto'], 'Photo':['Foto','Foto'], 'Videos':['Vídeos','Video'], 'Video':['Vídeo','Video'], 'Type':['Tipo','Tipo'], 'Order':['Orden','Ordine'], 'Title':['Título','Titolo'],
  'Homepage photo row':['Fila de fotos de inicio','Fila foto homepage'], 'Homepage + tour pages':['Inicio y páginas de viajes','Homepage e pagine viaggi'],
  'Published':['Publicado','Pubblicato'], 'Hidden':['Oculto','Nascosto'], 'Visible on the website':['Visible en el sitio','Visibile sul sito'], 'Admin only':['Solo administración','Solo amministrazione'],
  'All gallery items':['Todos los elementos','Tutti gli elementi'], 'Search the gallery...':['Buscar en la galería...','Cerca nella galleria...'], 'All types':['Todos los tipos','Tutti i tipi'], 'All placements':['Todas las ubicaciones','Tutte le posizioni'],
  'Visibility':['Visibilidad','Visibilità'], 'All':['Todos','Tutti'], 'Placement':['Ubicación','Posizione'], 'Homepage':['Inicio','Homepage'], 'Tour pages':['Páginas de viajes','Pagine viaggi'],
  'Loading gallery…':['Cargando galería…','Caricamento galleria…'], 'Reading the authoritative gallery.':['Cargando los datos de la galería.','Caricamento dei dati della galleria.'], 'Could not load the gallery':['No se pudo cargar la galería','Impossibile caricare la galleria'],
  'Retry':['Reintentar','Riprova'], 'Preview':['Vista previa','Anteprima'], 'Status':['Estado','Stato'], 'No gallery items found':['No se encontraron elementos','Nessun elemento trovato'],
  'Try changing the search or filters, or add the first item.':['Cambia la búsqueda o los filtros, o añade un elemento.','Modifica ricerca o filtri, oppure aggiungi un elemento.'],
  'Delete this gallery item?':['¿Eliminar este elemento?','Eliminare questo elemento?'], 'Removes it from the homepage and tour pages everywhere. Stored media files are kept.':['Se elimina de inicio y de los viajes. Los archivos se conservan.','Rimuove il contenuto da homepage e viaggi. I file vengono conservati.'],
  'Delete':['Eliminar','Elimina'], 'Keep':['Conservar','Mantieni'], 'Edit':['Editar','Modifica'], 'Hide':['Ocultar','Nascondi'], 'Publish':['Publicar','Pubblica'], 'Move up':['Subir','Sposta su'], 'Move down':['Bajar','Sposta giù'],
  'Uploaded video':['Vídeo subido','Video caricato'], 'Uploaded video URL':['URL del vídeo subido','URL del video caricato'], 'Upload MP4/WebM (max 5 MB)':['Subir MP4/WebM (máx. 5 MB)','Carica MP4/WebM (max 5 MB)'],
  'Uploading…':['Subiendo…','Caricamento…'], 'Choose video':['Elegir vídeo','Scegli video'], 'Saving…':['Guardando…','Salvataggio…'], 'Save changes':['Guardar cambios','Salva modifiche'], 'Create item':['Crear elemento','Crea elemento'],
  'Changes appear on the website immediately after saving.':['Los cambios aparecen al guardar.','Le modifiche appaiono dopo il salvataggio.'], 'Video source':['Origen del vídeo','Sorgente video'], 'Detected platform':['Plataforma detectada','Piattaforma rilevata'],
  'Social video URL (YouTube, Instagram, Facebook, TikTok)':['URL del vídeo (YouTube, Instagram, Facebook, TikTok)','URL video (YouTube, Instagram, Facebook, TikTok)'],
  'Enter a supported public video link, or switch to file upload.':['Introduce un enlace compatible o sube un archivo.','Inserisci un link supportato oppure carica un file.'],
  'Arabic title (optional)':['Título árabe (opcional)','Titolo arabo (facoltativo)'], 'Caption (optional)':['Descripción (opcional)','Didascalia (facoltativa)'], 'Show on homepage':['Mostrar en inicio','Mostra in homepage'],
  'Show on tour pages':['Mostrar en los viajes','Mostra nelle pagine viaggi'], 'Tour visibility':['Visibilidad en los viajes','Visibilità nei viaggi'], 'All tours':['Todos los viajes','Tutti i viaggi'], 'Selected tours':['Viajes seleccionados','Viaggi selezionati'],
  'Assign to tours (one video, many tours, never duplicated)':['Asignar a viajes (un vídeo sin duplicados)','Assegna ai viaggi (un video senza duplicati)'],
  'Select shown':['Seleccionar visibles','Seleziona visibili'], 'Clear':['Limpiar','Cancella'], 'Search tours...':['Buscar viajes...','Cerca viaggi...'], 'No tours match that search.':['No hay viajes coincidentes.','Nessun viaggio corrispondente.'],
  'Published (visible on the website)':['Publicado (visible en el sitio)','Pubblicato (visibile sul sito)'], 'Cancel':['Cancelar','Annulla'], 'Gallery item saved.':['Elemento guardado.','Elemento salvato.'], 'Gallery item added.':['Elemento añadido.','Elemento aggiunto.'],
  'Could not load item':['No se pudo cargar el elemento','Impossibile caricare il contenuto'], 'Loading…':['Cargando…','Caricamento…'], 'Loading gallery item…':['Cargando elemento…','Caricamento contenuto…'], 'Item not found':['Elemento no encontrado','Elemento non trovato'],
  'Image URL or upload':['URL o carga de imagen','URL o caricamento immagine'], 'Upload photo':['Subir foto','Carica foto'], 'Poster / thumbnail URL (optional)':['URL de miniatura (opcional)','URL miniatura (facoltativo)'], 'Upload poster':['Subir miniatura','Carica miniatura'],
  'MP4 or WebM only, max 5 MB.':['Solo MP4 o WebM, máx. 5 MB.','Solo MP4 o WebM, max 5 MB.'],
  'Photo (homepage row)':['Foto (fila de inicio)','Foto (fila homepage)'], 'Photo row':['Fila de fotos','Fila foto'], 'Video row':['Fila de vídeos','Fila video'],
  'Upload file (MP4/WebM up to 5 MB)':['Subir archivo (MP4/WebM hasta 5 MB)','Carica file (MP4/WebM fino a 5 MB)'], 'Social link':['Enlace social','Link social'], 'Unsupported link':['Enlace no compatible','Link non supportato'], 'Uploaded file':['Archivo subido','File caricato'],
  'Gallery item deleted.':['Elemento eliminado.','Elemento eliminato.'], 'Gallery management is unavailable':['La galería no está disponible','La galleria non è disponibile'],
  'Could not upload that video.':['No se pudo subir el vídeo.','Impossibile caricare il video.'], 'Could not save that item.':['No se pudo guardar el elemento.','Impossibile salvare il contenuto.'],
  'You are not allowed to manage the gallery.':['No tienes permiso para gestionar la galería.','Non hai il permesso di gestire la galleria.'], 'Could not load the gallery.':['No se pudo cargar la galería.','Impossibile caricare la galleria.'],
  'Photos join the homepage row; videos join the homepage and tour pages':['Las fotos aparecen en inicio; los vídeos en inicio y viajes','Le foto appaiono nella homepage; i video nella homepage e nei viaggi'],
}
export function galleryText(value: string, locale: string) { return locale === 'es' ? labels[value]?.[0] ?? value : locale === 'it' ? labels[value]?.[1] ?? value : value }
export function useGalleryLocale() { return sanitizeLocale(useLocale().locale) }
export function GalleryText({ en }: { en: string; ar?: string }) { return <>{galleryText(en, useGalleryLocale())}</> }
export function GalleryPageHead(props: ComponentProps<typeof PageHead>) {
  const locale = useGalleryLocale()
  return <PageHead {...props} eyebrow={galleryText(props.eyebrow, locale)} title={galleryText(props.title, locale)} sub={props.sub ? galleryText(props.sub, locale) : undefined}/>
}
