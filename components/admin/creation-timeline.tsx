'use client'

import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'
import './creation-timeline.css'

export type CreationTimelineStep = {
  id: string
  label: string
  icon?: LucideIcon
  content: ReactNode
}

export type CreationTimelineProps = {
  steps: readonly CreationTimelineStep[]
  footer?: ReactNode
  ariaLabel?: string
  initialStepId?: string
  busy?: boolean
}

/** Navigation only: no validation, submission, or field ownership. Panels stay mounted. */
export function CreationTimeline({ steps, footer, ariaLabel, initialStepId, busy = false }: CreationTimelineProps) {
  const [selected, setSelected] = useState(initialStepId ?? steps[0]?.id ?? '')
  const id = useId()
  const index = Math.max(0, steps.findIndex(step => step.id === selected))
  const active = steps[index]
  const move = (next: number) => { if (!busy && steps[next]) setSelected(steps[next].id) }
  return <div className="sp-creation-timeline">
    <nav className="sp-builder-timeline" aria-label={ariaLabel ?? 'Creation steps'}>
      <ol className="sp-steps sp-creation-steps" style={{ '--creation-steps': Math.max(1, steps.length) } as CSSProperties}>
        {steps.map((step, position) => {
          const Icon = step.icon
          return <li key={step.id} className={step.id === active?.id ? 'active' : ''}>
            <button id={`${id}-step-${step.id}`} type="button" disabled={busy} aria-current={step.id === active?.id ? 'step' : undefined} aria-controls={`${id}-panel-${step.id}`} onClick={() => move(position)}>
              <span className="sp-step-node" aria-hidden="true">{Icon ? <Icon size={16} /> : position + 1}</span>
              <span className="sp-step-label">{step.label}</span>
            </button>
          </li>
        })}
      </ol>
    </nav>
    {steps.map(step => <section key={step.id} id={`${id}-panel-${step.id}`} aria-labelledby={`${id}-step-${step.id}`} hidden={step.id !== active?.id} className="sp-creation-panel">{step.content}</section>)}
    {active && <div className="sp-creation-navigation">
      <button type="button" className="sp-btn" disabled={busy || index === 0} onClick={() => move(index - 1)}><ArrowLeft size={16} />Back</button>
      <span aria-live="polite">{index + 1} / {steps.length} · {active.label}</span>
      <button type="button" className="sp-btn" disabled={busy || index === steps.length - 1} onClick={() => move(index + 1)}>Next<ArrowRight size={16} /></button>
    </div>}
    <div className="sp-creation-footer">{footer}</div>
  </div>
}
