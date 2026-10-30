// Colours as the settings store them (#rrggbb, or #rrggbbaa with transparency) and as the sliders move them (hue,
// saturation, lightness, alpha). Pure, so the round trip is tested.

export const isColor = (v: unknown): v is string => typeof v === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);

/** h 0–360, s and l 0–100, a 0–1. */
export interface Hsla { h: number; s: number; l: number; a: number }

export function hexToHsla(hex: string): Hsla {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const r = n(1), g = n(3), b = n(5), a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: s * 100, l: l * 100, a };
}

export function hslaToHex({ h, s, l, a }: Hsla, alpha = a < 1): string {
  const S = Math.min(100, Math.max(0, s)) / 100, L = Math.min(100, Math.max(0, l)) / 100, H = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((H / 60) % 2) - 1)), m = L - c / 2;
  const [r, g, b] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  const hx = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${hx(r + m)}${hx(g + m)}${hx(b + m)}${alpha ? hx(a) : ''}`;
}
