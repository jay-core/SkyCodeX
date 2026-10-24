// Installed font families, for the settings page. Uses the browser's Local Font Access API
// (granted to this window only); the bundled fonts are always listed first.

export interface FontFamily { name: string; mono: boolean; bundled?: boolean }

const BUNDLED = [{ name: 'ARX F1', mono: true, bundled: true }, { name: 'Selawik', mono: false, bundled: true }];
let cached: Promise<FontFamily[]> | null = null;

/** Same advance for a narrow and a wide glyph means a fixed-pitch font. The serif fallback is proportional,
 *  so a family that fails to load never counts as monospace. */
function isMono(ctx: CanvasRenderingContext2D, family: string): boolean {
  ctx.font = `20px "${family.replace(/"/g, '')}", serif`;
  return Math.abs(ctx.measureText('iiiiiiiiii').width - ctx.measureText('WWWWWWWWWW').width) < 0.5;
}

export function installedFonts(): Promise<FontFamily[]> {
  if (cached) return cached;
  cached = (async () => {
    let names: string[] = [];
    try {
      const faces: { family: string }[] = await (window as any).queryLocalFonts();
      names = [...new Set(faces.map((f) => f.family))];
    } catch { cached = null; /* not granted or not supported: only the bundled fonts, try again next time */ }
    const ctx = document.createElement('canvas').getContext('2d')!;
    const sys = names
      .filter((n) => !BUNDLED.some((b) => b.name === n) && !n.startsWith('.'))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, mono: isMono(ctx, name) }));
    return [...BUNDLED, ...sys];
  })();
  return cached;
}
