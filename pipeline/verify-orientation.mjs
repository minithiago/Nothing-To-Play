// Decodes tile (row 0, col 0) of public/media/mid/dds/0.dds (DXT1) to PNG
// so we can compare orientation against public/media/single/0.jpg
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const buf = fs.readFileSync(path.join(root, 'public/media/mid/dds/0.dds'))

const header = new Int32Array(buf.buffer, buf.byteOffset, 32)
if (header[0] !== 0x20534444) throw new Error('not a DDS')
const height = header[3]
const width = header[4]
console.log('dds size', width, 'x', height)

const data = buf.subarray(128)
const blocksPerRow = width / 4

function decodeDXT1Block(offset, out, bx, by) {
  const c0 = data[offset] | (data[offset + 1] << 8)
  const c1 = data[offset + 2] | (data[offset + 3] << 8)
  const colors = []
  const expand = (c) => [
    ((c >> 11) & 31) * 255 / 31,
    ((c >> 5) & 63) * 255 / 63,
    (c & 31) * 255 / 31,
  ]
  const [r0, g0, b0] = expand(c0)
  const [r1, g1, b1] = expand(c1)
  colors[0] = [r0, g0, b0]
  colors[1] = [r1, g1, b1]
  if (c0 > c1) {
    colors[2] = [(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3]
    colors[3] = [(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3]
  } else {
    colors[2] = [(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2]
    colors[3] = [0, 0, 0]
  }
  for (let py = 0; py < 4; py++) {
    const bits = data[offset + 4 + py]
    for (let px = 0; px < 4; px++) {
      const ci = (bits >> (px * 2)) & 3
      const x = bx * 4 + px
      const y = by * 4 + py
      const di = (y * width + x) * 3
      out[di] = colors[ci][0]
      out[di + 1] = colors[ci][1]
      out[di + 2] = colors[ci][2]
    }
  }
}

const out = Buffer.alloc(width * height * 3)
const blocksPerCol = height / 4
for (let by = 0; by < blocksPerCol; by++) {
  for (let bx = 0; bx < blocksPerRow; bx++) {
    decodeDXT1Block((by * blocksPerRow + bx) * 8, out, bx, by)
  }
}

// mid grid: 90 cols x 60 rows, tile 22x33
const tileW = 22
const tileH = 33
const img = sharp(out, { raw: { width, height, channels: 3 } })
await img
  .clone()
  .extract({ left: 0, top: 0, width: tileW, height: tileH })
  .resize(220, 330, { kernel: 'nearest' })
  .png()
  .toFile('tile-top-left.png')
await img
  .clone()
  .extract({ left: 0, top: height - tileH, width: tileW, height: tileH })
  .resize(220, 330, { kernel: 'nearest' })
  .png()
  .toFile('tile-bottom-left.png')
console.log('wrote tile-top-left.png and tile-bottom-left.png')
