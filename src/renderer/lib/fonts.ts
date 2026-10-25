// Installed font families, for the settings page. Uses the browser's Local Font Access API
// (granted to this window only); the bundled fonts are always listed first.

export interface FontFamily { name: string; mono: boolean; bundled?: boolean }

// the weights shipped in styles.css
const BUNDLED: (FontFamily & { weights: number[] })[] = [
  { name: 'ArX F1', mono: true, bundled: true, weights: [100, 200, 300, 400, 500, 600, 700] },
  { name: 'Selawik', mono: false, bundled: true, weights: [300, 350, 400, 600, 700] },
];
let faces: Promise<{ family: string; style: string }[]> | null = null;
let cached: Promise<FontFamily[]> | null = null;

function localFaces() {
  faces ??= (window as any).queryLocalFonts().catch(() => { faces = null; return []; });   // not granted: try again next time
  return faces!;
}

/** Same advance for a narrow and a wide glyph means a fixed-pitch font. The serif fallback is proportional,
 *  so a family that fails to load never counts as monospace. */
function isMono(ctx: CanvasRenderingContext2D, family: string): boolean {
  ctx.font = `20px "${family.replace(/"/g, '')}", serif`;
  return Math.abs(ctx.measureText('iiiiiiiiii').width - ctx.measureText('WWWWWWWWWW').width) < 0.5;
}

export function installedFonts(): Promise<FontFamily[]> {
  if (cached) return cached;
  cached = (async () => {
    const names = [...new Set((await localFaces()).map((f) => f.family))];
    if (!names.length) cached = null;
    const ctx = document.createElement('canvas').getContext('2d')!;
    const sys = names
      .filter((n) => !BUNDLED.some((b) => b.name === n) && !n.startsWith('.'))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, mono: isMono(ctx, name) }));
    return [...BUNDLED.map(({ weights: _, ...f }) => f), ...sys];
  })();
  return cached;
}

// style names → CSS weights, most specific first ("SemiBold" before "Bold")
const STYLE_WEIGHTS: [RegExp, number][] = [
  [/hairline|thin/, 100], [/extra ?light|ultra ?light/, 200], [/semi ?light|demi ?light/, 350], [/light/, 300],
  [/medium/, 500], [/semi ?bold|demi ?bold/, 600], [/extra ?bold|ultra ?bold/, 800], [/black|heavy/, 900], [/bold/, 700],
];
export const WEIGHT_NAMES: Record<number, string> = {
  100: 'thin', 200: 'extra light', 300: 'light', 350: 'semilight', 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extra bold', 900: 'black',
};

/** The upright weights a family really has; empty when they can't be read. */
export async function weightsOf(family: string): Promise<number[]> {
  const b = BUNDLED.find((f) => f.name === family);
  if (b) return b.weights;
  const ws = new Set<number>();
  for (const f of await localFaces()) {
    if (f.family !== family) continue;
    const st = f.style.toLowerCase();
    if (/italic|oblique/.test(st)) continue;
    ws.add(STYLE_WEIGHTS.find(([re]) => re.test(st))?.[1] ?? 400);
  }
  return [...ws].sort((a, b) => a - b);
}
