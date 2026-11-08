export const normPath = (p: string) => (/^[A-Za-z]:[\\/]/.test(p) ? p[0].toUpperCase() + p.slice(1).replace(/\\/g, '/') : p);
