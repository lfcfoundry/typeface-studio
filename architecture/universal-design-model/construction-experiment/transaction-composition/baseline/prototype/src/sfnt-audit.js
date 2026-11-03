const REQUIRED = ['cmap','head','hhea','hmtx','maxp','name','OS/2','post','glyf','loca'];
const wholeFontMagic = 0xB1B0AFBA;

function checksum(bytes, offset = 0, length = bytes.length - offset, zeroHeadAdjustment = false) {
  let sum = 0;
  for (let i = 0; i < length; i += 4) {
    let word = 0;
    const count = Math.min(4, length - i);
    for (let j = 0; j < count; j++) {
      const pos = i + j;
      const masked = zeroHeadAdjustment && pos >= 8 && pos < 12 ? 0 : bytes[offset + pos];
      word = (word * 256 + masked) >>> 0;
    }
    for (let j = count; j < 4; j++) word = (word * 256) >>> 0;
    sum = (sum + word) >>> 0;
  }
  return sum >>> 0;
}

export function auditSfnt(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12 || view.getUint32(0) !== 0x00010000) throw new Error('The binary is not a TrueType-outline SFNT.');
  const count = view.getUint16(4), tables = {};
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(...bytes.subarray(at, at + 4));
    const expected = view.getUint32(at + 4), offset = view.getUint32(at + 8), length = view.getUint32(at + 12);
    if (offset + length > bytes.length) throw new Error(`Table ${tag} exceeds the TTF byte range.`);
    tables[tag] = { expected, offset, length, actual: checksum(bytes, offset, length, tag === 'head') };
  }
  const missing = REQUIRED.filter(tag => !tables[tag]);
  const badChecksums = Object.entries(tables).filter(([, t]) => t.expected !== t.actual).map(([tag]) => tag);
  const wholeChecksum = checksum(bytes);
  const numGlyphs = tables.maxp ? view.getUint16(tables.maxp.offset + 4) : 0;
  const cmap = cmapFormat4(bytes, tables.cmap);
  const horizontalMetrics = readHorizontalMetrics(bytes, tables.hhea, tables.hmtx, numGlyphs);
  const metadata = readCoreMetadata(bytes, tables);
  return {
    signature: 'TrueType outlines', tables: Object.keys(tables), missingTables: missing,
    badTableChecksums: badChecksums, wholeChecksum,
    wholeChecksumValid: wholeChecksum === wholeFontMagic,
    numGlyphs, cmap, horizontalMetrics, metadata,
    valid: missing.length === 0 && badChecksums.length === 0 && wholeChecksum === wholeFontMagic && numGlyphs > 0 && horizontalMetrics.errors.length === 0 && metadata.errors.length === 0
  };
}

function readCoreMetadata(bytes, tables) {
  const errors = [], v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const head = tables.head, hhea = tables.hhea, os2 = tables['OS/2'];
  if (!head || head.length < 20) errors.push('head is missing required unit metadata.');
  if (!hhea || hhea.length < 8) errors.push('hhea is missing ascender/descender metadata.');
  if (!os2 || os2.length < 6) errors.push('OS/2 is missing weight-class metadata.');
  const result = {
    unitsPerEm: head && head.length >= 20 ? v.getUint16(head.offset + 18) : 0,
    ascender: hhea && hhea.length >= 8 ? v.getInt16(hhea.offset + 4) : 0,
    descender: hhea && hhea.length >= 8 ? v.getInt16(hhea.offset + 6) : 0,
    weightClass: os2 && os2.length >= 6 ? v.getUint16(os2.offset + 4) : 0,
    errors
  };
  if (result.unitsPerEm < 16 || result.unitsPerEm > 16384) errors.push('head.unitsPerEm is outside the permitted range.');
  if (result.weightClass < 1 || result.weightClass > 1000) errors.push('OS/2.usWeightClass is outside the permitted range.');
  return result;
}

function readHorizontalMetrics(bytes, hhea, hmtx, numGlyphs) {
  const errors = [];
  if (!hhea || hhea.length < 36 || !hmtx) return { count: 0, metrics: [], errors: ['hhea/hmtx data is missing or truncated.'] };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(hhea.offset + 34);
  if (!count || count > numGlyphs) errors.push('hhea.numberOfHMetrics must be between 1 and maxp.numGlyphs.');
  const requiredLength = count * 4 + Math.max(0, numGlyphs - count) * 2;
  if (hmtx.length < requiredLength) errors.push('hmtx is too short for the hhea/maxp glyph counts.');
  const metrics = [];
  const safeCount = Math.min(count, numGlyphs);
  let lastAdvance = 0;
  for (let i = 0; i < numGlyphs; i++) {
    if (i < safeCount) {
      const at = hmtx.offset + i * 4;
      if (at + 4 > hmtx.offset + hmtx.length) break;
      lastAdvance = view.getUint16(at);
      metrics.push({ advanceWidth: lastAdvance, leftSideBearing: view.getInt16(at + 2) });
    } else {
      const at = hmtx.offset + safeCount * 4 + (i - safeCount) * 2;
      if (at + 2 > hmtx.offset + hmtx.length) break;
      metrics.push({ advanceWidth: lastAdvance, leftSideBearing: view.getInt16(at) });
    }
  }
  if (metrics.length !== numGlyphs) errors.push(`hmtx exposes ${metrics.length} metrics for ${numGlyphs} glyphs.`);
  return { count, metrics, errors };
}

function cmapFormat4(bytes, table) {
  if (!table) return { format: null, glyphIndex: () => 0 };
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), base = table.offset;
  const records = v.getUint16(base + 2);
  let sub = null;
  for (let i = 0; i < records; i++) {
    const r = base + 4 + i * 8, platform = v.getUint16(r), encoding = v.getUint16(r + 2), offset = v.getUint32(r + 4);
    const candidate = base + offset;
    if (v.getUint16(candidate) === 4 && (platform === 3 || platform === 0) && (platform === 0 || encoding === 1 || encoding === 10)) { sub = candidate; break; }
  }
  if (sub === null) return { format: null, glyphIndex: () => 0 };
  const segCount = v.getUint16(sub + 6) / 2;
  const endBase = sub + 14, startBase = endBase + 2 * segCount + 2;
  const deltaBase = startBase + 2 * segCount, rangeBase = deltaBase + 2 * segCount;
  const glyphIndex = code => {
    if (code > 0xffff) return 0;
    for (let i = 0; i < segCount; i++) {
      const end = v.getUint16(endBase + i * 2), start = v.getUint16(startBase + i * 2);
      if (code < start || code > end) continue;
      const delta = v.getInt16(deltaBase + i * 2), range = v.getUint16(rangeBase + i * 2);
      if (range === 0) return (code + delta) & 0xffff;
      const address = rangeBase + i * 2 + range + 2 * (code - start);
      const glyph = v.getUint16(address);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
  return { format: 4, glyphIndex };
}

export { REQUIRED as REQUIRED_SFNT_TABLES };
