// Opens the system's own terminal in a folder — a separate window, not part of SkyCodeX. macOS: Terminal. Windows:
// Windows Terminal when installed, else a Command Prompt. Linux: the desktop's default terminal (Debian's
// x-terminal-emulator), else the first common one found.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface Launch { cmd: string; args: string[]; cwd: string }

const LINUX: [string, (dir: string) => string[]][] = [
  ['x-terminal-emulator', () => []],
  ['gnome-terminal', (d) => [`--working-directory=${d}`]],
  ['konsole', (d) => ['--workdir', d]],
  ['xfce4-terminal', (d) => [`--working-directory=${d}`]],
  ['kitty', (d) => ['--directory', d]],
  ['alacritty', (d) => ['--working-directory', d]],
  ['wezterm', (d) => ['start', '--cwd', d]],
  ['foot', (d) => [`--working-directory=${d}`]],
  ['tilix', (d) => [`--working-directory=${d}`]],
  ['xterm', () => []],
];

/** What to run for a folder on this system; has: whether a program is on the PATH. Null when no terminal is found. */
export function terminalFor(dir: string, platform: NodeJS.Platform, has: (prog: string) => boolean): Launch | null {
  if (platform === 'darwin') return { cmd: 'open', args: ['-a', 'Terminal', dir], cwd: dir };
  if (platform === 'win32') {
    if (has('wt.exe')) return { cmd: 'wt.exe', args: ['-d', dir], cwd: dir };
    // "start" opens a new console window; the folder is the working directory it inherits
    return { cmd: 'cmd.exe', args: ['/c', 'start', 'cmd.exe'], cwd: dir };
  }
  for (const [prog, args] of LINUX) if (has(prog)) return { cmd: prog, args: args(dir), cwd: dir };
  return null;
}

const onPath = (platform: NodeJS.Platform) => (prog: string) => {
  try { execFileSync(platform === 'win32' ? 'where' : 'which', [prog], { stdio: 'ignore', timeout: 3000 }); return true; } catch { return false; }
};

/** Opens a terminal window in dir. Returns why not, when it cannot. */
export function openTerminal(folder: string): string | null {
  const dir = folder && path.resolve(folder);   // native separators for the terminal's own arguments
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return `${dir || 'no folder'} is not a folder`;
  const l = terminalFor(dir, process.platform, onPath(process.platform));
  if (!l) return 'no terminal program found (looked for x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, kitty, alacritty, wezterm, foot, tilix, xterm)';
  const p = spawn(l.cmd, l.args, { cwd: l.cwd, detached: true, stdio: 'ignore', windowsHide: false });
  p.on('error', () => {});
  p.unref();
  return null;
}
