const fs = require('fs');
const path = require('path');

const svgContent = fs.readFileSync(path.join(__dirname, '../public/u.svg'), 'utf8');
const match = svgContent.match(/href="data:image\/png;base64,([^"]+)"/);

if (!match) {
  console.error('Could not find base64 png in u.svg');
  process.exit(1);
}

const buf = Buffer.from(match[1], 'base64');
const buildDir = path.join(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

fs.writeFileSync(path.join(buildDir, 'icon.png'), buf);
fs.writeFileSync(path.join(__dirname, '../public/icon.png'), buf);
console.log('Successfully saved icon.png! Length:', buf.length);

function createIcoFromPng(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // 0 means 256px width
  entry.writeUInt8(0, 1); // 0 means 256px height
  entry.writeUInt8(0, 2); // colors
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image data size
  entry.writeUInt32LE(22, 12); // offset (6 header + 16 entry = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

const icoBuf = createIcoFromPng(buf);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuf);
fs.writeFileSync(path.join(__dirname, '../public/favicon.ico'), icoBuf);
console.log('Successfully generated build/icon.ico! Total size:', icoBuf.length);
