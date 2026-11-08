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

export function terminalFor(dir: string, platform: NodeJS.Platform, has: (prog: string) => boolean): Launch | null {
  if (platform === 'darwin') return { cmd: 'open', args: ['-a', 'Terminal', dir], cwd: dir };
  if (platform === 'win32') {
    if (has('wt.exe')) return { cmd: 'wt.exe', args: ['-d', dir], cwd: dir };
    return { cmd: 'cmd.exe', args: ['/c', 'start', 'cmd.exe'], cwd: dir };
  }
  for (const [prog, args] of LINUX) if (has(prog)) return { cmd: prog, args: args(dir), cwd: dir };
  return null;
}

const onPath = (platform: NodeJS.Platform) => (prog: string) => {
  try { execFileSync(platform === 'win32' ? 'where' : 'which', [prog], { stdio: 'ignore', timeout: 3000 }); return true; } catch { return false; }
};

export function openTerminal(folder: string): string | null {
  const dir = folder && path.resolve(folder);
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return `${dir || 'no folder'} is not a folder`;
  const l = terminalFor(dir, process.platform, onPath(process.platform));
  if (!l) return 'no terminal program found (looked for x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, kitty, alacritty, wezterm, foot, tilix, xterm)';
  const p = spawn(l.cmd, l.args, { cwd: l.cwd, detached: true, stdio: 'ignore', windowsHide: false });
  p.on('error', () => {});
  p.unref();
  return null;
}
