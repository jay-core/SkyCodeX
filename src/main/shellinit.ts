// Puts installed packs first on PATH inside Lithograph's own terminals only.
// A login shell rebuilds PATH from the system files (macOS path_helper puts /usr/bin first), so a plain
// environment variable would lose. Instead each shell gets a start-up file kept in Lithograph's data folder
// that loads the user's usual configuration and then adds the packs. The user's own files are never edited.
import fs from 'node:fs';
import path from 'node:path';

export interface ShellLaunch { file: string; args: string[]; env: Record<string, string> }

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** How to start `shell` so that `bins` come first on PATH. With no bins the shell starts exactly as before. */
export function launchWithPacks(shell: string, args: string[], bins: string[], stateDir: string, extraEnv: Record<string, string> = {}): ShellLaunch {
  const env = { ...extraEnv };
  if (!bins.length) return { file: shell, args, env };
  const name = path.basename(shell).toLowerCase().replace(/\.exe$/, '');
  const sep = process.platform === 'win32' ? ';' : ':';
  const joined = bins.join(sep);
  env.LITHOGRAPH_PACKS_PATH = joined;
  const dir = path.join(stateDir, 'shell-init');
  fs.mkdirSync(dir, { recursive: true });
  // the same three lines end every start-up file: packs first, without repeating them
  const prepend = `case ":$PATH:" in *:${q(joined)}:*) ;; *) export PATH=${q(joined)}:"$PATH" ;; esac\n`;   // quoted: the folder may contain spaces

  if (name === 'zsh') {
    // zsh reads $ZDOTDIR/{.zshenv,.zprofile,.zshrc,.zlogin}; each of ours sources the user's own first
    const z = path.join(dir, 'zsh');
    fs.mkdirSync(z, { recursive: true });
    const user = '"${LITHOGRAPH_USER_ZDOTDIR:-$HOME}"';
    for (const f of ['.zshenv', '.zprofile', '.zshrc', '.zlogin']) {
      let body = `# Lithograph: loads your ${f}, then puts language packs first on PATH (this terminal only)\n[ -f ${user}/${f} ] && source ${user}/${f}\n`;
      // the last file zsh reads (.zlogin for a login shell, .zshrc otherwise) hands ZDOTDIR back, so shells started from here are ordinary
      const restore = 'if [ -n "$LITHOGRAPH_USER_ZDOTDIR" ]; then export ZDOTDIR="$LITHOGRAPH_USER_ZDOTDIR"; else unset ZDOTDIR; fi\n';
      if (f === '.zshrc') body += prepend + `[[ -o login ]] || { ${restore.trim()}; }\n`;
      if (f === '.zlogin') body += prepend + restore;
      fs.writeFileSync(path.join(z, f), body);
    }
    if (process.env.ZDOTDIR) env.LITHOGRAPH_USER_ZDOTDIR = process.env.ZDOTDIR;
    env.ZDOTDIR = z;
    return { file: shell, args, env };
  }
  if (name === 'bash') {
    // an interactive non-login bash with our rc file, which does what a login shell would and then adds the packs
    const rc = path.join(dir, 'bashrc');
    fs.writeFileSync(rc, `# Lithograph: your usual login start-up, then language packs first on PATH (this terminal only)\n`
      + `[ -f /etc/profile ] && . /etc/profile\n`
      + `for f in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do [ -f "$f" ] && { . "$f"; break; }; done\n`
      + `[ -f "$HOME/.bashrc" ] && ! grep -q bashrc "$HOME/.bash_profile" 2>/dev/null && . "$HOME/.bashrc"\n` + prepend);
    return { file: shell, args: ['--rcfile', rc, '-i'], env };
  }
  if (name === 'fish') return { file: shell, args: ['-l', '-C', `fish_add_path --global --prepend --move ${bins.map(q).join(' ')}`], env };
  if (name === 'pwsh' || name === 'powershell') {
    const ps = bins.map((b) => b.replace(/'/g, "''")).join(';');
    return { file: shell, args: [...args.filter((a) => a !== '-NoExit'), '-NoExit', '-Command', `$env:Path = '${ps};' + $env:Path`], env };
  }
  if (name === 'cmd') return { file: shell, args: ['/K', `set "PATH=${joined};%PATH%"`], env };
  if (name === 'sh' || name === 'dash' || name === 'ksh' || name === 'mksh') {
    const rc = path.join(dir, 'shrc');
    fs.writeFileSync(rc, `# Lithograph: language packs first on PATH (this terminal only)\n[ -n "$LITHOGRAPH_USER_ENV" ] && [ -f "$LITHOGRAPH_USER_ENV" ] && . "$LITHOGRAPH_USER_ENV"\n` + prepend);
    if (process.env.ENV) env.LITHOGRAPH_USER_ENV = process.env.ENV;
    env.ENV = rc;
    return { file: shell, args, env };
  }
  // any other shell: the variable alone (it holds unless that shell's start-up rewrites PATH)
  env.PATH = `${joined}${sep}${process.env.PATH ?? ''}`;
  return { file: shell, args, env };
}
