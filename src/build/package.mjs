// Packages Lithograph as a portable app: `npm run package`.
// macOS: release/Lithograph-<version>-mac-<arch>/Lithograph.app, then a .zip of that folder.
// The app is Electron's own bundle, renamed, with Lithograph's built files, node-pty's ready-built binary for
// this processor and the inbuilt clangd inside it. It is signed ad hoc (free); data/ and language_packs/ are
// created beside it on first run.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const NAME = pkg.productName, VERSION = pkg.version, ID = 'io.github.jay-core.lithograph';
const arch = process.arch, platform = process.platform;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const step = (s) => console.log(`\n· ${s}`);

if (platform !== 'darwin') {
  console.error('Packaging is set up for macOS so far; run this on a Mac.');
  process.exit(1);
}
const clangd = path.join(root, 'tools', 'clangd', 'bin', 'clangd');
if (!fs.existsSync(clangd)) { console.error('The inbuilt clangd is missing: run `npm run fetch-clangd` first.'); process.exit(1); }
const pty = path.join(root, 'node_modules', 'node-pty', 'prebuilds', `${platform}-${arch}`);
if (!fs.existsSync(path.join(pty, 'pty.node'))) { console.error(`node-pty has no ready-built binary for ${platform}-${arch}.`); process.exit(1); }

step('building');
run('npm', ['run', 'build'], { cwd: root });

const outDir = path.join(root, 'release', `${NAME}-${VERSION}-mac-${arch}`);
const app = path.join(outDir, `${NAME}.app`);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

step('assembling the app from Electron');
run('ditto', [path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app'), app]);
const C = path.join(app, 'Contents');
const plist = (file, key, value) => run('plutil', ['-replace', key, '-string', value, file]);
const drop = (file, key) => { try { execFileSync('plutil', ['-remove', key, file], { stdio: 'ignore' }); } catch { /* not there */ } };

// the main executable and its Info.plist
fs.renameSync(path.join(C, 'MacOS', 'Electron'), path.join(C, 'MacOS', NAME));
const info = path.join(C, 'Info.plist');
for (const [k, v] of [['CFBundleName', NAME], ['CFBundleDisplayName', NAME], ['CFBundleExecutable', NAME], ['CFBundleIdentifier', ID],
  ['CFBundleIconFile', 'lithograph.icns'], ['CFBundleShortVersionString', VERSION], ['CFBundleVersion', VERSION],
  ['NSHumanReadableCopyright', `Copyright © 2026 ${pkg.author}. Based on Lithograph by ${pkg.author}.`]]) plist(info, k, v);
// nothing in Lithograph uses the camera, microphone or Bluetooth; the asar check is for Electron's demo app, which is removed
for (const k of ['ElectronAsarIntegrity', 'NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSBluetoothAlwaysUsageDescription', 'NSBluetoothPeripheralUsageDescription', 'NSAudioCaptureUsageDescription']) drop(info, k);

// the helper apps must carry the app's name: "Lithograph Helper (GPU).app" and so on
const fw = path.join(C, 'Frameworks');
for (const h of fs.readdirSync(fw).filter((n) => n.startsWith('Electron Helper'))) {
  const suffix = h.slice('Electron Helper'.length, -'.app'.length);   // "", " (GPU)", " (Plugin)", " (Renderer)"
  const newName = `${NAME} Helper${suffix}`;
  const hc = path.join(fw, h, 'Contents');
  fs.renameSync(path.join(hc, 'MacOS', `Electron Helper${suffix}`), path.join(hc, 'MacOS', newName));
  const hi = path.join(hc, 'Info.plist');
  plist(hi, 'CFBundleName', newName); plist(hi, 'CFBundleDisplayName', newName); plist(hi, 'CFBundleExecutable', newName);
  plist(hi, 'CFBundleIdentifier', `${ID}.helper${suffix.replace(/[^A-Za-z]/g, '').toLowerCase() ? '.' + suffix.replace(/[^A-Za-z]/g, '').toLowerCase() : ''}`);
  fs.renameSync(path.join(fw, h), path.join(fw, `${newName}.app`));
}

// resources: icon, Lithograph's files, the inbuilt clangd
const res = path.join(C, 'Resources');
fs.rmSync(path.join(res, 'default_app.asar'), { force: true });
fs.rmSync(path.join(res, 'electron.icns'), { force: true });
// the icon comes from assets/icon/lithograph-1024.png (any 1024 × 1024 PNG): every size macOS wants is made from it
const iconset = path.join(outDir, 'lithograph.iconset');
fs.mkdirSync(iconset);
for (const n of [16, 32, 128, 256, 512]) for (const [k, sfx] of [[1, ''], [2, '@2x']])
  execFileSync('sips', ['-z', String(n * k), String(n * k), path.join(root, 'assets', 'icon', 'lithograph-1024.png'), '--out', path.join(iconset, `icon_${n}x${n}${sfx}.png`)], { stdio: 'ignore' });
run('iconutil', ['-c', 'icns', iconset, '-o', path.join(res, 'lithograph.icns')]);
fs.rmSync(iconset, { recursive: true });

step('copying Lithograph');
const appDir = path.join(res, 'app');
fs.mkdirSync(appDir, { recursive: true });
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: pkg.name, productName: NAME, version: VERSION, description: pkg.description, author: pkg.author, license: pkg.license, main: pkg.main }, null, 2));
fs.cpSync(path.join(root, 'dist'), path.join(appDir, 'dist'), { recursive: true, filter: (p) => !p.endsWith('.map') && !p.endsWith('fetch-clangd.cjs') });
const ptyOut = path.join(appDir, 'node_modules', 'node-pty');
fs.mkdirSync(ptyOut, { recursive: true });
for (const f of ['package.json', 'LICENSE', 'lib']) fs.cpSync(path.join(root, 'node_modules', 'node-pty', f), path.join(ptyOut, f), { recursive: true });
fs.cpSync(pty, path.join(ptyOut, 'prebuilds', `${platform}-${arch}`), { recursive: true });
fs.chmodSync(path.join(ptyOut, 'prebuilds', `${platform}-${arch}`, 'spawn-helper'), 0o755);
for (const f of ['LICENSE', 'THIRD_PARTY.md']) fs.copyFileSync(path.join(root, f), path.join(appDir, f));

step('adding the inbuilt clangd');
run('ditto', [path.join(root, 'tools', 'clangd'), path.join(res, 'tools', 'clangd')]);

step('signing ad hoc (no paid certificate)');
run('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app]);
run('codesign', ['--verify', '--deep', '--strict', app]);

// a short note beside the app, and the licence
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(outDir, 'LICENSE.txt'));
fs.writeFileSync(path.join(outDir, 'Read me first.txt'), `Lithograph ${VERSION} for macOS (${arch === 'arm64' ? 'Apple silicon' : 'Intel'})

Keep this folder together and put it anywhere you like (not inside Downloads while it is still quarantined):
Lithograph keeps its settings and state in a "data" folder created beside Lithograph.app, and language packs
in "language_packs". Nothing is installed elsewhere and nothing is sent over the network.

First launch: the app is not signed with a paid Apple certificate. If macOS says it can't be opened,
open System Settings → Privacy & Security and choose "Open Anyway", or right-click Lithograph.app → Open.

Based on Lithograph by ${pkg.author}. See LICENSE.txt.
`);

step('zipping');
const zip = path.join(root, 'release', `${NAME}-${VERSION}-mac-${arch}.zip`);
fs.rmSync(zip, { force: true });
run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', outDir, zip]);
const mb = (p) => `${Math.round(Number(execFileSync('du', ['-sk', p]).toString().split('\t')[0]) / 1024)} MB`;
console.log(`\n${app}  (${mb(app)})\n${zip}  (${(fs.statSync(zip).size / 1e6).toFixed(0)} MB)`);
