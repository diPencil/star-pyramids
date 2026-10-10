// Admin → public tour publishing sync.
//
// Pins the catalogue contract: DB rows are the source of truth, new admin
// slugs appear in listings/search (includeNew), and an explicit
// non-published DB status hides the tour everywhere (lists + detail).
import { describe, expect, it } from 'vitest';

import type { Tour } from '@/data/types';
import { isTourPublished } from '@/lib/tour-publish';
import { resolveTours } from '@/lib/tours-client';

function tour(slug: string, extra?: Partial<Tour>): Tour {
  return {
    slug,
    title: slug,
    category: 'one-day-tours',
    location: 'Cairo',
    price: 100,
    duration: '1 day',
    image: '/x.png',
    summary: 's',
    ...extra,
  } as Tour;
}

describe('isTourPublished', () => {
  it('treats legacy/static entries (no status) as published', () => {
    expect(isTourPublished({})).toBe(true);
    expect(isTourPublished({ status: undefined })).toBe(true);
    expect(isTourPublished({ status: null })).toBe(true);
    expect(isTourPublished({ status: 'published' })).toBe(true);
  });
  it('hides explicit non-published DB statuses', () => {
    expect(isTourPublished({ status: 'draft' })).toBe(false);
    expect(isTourPublished({ status: 'hidden' })).toBe(false);
    expect(isTourPublished({ status: '' })).toBe(false);
  });
});

describe('resolveTours', () => {
  const base = [tour('a', { title: 'Static A' }), tour('b', { title: 'Static B' })];

  it('falls back to the bootstrap base while the DB is unreachable', () => {
    expect(resolveTours(base, null)).toEqual(base);
    expect(resolveTours(base, null, { includeNew: true })).toEqual(base);
  });

  it('overlays edited DB records onto base slugs', () => {
    const db = new Map([['a', tour('a', { title: 'Edited A', status: 'published' })]]);
    const out = resolveTours(base, db);
    expect(out.map((t) => t.title)).toEqual(['Edited A', 'Static B']);
  });

  it('drops unpublished DB rows from public lists (unpublish flow)', () => {
    const db = new Map([
      ['a', tour('a', { title: 'Edited A', status: 'published' })],
      ['b', tour('b', { title: 'Hidden B', status: 'draft' })],
    ]);
    expect(resolveTours(base, db).map((t) => t.slug)).toEqual(['a']);
  });

  it('create flow: appends published new slugs only with includeNew', () => {
    const db = new Map([
      ['a', tour('a', { status: 'published' })],
      ['b', tour('b', { status: 'published' })],
      ['new-admin-tour', tour('new-admin-tour', { title: 'New', status: 'published' })],
      ['sneaky-draft', tour('sneaky-draft', { title: 'Draft', status: 'draft' })],
    ]);
    // Curated surfaces keep base shape.
    expect(resolveTours(base, db).map((t) => t.slug)).toEqual(['a', 'b']);
    // Listing/search surfaces gain the new published tour, never the draft.
    expect(resolveTours(base, db, { includeNew: true }).map((t) => t.slug)).toEqual([
      'a',
      'b',
      'new-admin-tour',
    ]);
  });

  it('never duplicates slugs and respects the category gate', () => {
    const db = new Map([
      ['a', tour('a', { status: 'published' })],
      ['cruise-x', tour('cruise-x', { category: 'nile-cruises', status: 'published' })],
      ['day-x', tour('day-x', { category: 'one-day-tours', status: 'published' })],
    ]);
    const out = resolveTours(base, db, { includeNew: true, category: 'one-day-tours' });
    expect(out.map((t) => t.slug)).toEqual(['a', 'b', 'day-x']);
  });

  it('publish/unpublish toggle end-to-end: record preserved, visibility flips', () => {
    // Admin publishes a new tour (POST defaults status to 'published').
    const db = new Map([['fresh-tour', tour('fresh-tour', { status: 'published' })]]);
    expect(resolveTours([], db, { includeNew: true }).map((t) => t.slug)).toEqual(['fresh-tour']);
    // Admin unpublishes (PUT { status: 'draft' }): row survives, list hides it.
    db.set('fresh-tour', tour('fresh-tour', { status: 'draft' }));
    expect(db.has('fresh-tour')).toBe(true);
    expect(resolveTours([], db, { includeNew: true })).toEqual([]);
    // Admin re-publishes: visible again with data intact.
    db.set('fresh-tour', tour('fresh-tour', { status: 'published' }));
    const out = resolveTours([], db, { includeNew: true });
    expect(out.map((t) => t.slug)).toEqual(['fresh-tour']);
    expect(isTourPublished(out[0])).toBe(true);
  });
});
