// Packages Lithograph as a portable app for the system it runs on: `npm run package`.
//   macOS   release/Lithograph-<version>-mac-<arch>/Lithograph.app        → .zip
//   Windows release/Lithograph-<version>-win-<arch>/Lithograph.exe        → .zip
//   Linux   release/Lithograph-<version>-linux-<arch>/lithograph          → .tar.gz
// Each is Electron's own build, renamed, with Lithograph's built files, node-pty's binary for this system and the
// inbuilt clangd inside it. data/ and language_packs/ are created beside the app on first run. Nothing is signed with a
// paid certificate (macOS gets a free ad-hoc signature).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const NAME = pkg.productName, VERSION = pkg.version, ID = 'io.github.jay-core.lithograph', AUTHOR = pkg.author;
const arch = process.arch, platform = process.platform;
const OS = { darwin: 'mac', win32: 'win', linux: 'linux' }[platform];
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', shell: platform === 'win32' && cmd === 'npm', ...opts });
const step = (s) => console.log(`\n· ${s}`);
const fail = (s) => { console.error(s); process.exit(1); };

if (!OS) fail(`Packaging isn't set up for ${platform}.`);
const exe = (n) => (platform === 'win32' ? `${n}.exe` : n);
if (!fs.existsSync(path.join(root, 'tools', 'clangd', 'bin', exe('clangd')))) fail('The inbuilt clangd is missing: run `npm run fetch-clangd` first.');
// node-pty: its ready-built binary (macOS, Windows) or the one compiled here (Linux: npx electron-rebuild -f -w node-pty)
const ptyRoot = path.join(root, 'node_modules', 'node-pty');
const ptyBin = [path.join(ptyRoot, 'build', 'Release'), path.join(ptyRoot, 'prebuilds', `${platform}-${arch}`)].find((d) => fs.existsSync(path.join(d, 'pty.node')));
if (!ptyBin) fail(`node-pty has no binary for ${platform}-${arch}: compile it with \`npx electron-rebuild -f -w node-pty\`.`);

step('building');
run('npm', ['run', 'build'], { cwd: root });

const folder = `${NAME}-${VERSION}-${OS}-${arch}`;
const outDir = path.join(root, 'release', folder);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');

/** Lithograph's own files and the inbuilt clangd, into Electron's resources folder. */
function addLithograph(res) {
  step('copying Lithograph');
  fs.rmSync(path.join(res, 'default_app.asar'), { force: true });
  const appDir = path.join(res, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: pkg.name, productName: NAME, version: VERSION, description: pkg.description, author: AUTHOR, license: pkg.license, main: pkg.main }, null, 2));
  fs.cpSync(path.join(root, 'dist'), path.join(appDir, 'dist'), { recursive: true, filter: (p) => !p.endsWith('.map') && !p.endsWith('fetch-clangd.cjs') });
  const ptyOut = path.join(appDir, 'node_modules', 'node-pty');
  fs.mkdirSync(ptyOut, { recursive: true });
  for (const f of ['package.json', 'LICENSE', 'lib']) fs.cpSync(path.join(ptyRoot, f), path.join(ptyOut, f), { recursive: true });
  const ptyDest = path.join(ptyOut, path.relative(ptyRoot, ptyBin));
  fs.cpSync(ptyBin, ptyDest, { recursive: true, filter: (p) => !/\.(pdb|o|d|mk|stamp)$/.test(p) && !/[\\/]obj(\.target)?$/.test(p) });
  if (fs.existsSync(path.join(ptyDest, 'spawn-helper'))) fs.chmodSync(path.join(ptyDest, 'spawn-helper'), 0o755);
  for (const f of ['LICENSE', 'THIRD_PARTY.md']) fs.copyFileSync(path.join(root, f), path.join(appDir, f));
  step('adding the inbuilt clangd');
  fs.cpSync(path.join(root, 'tools', 'clangd'), path.join(res, 'tools', 'clangd'), { recursive: true, verbatimSymlinks: true });
}

function readme(system, firstLaunch) {
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(outDir, 'LICENSE.txt'));
  fs.writeFileSync(path.join(outDir, 'Read me first.txt'), `Lithograph ${VERSION} for ${system}

Keep this folder together and put it anywhere you like, such as a projects folder or a USB drive.
Lithograph keeps its settings and state in a "data" folder it creates in here, and language packs in
"language_packs". Nothing is installed elsewhere and nothing is sent over the network.

First launch: ${firstLaunch}

Based on Lithograph by ${AUTHOR}. See LICENSE.txt.
`.replace(/\n/g, platform === 'win32' ? '\r\n' : '\n'));
}

let artifact = '', appPath = '';
if (platform === 'darwin') {
  // ---------- macOS: Lithograph.app ----------
  step('assembling the app from Electron');
  const app = (appPath = path.join(outDir, `${NAME}.app`));
  run('ditto', [path.join(electronDist, 'Electron.app'), app]);
  const C = path.join(app, 'Contents');
  const plist = (file, key, value) => run('plutil', ['-replace', key, '-string', value, file]);
  const drop = (file, key) => { try { execFileSync('plutil', ['-remove', key, file], { stdio: 'ignore' }); } catch { /* not there */ } };
  fs.renameSync(path.join(C, 'MacOS', 'Electron'), path.join(C, 'MacOS', NAME));
  const info = path.join(C, 'Info.plist');
  for (const [k, v] of [['CFBundleName', NAME], ['CFBundleDisplayName', NAME], ['CFBundleExecutable', NAME], ['CFBundleIdentifier', ID],
    ['CFBundleIconFile', 'lithograph.icns'], ['CFBundleShortVersionString', VERSION], ['CFBundleVersion', VERSION],
    ['NSHumanReadableCopyright', `Copyright © 2026 ${AUTHOR}. Based on Lithograph by ${AUTHOR}.`]]) plist(info, k, v);
  // nothing in Lithograph uses the camera, microphone or Bluetooth; the asar check is for Electron's demo app, which is removed
  for (const k of ['ElectronAsarIntegrity', 'NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSBluetoothAlwaysUsageDescription', 'NSBluetoothPeripheralUsageDescription', 'NSAudioCaptureUsageDescription']) drop(info, k);
  // the helper apps must carry the app's name: "Lithograph Helper (GPU).app" and so on
  const fw = path.join(C, 'Frameworks');
  for (const h of fs.readdirSync(fw).filter((n) => n.startsWith('Electron Helper'))) {
    const suffix = h.slice('Electron Helper'.length, -'.app'.length);   // "", " (GPU)", " (Plugin)", " (Renderer)"
    const newName = `${NAME} Helper${suffix}`, tag = suffix.replace(/[^A-Za-z]/g, '').toLowerCase();
    const hc = path.join(fw, h, 'Contents');
    fs.renameSync(path.join(hc, 'MacOS', `Electron Helper${suffix}`), path.join(hc, 'MacOS', newName));
    const hi = path.join(hc, 'Info.plist');
    plist(hi, 'CFBundleName', newName); plist(hi, 'CFBundleDisplayName', newName); plist(hi, 'CFBundleExecutable', newName);
    plist(hi, 'CFBundleIdentifier', `${ID}.helper${tag ? '.' + tag : ''}`);
    fs.renameSync(path.join(fw, h), path.join(fw, `${newName}.app`));
  }
  const res = path.join(C, 'Resources');
  fs.rmSync(path.join(res, 'electron.icns'), { force: true });
  // the icon comes from assets/icon/lithograph-1024.png (any 1024 × 1024 PNG): every size macOS wants is made from it
  const iconset = path.join(outDir, 'lithograph.iconset');
  fs.mkdirSync(iconset);
  for (const n of [16, 32, 128, 256, 512]) for (const [k, sfx] of [[1, ''], [2, '@2x']])
    execFileSync('sips', ['-z', String(n * k), String(n * k), path.join(root, 'assets', 'icon', 'lithograph-1024.png'), '--out', path.join(iconset, `icon_${n}x${n}${sfx}.png`)], { stdio: 'ignore' });
  run('iconutil', ['-c', 'icns', iconset, '-o', path.join(res, 'lithograph.icns')]);
  fs.rmSync(iconset, { recursive: true });
  addLithograph(res);
  step('signing ad hoc (no paid certificate)');
  run('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app]);
  run('codesign', ['--verify', '--deep', '--strict', app]);
  readme(`macOS (${arch === 'arm64' ? 'Apple silicon' : 'Intel'})`, 'the app is not signed with a paid Apple certificate. If macOS says it can\'t be opened, open System Settings → Privacy & Security and choose "Open Anyway", or right-click Lithograph.app → Open. While macOS still has the folder quarantined, don\'t run it from Downloads.');
  step('zipping');
  artifact = path.join(root, 'release', `${folder}.zip`);
  fs.rmSync(artifact, { force: true });
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', outDir, artifact]);
} else if (platform === 'win32') {
  // ---------- Windows: Lithograph.exe in a folder ----------
  step('assembling the app from Electron');
  fs.cpSync(electronDist, outDir, { recursive: true });
  appPath = path.join(outDir, `${NAME}.exe`);
  fs.renameSync(path.join(outDir, 'electron.exe'), appPath);
  // the icon and the names Windows shows (Task Manager, file properties), with Electron's rcedit
  // (installed for the build only: npm install --no-save rcedit@5.0.2)
  try {
    const m = await import('rcedit');
    const rcedit = m.rcedit ?? m.default;
    await rcedit(appPath, {
      icon: path.join(root, 'assets', 'icon', 'lithograph.ico'),
      'file-version': VERSION, 'product-version': VERSION,
      'version-string': { ProductName: NAME, FileDescription: NAME, CompanyName: AUTHOR, LegalCopyright: `Copyright © 2026 ${AUTHOR}`, OriginalFilename: `${NAME}.exe`, InternalName: NAME },
    });
  } catch (e) { fail(`couldn't set the icon and names on ${NAME}.exe (npm install --no-save rcedit@5.0.2): ${e.message ?? e}`); }
  addLithograph(path.join(outDir, 'resources'));
  readme(`Windows (${arch})`, 'the app is not signed with a paid certificate, so Windows SmartScreen may warn about it. Choose "More info", then "Run anyway". The C and C++ standard headers come from the llvm-mingw language pack (install it from the compiler window) or from Visual Studio.');
  step('zipping');
  artifact = path.join(root, 'release', `${folder}.zip`);
  fs.rmSync(artifact, { force: true });
  run('tar', ['-a', '-c', '-f', artifact, '-C', path.join(root, 'release'), folder]);
} else {
  // ---------- Linux: lithograph in a folder ----------
  step('assembling the app from Electron');
  fs.cpSync(electronDist, outDir, { recursive: true, verbatimSymlinks: true });
  appPath = path.join(outDir, 'lithograph');
  fs.renameSync(path.join(outDir, 'electron'), appPath);
  fs.copyFileSync(path.join(root, 'assets', 'icon', 'lithograph-square-1024.png'), path.join(outDir, 'lithograph.png'));
  addLithograph(path.join(outDir, 'resources'));
  readme(`Linux (${arch})`, `run ./lithograph from this folder. If it stops at once with a message about the "SUID sandbox helper", your system doesn't allow Chromium's sandbox for unprivileged programs (Ubuntu 24.04 and later). Either give the sandbox helper its rights once:
  sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox
or start Lithograph with ./lithograph --no-sandbox. For the C and C++ standard headers, install your distribution's development packages (for example build-essential).`);
  step('packing');
  artifact = path.join(root, 'release', `${folder}.tar.gz`);
  fs.rmSync(artifact, { force: true });
  run('tar', ['-czf', artifact, '-C', path.join(root, 'release'), folder]);
}

console.log(`\n${appPath}\n${artifact}  (${(fs.statSync(artifact).size / 1e6).toFixed(0)} MB)`);
