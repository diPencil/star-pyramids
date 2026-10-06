'use client'

import Link from 'next/link'
import { useState, type ComponentType } from 'react'
import { Bell } from 'lucide-react'

import styles from './notification-panel.module.css'

/**
 * Shared structural notification item. Both the customer store
 * (`CustomerNotification`) and the admin store (`AdminNotification`)
 * are structurally identical, so their rows pass straight in — no
 * store or logic changes required.
 */
export interface NotificationPanelItem {
  id: string
  type: string
  title: string
  message: string
  href: string | null
  readAt: string | null
  createdAt: string
}

interface NotificationPanelProps {
  items: NotificationPanelItem[]
  unreadCount: number
  loading: boolean
  /** Empty string means no error. Shown only when there is nothing to list. */
  loadError: string
  /** Header + accessible dialog label. */
  title: string
  dialogLabel: string
  /** Rendered only when unreadCount > 0, e.g. "3 unread". */
  unreadLabel: string | null
  markAllLabel: string
  markingAllLabel: string
  loadingLabel: string
  retryLabel: string
  emptyTitle: string
  emptyHint: string
  iconForType: (type: string) => ComponentType<{ size?: number | string }>
  formatTime: (iso: string) => string
  /** When true and an item has an href, render a Link (customer behavior);
   *  otherwise render a button and let onOpenItem navigate (admin behavior). */
  linkItems: boolean
  /** Context handler: mark-read + close + navigate. */
  onOpenItem: (item: NotificationPanelItem) => void
  onMarkAll: () => Promise<unknown>
  onRetry: () => void
}

/**
 * Single shared STAR PYRAMIDS notification presentation, used by the
 * customer account panel and the admin bell panel alike. All data,
 * auth, copy, icons, time formatting, and navigation stay in the
 * calling context — this component only renders the approved visual
 * structure so the two panels cannot drift apart again.
 */
export function NotificationPanel({
  items,
  unreadCount,
  loading,
  loadError,
  title,
  dialogLabel,
  unreadLabel,
  markAllLabel,
  markingAllLabel,
  loadingLabel,
  retryLabel,
  emptyTitle,
  emptyHint,
  iconForType,
  formatTime,
  linkItems,
  onOpenItem,
  onMarkAll,
  onRetry,
}: NotificationPanelProps) {
  const [markingAll, setMarkingAll] = useState(false)

  const handleMarkAll = () => {
    if (markingAll) return
    setMarkingAll(true)
    onMarkAll().finally(() => setMarkingAll(false))
  }

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-label={dialogLabel}
    >
      <header className={styles.header}>
        <strong>{title}</strong>
        <span className={styles.headActions}>
          {unreadLabel && <small className={styles.count}>{unreadLabel}</small>}
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAll} disabled={markingAll}>
              {markingAll ? markingAllLabel : markAllLabel}
            </button>
          )}
        </span>
      </header>
      {loading ? (
        <div className={styles.skeleton} role="status" aria-label={loadingLabel}>
          <i />
          <i />
          <i />
        </div>
      ) : loadError && items.length === 0 ? (
        <div className={styles.error}>
          <span>{loadError}</span>
          <button type="button" className={styles.retry} onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <span>
            <Bell size={20} />
          </span>
          <strong>{emptyTitle}</strong>
          <small>{emptyHint}</small>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((item) => {
            const Icon = iconForType(item.type)
            const body = (
              <>
                <span className={styles.icon}>
                  <Icon size={16} />
                </span>
                <span>
                  <b>{item.title}</b>
                  <small>{item.message}</small>
                  <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                </span>
                {!item.readAt && <i className={styles.dot} />}
              </>
            )
            const className = item.readAt ? styles.row : `${styles.row} ${styles.unread}`
            return linkItems && item.href ? (
              <Link key={item.id} href={item.href} className={className} onClick={() => onOpenItem(item)}>
                {body}
              </Link>
            ) : (
              <button key={item.id} type="button" className={className} onClick={() => onOpenItem(item)}>
                {body}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
