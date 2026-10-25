// A problem report: what someone helping needs to know, written to a text file the person reads first.
// Personal paths are shortened to ~ and the user name is removed; nothing is sent anywhere.
import fs from 'node:fs';
import path from 'node:path';

export interface ReportInput {
  version: string; electron: string; chrome: string; node: string; platform: string; arch: string; osRelease: string; dataDir: string;
  clangd: string | null; clangdVersion: string | null; packs: string[]; settingsText: string; logDir: string; home: string;
}

/** Replaces the home folder with ~ and the account name with <user>, wherever they appear. */
export function redact(text: string, home: string): string {
  let out = text;
  if (home && home.length > 2) out = out.split(home).join('~').split(home.replace(/\\/g, '/')).join('~');
  const user = path.basename(home);
  if (user && user.length > 1) out = out.replace(new RegExp(`\\b${user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), '<user>');
  return out;
}

export function buildReport(r: ReportInput): string {
  const tail = (f: string, n: number) => { try { return fs.readFileSync(f, 'utf8').split('\n').slice(-n).join('\n'); } catch { return '(none)'; } };
  const crashes = (() => { try { return walk(path.join(r.logDir, 'crashes')).slice(-10); } catch { return []; } })();
  const body = [
    'Lithograph problem report',
    'Nothing here has been sent anywhere. Read it, remove anything you would rather not share, then attach it where you ask for help.',
    '',
    `Lithograph ${r.version} · Electron ${r.electron} · Chromium ${r.chrome} · Node ${r.node}`,
    `System: ${r.platform} ${r.osRelease} (${r.arch})`,
    `Data folder: ${r.dataDir}`,
    `Language engine: ${r.clangd ?? 'not found'}${r.clangdVersion ? ` (clangd ${r.clangdVersion})` : ''}`,
    `Language packs: ${r.packs.length ? r.packs.join(', ') : 'none'}`,
    '',
    '## What happened (write it here)',
    '',
    '',
    '## settings.toml',
    r.settingsText.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).join('\n'),
    '',
    '## Last 200 lines of lithograph.log',
    tail(path.join(r.logDir, 'lithograph.log'), 200),
    '',
    `## Crash dumps (${crashes.length}) — in ${path.join(r.logDir, 'crashes')}; attach only if asked`,
    crashes.map((c) => path.relative(r.logDir, c)).join('\n') || '(none)',
    '',
  ].join('\n');
  return redact(body, r.home);
}

function walk(d: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else if (/\.dmp$/i.test(e.name)) out.push(p);
  }
  return out.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}
