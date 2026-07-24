// Fast DXT1 (BC1) encoder: per-block color bounding box + inset, then
// nearest-palette index mapping. Quality is more than enough for the tiny
// atlas tiles and it runs orders of magnitude faster than cluster-fit
// encoders, with zero native dependencies.

function to565(r, g, b) {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
}

function from565(c) {
  const r = ((c >> 11) & 31) * 8.2258
  const g = ((c >> 5) & 63) * 4.0476
  const b = (c & 31) * 8.2258
  return [r, g, b]
}

/**
 * Encodes an RGB(A) image to raw DXT1 block data.
 * @param {Uint8Array} pixels - raw pixel data, row-major, top-left origin
 * @param {number} width - multiple of 4
 * @param {number} height - multiple of 4
 * @param {number} channels - 3 or 4
 * @returns {Buffer} DXT1 block data (width*height/2 bytes)
 */
export function encodeDXT1(pixels, width, height, channels = 3) {
  const out = Buffer.alloc((width * height) / 2)
  const bw = width / 4
  const bh = height / 4
  let o = 0

  const blockR = new Uint8Array(16)
  const blockG = new Uint8Array(16)
  const blockB = new Uint8Array(16)

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let minR = 255
      let minG = 255
      let minB = 255
      let maxR = 0
      let maxG = 0
      let maxB = 0

      for (let py = 0; py < 4; py++) {
        let idx = ((by * 4 + py) * width + bx * 4) * channels
        for (let px = 0; px < 4; px++) {
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]
          const i = py * 4 + px
          blockR[i] = r
          blockG[i] = g
          blockB[i] = b
          if (r < minR) minR = r
          if (g < minG) minG = g
          if (b < minB) minB = b
          if (r > maxR) maxR = r
          if (g > maxG) maxG = g
          if (b > maxB) maxB = b
          idx += channels
        }
      }

      // Inset the bounding box by 1/16th to reduce quantization error
      const insR = (maxR - minR) >> 4
      const insG = (maxG - minG) >> 4
      const insB = (maxB - minB) >> 4
      minR += insR
      minG += insG
      minB += insB
      maxR -= insR
      maxG -= insG
      maxB -= insB

      let c0 = to565(maxR, maxG, maxB)
      let c1 = to565(minR, minG, minB)

      if (c0 === c1) {
        // Flat block: both endpoints equal, all indices 0
        out.writeUInt16LE(c0, o)
        out.writeUInt16LE(c1, o + 2)
        out.writeUInt32LE(0, o + 4)
        o += 8
        continue
      }
      if (c0 < c1) {
        const t = c0
        c0 = c1
        c1 = t
      }

      // Palette (4-color mode since c0 > c1)
      const [r0, g0, b0] = from565(c0)
      const [r1, g1, b1] = from565(c1)
      const palR = [r0, r1, (2 * r0 + r1) / 3, (r0 + 2 * r1) / 3]
      const palG = [g0, g1, (2 * g0 + g1) / 3, (g0 + 2 * g1) / 3]
      const palB = [b0, b1, (2 * b0 + b1) / 3, (b0 + 2 * b1) / 3]

      let indices = 0
      for (let i = 15; i >= 0; i--) {
        const r = blockR[i]
        const g = blockG[i]
        const b = blockB[i]
        let best = 0
        let bestDist = Number.POSITIVE_INFINITY
        for (let p = 0; p < 4; p++) {
          const dr = r - palR[p]
          const dg = g - palG[p]
          const db = b - palB[p]
          const dist = dr * dr + dg * dg + db * db
          if (dist < bestDist) {
            bestDist = dist
            best = p
          }
        }
        indices = ((indices << 2) | best) >>> 0
      }

      out.writeUInt16LE(c0, o)
      out.writeUInt16LE(c1, o + 2)
      out.writeUInt32LE(indices, o + 4)
      o += 8
    }
  }

  return out
}

/**
 * Wraps raw DXT1 block data in a minimal 128-byte DDS header
 * (single mip level, matching what the voroforce loader expects).
 */
export function writeDDS(blockData, width, height) {
  const header = Buffer.alloc(128)
  header.writeUInt32LE(0x20534444, 0) // 'DDS '
  header.writeUInt32LE(124, 4) // header size
  header.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000 | 0x80000, 8) // caps|height|width|pixelformat|linearsize
  header.writeUInt32LE(height, 12)
  header.writeUInt32LE(width, 16)
  header.writeUInt32LE(blockData.length, 20) // linear size
  header.writeUInt32LE(0, 24) // depth
  header.writeUInt32LE(0, 28) // mipmap count
  // pixel format (offset 76)
  header.writeUInt32LE(32, 76) // pf size
  header.writeUInt32LE(0x4, 80) // DDPF_FOURCC
  header.write('DXT1', 84)
  header.writeUInt32LE(0x1000, 108) // caps: DDSCAPS_TEXTURE
  return Buffer.concat([header, blockData])
}
