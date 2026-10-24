// Reads section and symbol tables from ELF, Mach-O and PE binaries for the memory view.
export type Kind = 'code' | 'rodata' | 'data' | 'bss' | 'other';

export interface Section { name: string; size: number; fileSize: number; kind: Kind }
export interface Sym { name: string; addr: number; size: number; kind: Kind }
export interface BinaryInfo {
  format: 'ELF' | 'Mach-O' | 'PE';
  arch: string;
  sections: Section[];
  symbols: Sym[];
  symbolSizesExact: boolean;   // false for Mach-O (derived from address gaps) and PE (no symbols)
  note?: string;
}

const u64 = (b: Buffer, o: number, le: boolean) => Number(le ? b.readBigUInt64LE(o) : b.readBigUInt64BE(o));
const cstr = (b: Buffer, o: number, max = 1 << 16) => { let e = o; while (e < b.length && e - o < max && b[e] !== 0) e++; return b.toString('latin1', o, e); };

export function parseBinary(b: Buffer): BinaryInfo {
  if (b.length >= 4 && b.readUInt32BE(0) === 0x7f454c46) return parseElf(b);
  const m = b.length >= 4 ? b.readUInt32LE(0) : 0;
  if (m === 0xfeedfacf || m === 0xfeedface) return parseMachO(b, 0);
  if (b.length >= 4 && (b.readUInt32BE(0) === 0xcafebabe || b.readUInt32BE(0) === 0xcafebabf)) return parseFat(b);
  if (b.length >= 64 && b.toString('latin1', 0, 2) === 'MZ') return parsePe(b);
  throw new Error('not an ELF, Mach-O or PE file');
}

// ---------- ELF ----------
function parseElf(b: Buffer): BinaryInfo {
  const is64 = b[4] === 2, le = b[5] === 1;
  const r16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const r32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const machine = r16(18);
  const shoff = is64 ? u64(b, 0x28, le) : r32(0x20);
  const shentsize = r16(is64 ? 0x3a : 0x2e), shnum = r16(is64 ? 0x3c : 0x30), shstrndx = r16(is64 ? 0x3e : 0x32);
  type SH = { name: number; type: number; flags: number; addr: number; off: number; size: number; link: number; entsize: number };
  const sh: SH[] = [];
  for (let i = 0; i < shnum; i++) {
    const o = shoff + i * shentsize;
    sh.push(is64
      ? { name: r32(o), type: r32(o + 4), flags: u64(b, o + 8, le), addr: u64(b, o + 16, le), off: u64(b, o + 24, le), size: u64(b, o + 32, le), link: r32(o + 40), entsize: u64(b, o + 56, le) }
      : { name: r32(o), type: r32(o + 4), flags: r32(o + 8), addr: r32(o + 12), off: r32(o + 16), size: r32(o + 20), link: r32(o + 24), entsize: r32(o + 36) });
  }
  const strs = sh[shstrndx];
  const kindOf = (s: SH): Kind => {
    if (!(s.flags & 2)) return 'other';                // not loaded
    if (s.flags & 4) return 'code';
    if (s.flags & 1) return s.type === 8 ? 'bss' : 'data';
    return 'rodata';
  };
  const sections: Section[] = sh.map((s) => ({ name: strs ? cstr(b, strs.off + s.name) : '', size: s.size, fileSize: s.type === 8 ? 0 : s.size, kind: kindOf(s) }))
    .filter((s, i) => i > 0 && s.kind !== 'other');
  const symbols: Sym[] = [];
  const symtab = sh.find((s) => s.type === 2) ?? sh.find((s) => s.type === 11);
  if (symtab) {
    const str = sh[symtab.link], es = symtab.entsize || (is64 ? 24 : 16);
    for (let o = symtab.off; o + es <= symtab.off + symtab.size; o += es) {
      const name = cstr(b, str.off + r32(o));
      const info = is64 ? b[o + 4] : b[o + 12], shndx = r16(is64 ? o + 6 : o + 14);
      const value = is64 ? u64(b, o + 8, le) : r32(o + 4), size = is64 ? u64(b, o + 16, le) : r32(o + 8);
      const type = info & 0xf;
      if (!name || size === 0 || (type !== 1 && type !== 2) || shndx === 0 || shndx >= 0xff00) continue;
      symbols.push({ name, addr: value, size, kind: kindOf(sh[shndx]) });
    }
  }
  const arch = ({ 3: 'x86', 62: 'x86-64', 40: 'ARM', 183: 'AArch64', 243: 'RISC-V' } as Record<number, string>)[machine] ?? `machine ${machine}`;
  return { format: 'ELF', arch, sections, symbols, symbolSizesExact: true };
}

// ---------- Mach-O ----------
const CPU: Record<number, string> = { 0x0100000c: 'arm64', 0x01000007: 'x86-64', 12: 'arm', 7: 'x86' };

function parseFat(b: Buffer): BinaryInfo {
  const n = b.readUInt32BE(4), wide = b.readUInt32BE(0) === 0xcafebabf;
  const want = process.arch === 'arm64' ? 0x0100000c : 0x01000007;
  let pick = -1, first = -1;
  for (let i = 0; i < n; i++) {
    const o = 8 + i * (wide ? 32 : 20);
    const cpu = b.readUInt32BE(o), off = wide ? Number(b.readBigUInt64BE(o + 8)) : b.readUInt32BE(o + 8);
    if (first < 0) first = off;
    if (cpu === want) pick = off;
  }
  const info = parseMachO(b, pick >= 0 ? pick : first);
  info.note = `universal binary — showing ${info.arch}`;
  return info;
}

function parseMachO(b: Buffer, base: number): BinaryInfo {
  const is64 = b.readUInt32LE(base) === 0xfeedfacf;
  const cpu = b.readUInt32LE(base + 4), ncmds = b.readUInt32LE(base + 16);
  let o = base + (is64 ? 32 : 28);
  const sections: (Section & { addr: number; idx: number })[] = [];
  let symoff = 0, nsyms = 0, stroff = 0;
  for (let c = 0; c < ncmds; c++) {
    const cmd = b.readUInt32LE(o), size = b.readUInt32LE(o + 4);
    if (cmd === 0x19 || cmd === 0x1) {              // LC_SEGMENT_64 / LC_SEGMENT
      const seg = cstr(b, o + 8, 16);
      const nsects = b.readUInt32LE(o + (is64 ? 64 : 48));
      let s = o + (is64 ? 72 : 56);
      for (let i = 0; i < nsects; i++) {
        const sect = cstr(b, s, 16);
        const addr = is64 ? Number(b.readBigUInt64LE(s + 32)) : b.readUInt32LE(s + 32);
        const sz = is64 ? Number(b.readBigUInt64LE(s + 40)) : b.readUInt32LE(s + 36);
        const flags = b.readUInt32LE(s + (is64 ? 64 : 56));
        const type = flags & 0xff, zerofill = type === 0x1 || type === 0xc || type === 0x12;
        let kind: Kind;
        if (zerofill) kind = 'bss';
        else if (flags & 0x80000000 || flags & 0x400) kind = 'code';      // S_ATTR_PURE_INSTRUCTIONS / SOME_INSTRUCTIONS
        else if (seg === '__DATA' || seg === '__DATA_DIRTY') kind = 'data';
        else if (seg === '__TEXT' || seg === '__DATA_CONST' || seg === '__AUTH_CONST') kind = 'rodata';
        else kind = 'other';
        sections.push({ name: `${seg},${sect}`, size: sz, fileSize: zerofill ? 0 : sz, kind, addr, idx: sections.length + 1 });
        s += is64 ? 80 : 68;
      }
    } else if (cmd === 0x2) {                       // LC_SYMTAB
      symoff = b.readUInt32LE(o + 8); nsyms = b.readUInt32LE(o + 12); stroff = b.readUInt32LE(o + 16);
    }
    o += size;
  }
  // Mach-O symbols carry no size: derive it from the next symbol in the same section.
  const raw: { name: string; addr: number; sect: number }[] = [];
  const es = is64 ? 16 : 12;
  for (let i = 0; i < nsyms; i++) {
    const p = base + symoff + i * es;
    const type = b[p + 4], sect = b[p + 5];
    if (type & 0xe0 || (type & 0x0e) !== 0x0e || !sect) continue;   // skip debug entries; keep N_SECT
    const addr = is64 ? Number(b.readBigUInt64LE(p + 8)) : b.readUInt32LE(p + 8);
    raw.push({ name: cstr(b, base + stroff + b.readUInt32LE(p)), addr, sect });
  }
  raw.sort((a, c) => a.addr - c.addr);
  const symbols: Sym[] = [];
  raw.forEach((s, i) => {
    const sec = sections[s.sect - 1];
    if (!sec || sec.kind === 'other') return;
    const next = raw.slice(i + 1).find((n) => n.sect === s.sect && n.addr > s.addr);
    const end = next ? next.addr : sec.addr + sec.size;
    if (end > s.addr) symbols.push({ name: s.name.startsWith('_') ? s.name.slice(1) : s.name, addr: s.addr, size: end - s.addr, kind: sec.kind });
  });
  return { format: 'Mach-O', arch: CPU[cpu] ?? `cpu ${cpu.toString(16)}`, sections: sections.filter((s) => s.kind !== 'other').map(({ name, size, fileSize, kind }) => ({ name, size, fileSize, kind })), symbols, symbolSizesExact: false };
}

// ---------- PE ----------
function parsePe(b: Buffer): BinaryInfo {
  const pe = b.readUInt32LE(0x3c);
  const machine = b.readUInt16LE(pe + 4), nsec = b.readUInt16LE(pe + 6), optSize = b.readUInt16LE(pe + 20);
  let o = pe + 24 + optSize;
  const sections: Section[] = [];
  for (let i = 0; i < nsec; i++, o += 40) {
    const name = b.toString('latin1', o, o + 8).replace(/\0.*$/, '');
    const vsize = b.readUInt32LE(o + 8), raw = b.readUInt32LE(o + 16), ch = b.readUInt32LE(o + 36);
    let kind: Kind = 'rodata';
    if (ch & 0x20) kind = 'code';
    else if (ch & 0x80) kind = 'bss';
    else if (ch & 0x80000000) kind = raw === 0 ? 'bss' : 'data';
    if (ch & 0x02000000) kind = 'other';            // discardable (relocations, debug)
    sections.push({ name, size: Math.max(vsize, raw), fileSize: kind === 'bss' ? 0 : raw, kind });
  }
  const arch = ({ 0x8664: 'x86-64', 0xaa64: 'arm64', 0x14c: 'x86' } as Record<number, string>)[machine] ?? `machine ${machine.toString(16)}`;
  return { format: 'PE', arch, sections: sections.filter((s) => s.kind !== 'other'), symbols: [], symbolSizesExact: false, note: 'Windows images carry no symbol sizes; per-symbol sizes need a linker map (/MAP).' };
}

// ---------- totals ----------
export interface Totals { storage: number; ram: number; byKind: Record<Kind, number> }

/** storage = what the image occupies (code, constants, initial data); RAM = data + zero-initialised data. */
export function totals(info: BinaryInfo): Totals {
  const byKind: Record<Kind, number> = { code: 0, rodata: 0, data: 0, bss: 0, other: 0 };
  for (const s of info.sections) byKind[s.kind] += s.kind === 'bss' ? s.size : s.fileSize;
  return { storage: byKind.code + byKind.rodata + byKind.data, ram: byKind.data + byKind.bss, byKind };
}
