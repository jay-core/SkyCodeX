// Paths as the interface spells them.

/**
 * One spelling per file: a Windows path (C:\… or c:/…) with forward slashes and an upper-case drive letter, as the
 * main process sends them; any other path as it is (a backslash is a legal character in a macOS or Linux name).
 */
export const normPath = (p: string) => (/^[A-Za-z]:[\\/]/.test(p) ? p[0].toUpperCase() + p.slice(1).replace(/\\/g, '/') : p);
