import fs from 'node:fs';
import path from 'node:path';

export interface DataDirInput {
  isPackaged: boolean;
  execPath: string;
  platform: NodeJS.Platform;
  appRoot: string;
  appDataFallback: string;
}

export interface DataDirResult {
  dir: string;
  fallback: boolean;
  reason?: string;
}

export function portableBase(i: DataDirInput): string {
  if (!i.isPackaged) return i.appRoot;
  if (i.platform === 'darwin') {
    const bundle = path.resolve(i.execPath, '..', '..', '..');
    return path.dirname(bundle);
  }
  return path.dirname(i.execPath);
}

function writable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

export function resolveDataDir(i: DataDirInput, canWrite: (dir: string) => boolean = writable): DataDirResult {
  const base = portableBase(i);
  const dir = path.join(base, 'data');
  if (i.platform === 'darwin' && base.includes('/AppTranslocation/')) {
    return {
      dir: path.join(i.appDataFallback, 'SkyCodeX'),
      fallback: true,
      reason: 'macOS is running SkyCodeX from a read-only quarantine copy. Move the SkyCodeX folder with Finder (for example out of Downloads) to keep data beside the app.',
    };
  }
  if (canWrite(dir)) return { dir, fallback: false };
  return {
    dir: path.join(i.appDataFallback, 'SkyCodeX'),
    fallback: true,
    reason: `The folder beside SkyCodeX can't be written (${base}). Data is being kept in the system app-data folder instead. Move the SkyCodeX folder somewhere writable to make it portable again.`,
  };
}

export const DATA_SUBDIRS = ['themes', 'state', 'state/buffers', 'state/chromium', 'notes', 'logs'];

export function ensureLayout(dir: string): void {
  for (const sub of DATA_SUBDIRS) fs.mkdirSync(path.join(dir, sub), { recursive: true });
}
