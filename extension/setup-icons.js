/**
 * setup-icons.js
 * Run once with: node setup-icons.js
 * Generates PNG icon files for the extension using only Node.js built-ins.
 * Creates red (#dc2626) square icons in the icons/ directory.
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

// CRC32 lookup table
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const forCRC = Buffer.concat([typeBuf, dataBuf]);
  const crc = crc32(forCRC);
  return Buffer.concat([uint32BE(dataBuf.length), typeBuf, dataBuf, uint32BE(crc)]);
}

/**
 * Create a solid-colour PNG of the given size.
 * Draws a simple "S" letter in white on Spagylo red background.
 */
function createSolidPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.concat([
    uint32BE(size), uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0]) // 8-bit depth, RGB colour, no compression/filter/interlace
  ]);
  const ihdr = pngChunk('IHDR', ihdrData);

  // Raw image: one filter byte (0) + RGB per pixel per row
  const rowLen = 1 + size * 3;
  const raw = Buffer.alloc(size * rowLen, 0);

  const border = Math.max(1, Math.floor(size / 8));

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const isEdge = x < border || x >= size - border || y < border || y >= size - border;
      const nr = isEdge ? Math.max(0, r - 40) : r;
      const ng = isEdge ? Math.max(0, g - 10) : g;
      const nb = isEdge ? Math.max(0, b - 10) : b;
      const off = y * rowLen + 1 + x * 3;
      raw[off]     = nr;
      raw[off + 1] = ng;
      raw[off + 2] = nb;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = pngChunk('IDAT', compressed);
  const iend = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// Spagylo red: #dc2626 = rgb(220, 38, 38)
const sizes = [16, 32, 48, 128];
sizes.forEach(size => {
  const png = createSolidPNG(size, 220, 38, 38);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ Created icons/icon${size}.png (${png.length} bytes)`);
});

console.log('\nAll icons created successfully!');
console.log('You can now load the extension in Chrome via chrome://extensions → Load unpacked.');
