import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as portal from '@/components/account/account-portal'
import { AccountShell } from '@/components/account/shared/account-shell'
import { CustomerTripRequestsPage } from '@/components/account/account-custom-trip'
import { CustomerEventRequestsPage } from '@/components/account/account-event-requests'
import * as manager from '@/components/admin/seo/seo-manager'
import * as records from '@/components/admin/seo/seo-record-editor'
import * as recordData from '@/components/admin/seo/seo-record-data'
import * as recordLists from '@/components/admin/seo/seo-record-lists'

describe('post-audit compatibility and state owners', () => {
  it('keeps the public account shell identity and existing request-page providers', () => {
    expect(portal.AccountShell).toBe(AccountShell)
    for (const Page of [CustomerTripRequestsPage, CustomerEventRequestsPage]) {
      const page = Page({})
      expect(page.props.children.type).toBe(AccountShell)
    }
  })

  it('preserves the SEO manager and record entry export surfaces', () => {
    expect(Object.keys(manager).sort()).toEqual(['SeoDashboard', 'SeoEditor'])
    expect(Object.keys(records).sort()).toEqual([
      'DynamicSeoRecords', 'RECORD_KINDS', 'SeoDiagnostics', 'SeoRecordEditor',
      'fetchSavedRecordSeoPreview', 'filterSeoRecords',
    ].sort())
  })

  it('keeps the record page connected to the original stateful editor', () => {
    const page = records.SeoRecordEditor({ kind: 'tour', slug: 'fixture-tour' })
    expect(page.type).toBe(manager.SeoEditor)
    expect(page.props).toEqual({ pageKey: 'about', recordKey: { kind: 'tour', slug: 'fixture-tour' } })
  })

  it('forwards existing record helpers and lists without wrappers', () => {
    expect(records.fetchSavedRecordSeoPreview).toBe(recordData.fetchSavedRecordSeoPreview)
    expect(records.filterSeoRecords).toBe(recordData.filterSeoRecords)
    expect(records.RECORD_KINDS).toBe(recordData.RECORD_KINDS)
    expect(records.DynamicSeoRecords).toBe(recordLists.DynamicSeoRecords)
    expect(records.SeoDiagnostics).toBe(recordLists.SeoDiagnostics)
  })
})

describe('account and SEO dependency direction', () => {
  const owners = [
    'components/account/account-portal.tsx',
    'components/account/account-custom-trip.tsx',
    'components/account/account-event-requests.tsx',
    'components/account/shared/account-shell.tsx',
    'components/admin/seo/seo-manager.tsx',
    'components/admin/seo/seo-record-editor.tsx',
    'components/admin/seo/seo-record-data.ts',
    'components/admin/seo/seo-record-lists.tsx',
  ]
  const graph = new Map(owners.map(file => {
    const source = readFileSync(file, 'utf8')
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve } }).outputText
    const imports = ts.preProcessFile(js, true, true).importedFiles.map(entry => entry.fileName)
    const deps = owners.filter(target => imports.some(spec => {
      const base = spec.startsWith('@/') ? resolve(spec.slice(2)) : resolve(file, '..', spec)
      return [base, base + '.ts', base + '.tsx'].includes(resolve(target))
    }))
    return [file, deps] as const
  }))

  it.each(owners)('keeps %s outside a runtime import cycle', start => {
    const seen = new Set<string>()
    const visit = (file: string) => {
      for (const dependency of graph.get(file) ?? []) {
        expect(dependency).not.toBe(start)
        if (!seen.has(dependency)) { seen.add(dependency); visit(dependency) }
      }
    }
    visit(start)
  })
})
