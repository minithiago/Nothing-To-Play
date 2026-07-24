// Downloads cover art (t_cover_big, 264x374) for every game in
// pipeline/data/games.json into pipeline/data/covers/{image_id}.jpg.
// Skips files that already exist, so it can be resumed freely.
import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.join(import.meta.dirname, 'data')
const coversDir = path.join(dataDir, 'covers')
fs.mkdirSync(coversDir, { recursive: true })

const games = JSON.parse(fs.readFileSync(path.join(dataDir, 'games.json'), 'utf8'))
const CONCURRENCY = 8

const queue = games
  .map((g) => g.cover?.image_id)
  .filter(Boolean)
  .filter((id) => !fs.existsSync(path.join(coversDir, `${id}.jpg`)))

console.log(`${queue.length} covers to download (${games.length - queue.length} cached)`)

let done = 0
let failed = 0

async function download(imageId, attempt = 0) {
  const url = `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(path.join(coversDir, `${imageId}.jpg`), buf)
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      return download(imageId, attempt + 1)
    }
    failed++
    console.error(`\nfailed: ${imageId} (${err.message})`)
  } finally {
    done++
    if (done % 50 === 0 || done === queue.length)
      process.stdout.write(`\r${done}/${queue.length}`)
  }
}

async function worker() {
  while (queue.length > 0) await download(queue.pop())
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
console.log(`\ndone (${failed} failed)`)
