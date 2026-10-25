// `npm run fetch-clangd`: puts the pinned official clangd into tools/clangd for this platform, the copy
// SkyCodeX ships as its inbuilt language engine. The file is checked against its SHA-256 before use.
// Pass a local zip to skip the download: `npm run fetch-clangd -- path/to/clangd-mac-23.1.0.zip`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { extractZip } from './unpack';

export const CLANGD_VERSION = '23.1.0';
const PINNED: Record<string, { asset: string; sha256: string }> = {
  darwin: { asset: 'clangd-mac-23.1.0.zip', sha256: '1082e6638223b785ca2daf0939f13afcd0bb95c84ee9a4bbaff4745365159253' },
  linux: { asset: 'clangd-linux-23.1.0.zip', sha256: 'e53b1a96196095faedb7642cf64964f7fb9ad4a0c1f00dd2c172a3d9dcbafdfd' },
  win32: { asset: 'clangd-windows-23.1.0.zip', sha256: '23412a240756a162e7b98a282f36aa2a23a88db5ce16a0cbc4fef7253768c810' },
};

const sha256 = async (file: string) => {
  const h = crypto.createHash('sha256');
  for await (const c of fs.createReadStream(file)) h.update(c as Buffer);
  return h.digest('hex');
};

async function main() {
  const pin = PINNED[process.platform];
  if (!pin) throw new Error(`no clangd release for ${process.platform}`);
  const root = path.resolve(__dirname, '../..'), tools = path.join(root, 'tools'), dest = path.join(tools, 'clangd');
  fs.mkdirSync(tools, { recursive: true });
  let zip = process.argv[2];
  if (!zip) {
    zip = path.join(tools, pin.asset);
    const url = `https://github.com/clangd/clangd/releases/download/${CLANGD_VERSION}/${pin.asset}`;
    console.log(`downloading ${url}`);
    const res = await fetch(url, { headers: { 'User-Agent': 'SkyCodeX' } });
    if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
    await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(zip));
  }
  const got = await sha256(zip);
  if (got !== pin.sha256) throw new Error(`checksum mismatch for ${pin.asset}: expected ${pin.sha256}, got ${got}`);
  console.log('checksum ok');
  const tmp = path.join(tools, '.clangd-unpacking');
  fs.rmSync(tmp, { recursive: true, force: true });
  const stats = await extractZip(zip, tmp);
  if (stats.refused.length) throw new Error(`unsafe entries in the archive: ${stats.refused.join(', ')}`);
  const top = path.join(tmp, `clangd_${CLANGD_VERSION}`);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(top, dest);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!process.argv[2]) fs.rmSync(zip, { force: true });
  console.log(`clangd ${CLANGD_VERSION} → ${dest} (${stats.files} files)`);
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
