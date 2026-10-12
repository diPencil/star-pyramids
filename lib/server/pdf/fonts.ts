// Phase B: PDF font loading.
//
// The documents embed Montserrat (the brand heading font of the website,
// see app/layout.tsx) as TrueType subsets with full Latin Extended
// coverage — verified in tests against Spanish/Italian/French sample
// text via fontkit glyph inspection. Arabic is deliberately NOT
// supported: no RTL shaping is performed or claimed, and PDF copy is
// English-only.
//
// Fonts are shipped in-repo under the SIL Open Font License 1.1;
// the license text lives beside the files (LICENSE-OFL.txt).
import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';

const FONTS_DIR = path.join(process.cwd(), 'lib', 'server', 'pdf', 'fonts');

function loadFont(fileName: string): Buffer {
  return readFileSync(path.join(FONTS_DIR, fileName));
}

// Module-level constants: the same Buffer instances are reused on every
// render, so pdfkit's font cache parses each face exactly once.
export const MONTSERRAT_REGULAR = loadFont('Montserrat-Regular.ttf');
export const MONTSERRAT_MEDIUM = loadFont('Montserrat-Medium.ttf');
export const MONTSERRAT_SEMIBOLD = loadFont('Montserrat-SemiBold.ttf');
export const MONTSERRAT_BOLD = loadFont('Montserrat-Bold.ttf');
