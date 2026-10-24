// Where Lithograph keeps everything it writes: the data/ folder beside the executable.
import fs from 'node:fs';
import path from 'node:path';

export interface DataDirInput {
  isPackaged: boolean;
  execPath: string;
  platform: NodeJS.Platform;
  appRoot: string;          // the project folder when running unpackaged
  appDataFallback: string;  // the OS app-data folder, used only when data/ can't be written
}

export interface DataDirResult {
  dir: string;
  fallback: boolean;
  reason?: string;          // why the fallback was used, shown to the user once
}

/** The folder the portable data/ directory belongs next to. */
export function portableBase(i: DataDirInput): string {
  if (!i.isPackaged) return i.appRoot;
  if (i.platform === 'darwin') {
    // …/Lithograph.app/Contents/MacOS/Lithograph → beside Lithograph.app, so the bundle stays signed.
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
      dir: path.join(i.appDataFallback, 'Lithograph'),
      fallback: true,
      reason: 'macOS is running Lithograph from a read-only quarantine copy. Move the Lithograph folder with Finder (for example out of Downloads) to keep data beside the app.',
    };
  }
  if (canWrite(dir)) return { dir, fallback: false };
  return {
    dir: path.join(i.appDataFallback, 'Lithograph'),
    fallback: true,
    reason: `The folder beside Lithograph can't be written (${base}). Data is being kept in the system app-data folder instead. Move the Lithograph folder somewhere writable to make it portable again.`,
  };
}

/** The sub-folders created on first run. */
export const DATA_SUBDIRS = ['themes', 'state', 'state/buffers', 'state/chromium', 'notes', 'logs'];

export function ensureLayout(dir: string): void {
  for (const sub of DATA_SUBDIRS) fs.mkdirSync(path.join(dir, sub), { recursive: true });
}
