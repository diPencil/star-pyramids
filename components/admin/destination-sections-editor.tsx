'use client'

import Link from 'next/link'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { Destination } from '@/data/types'
import { changeDestinationRow, type DestinationRepeater } from '@/lib/destination-builder'
import type { CatalogueTranslations } from '@/lib/catalogue-translations'
import { Card } from './admin-ui'
import { ContentLanguageTabs, TranslatedInput, TranslatedTextarea, useContentLanguage } from './content-language-tabs'
import { ImageField } from './image-field'

type Props = {
  item: Destination
  onChange: (item: Destination) => void
  setTranslations: React.Dispatch<React.SetStateAction<CatalogueTranslations>>
  onUpload: (key: string, active: boolean) => void
  disabled?: boolean
}
const sections = {
  facts: { title: '2. Facts at a glance', fields: { label: 'Label', value: 'Value' } },
  bestFor: { title: 'Best suited for', fields: {} },
  experiences: { title: '4. Signature experiences', fields: { title: 'Title', copy: 'Description', alt: 'Image description' } },
  rhythm: { title: '5. Journey rhythm', fields: { label: 'Time / stage', title: 'Title', copy: 'Description' } },
  practical: { title: '6. Practical information', fields: { title: 'Title', copy: 'Description' } },
}

function Rows({ section, item, onChange, onUpload, disabled }: Props & { section: DestinationRepeater }) {
  const language = useContentLanguage()
  const english = !language || language.locale === 'en'
  const rows = item.detail[section]
  const change = (index: number, key: string, text: string) => onChange({ ...item, detail: { ...item.detail,
    [section]: rows.map((row, position) => position !== index ? row : section === 'bestFor' ? text : { ...row as object, [key]: text }),
  } })
  return <div className="sp-repeat-list">
    {!english && <p className="sp-builder-note">Translate the existing items here. Add, remove and reorder items in English.</p>}
    {!rows.length && <p className="sp-builder-note">No items. The preview will keep this list empty.</p>}
    {rows.map((row, index) => <article className="sp-repeat-card" key={`${section}-${index}`}>
      <header><strong>Item {index + 1}</strong><div className="sp-destination-row-actions">
        <button type="button" className="sp-icon-btn" disabled={!english || disabled || index === 0} aria-label={`Move ${section} item ${index + 1} up`} onClick={() => onChange(changeDestinationRow(item, section, 'move', index, index - 1))}><ArrowUp size={16}/></button>
        <button type="button" className="sp-icon-btn" disabled={!english || disabled || index === rows.length - 1} aria-label={`Move ${section} item ${index + 1} down`} onClick={() => onChange(changeDestinationRow(item, section, 'move', index, index + 1))}><ArrowDown size={16}/></button>
        <button type="button" className="sp-icon-btn danger" disabled={!english || disabled} aria-label={`Remove ${section} item ${index + 1}`} onClick={() => onChange(changeDestinationRow(item, section, 'remove', index))}><Trash2 size={16}/></button>
      </div></header>
      {section === 'bestFor' ? <label>Audience / interest<TranslatedInput field={`detail.bestFor.${index}`} value={String(row)} onChange={event => change(index, '', event.target.value)} /></label> : Object.entries(sections[section].fields).map(([field, label]) => <label key={field}>{label}<TranslatedTextarea field={`detail.${section}.${index}.${field}`} value={String((row as unknown as Record<string, string>)[field] ?? '')} onChange={event => change(index, field, event.target.value)} rows={field === 'copy' ? 3 : 1}/></label>)}
      {section === 'experiences' && <ImageField value={(row as Destination['detail']['experiences'][number]).image} onChange={value => change(index, 'image', value)} preview="wide" previewAlt={(row as Destination['detail']['experiences'][number]).alt} disabled={disabled || !english} onUploadingChange={active => onUpload(`experiences.${index}`, active)} />}
    </article>)}
    <button type="button" className="sp-btn" disabled={!english || disabled || rows.length >= 100} onClick={() => onChange(changeDestinationRow(item, section, 'add'))}><Plus size={16}/>Add item</button>
  </div>
}

export function DestinationSectionsEditor(props: Props) {
  const { item, onChange, setTranslations, onUpload, disabled } = props
  const detail = (key: 'heroImage' | 'heroAlt' | 'eyebrow' | 'intro', value: string) => onChange({ ...item, detail: { ...item.detail, [key]: value } })
  const languages = (children: React.ReactNode) => <ContentLanguageTabs translations={item.translations ?? {}} setTranslations={setTranslations}>{children}</ContentLanguageTabs>
  return <>
    <Card title="1. Hero" sub="Destination name, introductory copy and background shown at the top of the detail page.">
      {languages(<div className="sp-form">
        <label>Destination name<TranslatedInput field="title" value={item.title} onChange={event => onChange({ ...item, title: event.target.value })}/></label>
        <label>Hero description / card summary<TranslatedTextarea field="copy" value={item.copy} onChange={event => onChange({ ...item, copy: event.target.value })} rows={3}/></label>
        <label>Eyebrow<TranslatedInput field="detail.eyebrow" value={item.detail.eyebrow} onChange={event => detail('eyebrow', event.target.value)}/></label>
        <label>Hero image description<TranslatedInput field="detail.heroAlt" value={item.detail.heroAlt} onChange={event => detail('heroAlt', event.target.value)}/></label>
      </div>)}
      <ImageField value={item.detail.heroImage} onChange={value => detail('heroImage', value)} preview="wide" previewAlt={item.detail.heroAlt} disabled={disabled} onUploadingChange={active => onUpload('hero', active)}/>
      <p className="sp-builder-note">The same hero image is reused beside Journey rhythm. Removing it leaves those media areas empty.</p>
    </Card>
    <Card title={sections.facts.title} sub="Display order follows the item order below. Each fact contains a label and value.">{languages(<Rows {...props} section="facts"/>)}</Card>
    <Card title="3. Destination story" sub="The introduction and audience tags shown below the facts.">
      {languages(<><label>Introduction<TranslatedTextarea field="detail.intro" value={item.detail.intro} onChange={event => detail('intro', event.target.value)} rows={5}/></label><h4>Best suited for</h4><Rows {...props} section="bestFor"/></>)}
    </Card>
    {(['experiences', 'rhythm', 'practical'] as const).map(section => <Card key={section} title={sections[section].title} sub="Add, translate and arrange the items exactly as they should appear publicly.">{languages(<Rows {...props} section={section}/>)}</Card>)}

  </>
}

export function DestinationCoverEditor({ item, onChange, onUpload, disabled }: Pick<Props, 'item' | 'onChange' | 'onUpload' | 'disabled'>) {
  return (
    <Card title="8. Planning CTA & destination card" sub="The cover image is reused as the planning CTA background and directory card image.">
      <ImageField value={item.image} onChange={image => onChange({ ...item, image })} preview="wide" previewAlt={item.title} disabled={disabled} onUploadingChange={active => onUpload('cover', active)}/>
      <p className="sp-builder-note">The destination name is inserted into the CTA. Shared headings, button text, links, section visibility and section order are managed in <Link href="/admin/website-cms/pages/destination-detail">Website CMS → Destination template</Link>.</p>
    </Card>
  )
}
