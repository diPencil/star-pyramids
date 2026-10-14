import 'server-only';

import type { Metadata } from 'next';
import { cache } from 'react';
import { isLocaleEnabled } from '../locale-config';
import { getSetting, validateSettingsPatch } from './settings';

/** Public defaults only. The root owns the existing site.seoTitle fallback. */
export const getGlobalSeo = cache(async (locale: string): Promise<Metadata> => {
  const language = isLocaleEnabled(locale) ? locale : 'en';
  const descriptionKey = `site.seoDescription${{ en: 'En', es: 'Es', it: 'It' }[language]}`;
  const keys = [descriptionKey, 'site.seoImage', 'site.googleSiteVerification'];
  const stored = await Promise.all(keys.map(key => getSetting(key)));
  const values: Record<string, string> = {};
  keys.forEach((key, index) => {
    // Validate independently so a corrupt optional value cannot suppress others.
    const value = stored[index];
    if (typeof value !== 'string') return;
    const { clean, errors } = validateSettingsPatch({ values: { [key]: value } });
    if (!errors.length && clean[key]) values[key] = clean[key];
  });
  const description = values[descriptionKey];
  const image = values['site.seoImage'];
  const google = values['site.googleSiteVerification'];
  return {
    ...(description ? { description } : {}),
    ...(description || image ? {
      openGraph: { ...(description ? { description } : {}), ...(image ? { images: [{ url: image }] } : {}) },
      twitter: { ...(description ? { description } : {}), ...(image ? { images: [image] } : {}) },
    } : {}),
    ...(google ? { verification: { google } } : {}),
  };
});
