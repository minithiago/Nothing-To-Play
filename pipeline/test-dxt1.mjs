// Round-trip test: encode single/0.jpg to DXT1/DDS, decode it back with the
// same logic the voroforce loader/GPU uses, and dump a PNG for visual check.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { encodeDXT1, writeDDS } from './lib/dxt1.mjs'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'public/media/single/0.jpg')

const W = 220
const H = 332 // multiple of 4 for the test
const raw = await sharp(src).resize(W, H, { fit: 'cover' }).removeAlpha().raw().toBuffer()

console.time('encode')
const blocks = encodeDXT1(raw, W, H, 3)
console.timeEnd('encode')

const dds = writeDDS(blocks, W, H)
// header sanity checks (mirrors the voroforce loader)
const header = new Int32Array(dds.buffer, dds.byteOffset, 31)
if (header[0] !== 0x20534444) throw new Error('bad magic')
if (header[3] !== H || header[4] !== W) throw new Error('bad dims')
if (!(header[20] & 0x4)) throw new Error('bad pf flags')
if (header[21] !== 0x31545844) throw new Error('bad fourCC')
const expectedSize = ((Math.max(4, W) / 4) * Math.max(4, H) / 4) * 8
if (dds.length - 128 !== expectedSize) throw new Error('bad size')
console.log('header OK, block data', dds.length - 128, 'bytes')

// decode
const out = Buffer.alloc(W * H * 3)
const data = dds.subarray(128)
const bpr = W / 4
for (let by = 0; by < H / 4; by++) {
  for (let bx = 0; bx < bpr; bx++) {
    const o = (by * bpr + bx) * 8
    const c0 = data[o] | (data[o + 1] << 8)
    const c1 = data[o + 2] | (data[o + 3] << 8)
    const exp = (c) => [((c >> 11) & 31) * 255 / 31, ((c >> 5) & 63) * 255 / 63, (c & 31) * 255 / 31]
    const cols = [exp(c0), exp(c1)]
    if (c0 > c1) {
      cols[2] = cols[0].map((v, i) => (2 * v + cols[1][i]) / 3)
      cols[3] = cols[0].map((v, i) => (v + 2 * cols[1][i]) / 3)
    } else {
      cols[2] = cols[0].map((v, i) => (v + cols[1][i]) / 2)
      cols[3] = [0, 0, 0]
    }
    for (let py = 0; py < 4; py++) {
      const bits = data[o + 4 + py]
      for (let px = 0; px < 4; px++) {
        const ci = (bits >> (px * 2)) & 3
        const di = ((by * 4 + py) * W + bx * 4 + px) * 3
        out[di] = cols[ci][0]
        out[di + 1] = cols[ci][1]
        out[di + 2] = cols[ci][2]
      }
    }
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile('test-roundtrip.png')
console.log('wrote test-roundtrip.png')
