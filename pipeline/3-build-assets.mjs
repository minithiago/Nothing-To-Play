// Builds every asset the voroforce engine consumes, from the raw IGDB data:
//   public/json/{n}.json          - batches of 216 games (one per 18x12 subgrid)
//   public/media/low/dds/0.dds    - 512x104 grid of 4x6 tiles   (2048x624)
//   public/media/mid/dds/{n}.dds  - 90x60  grid of 22x33 tiles  (1980x1980)
//   public/media/high/dds/{n}.dds - 18x12  grid of 110x165 tiles(1980x1980)
//   public/media/single/{i}.jpg   - 220x330 jpg per game
// Tile order is row-major from the top-left, matching the original assets.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { encodeDXT1, writeDDS } from './lib/dxt1.mjs'

const root = path.resolve(import.meta.dirname, '..')
const dataDir = path.join(import.meta.dirname, 'data')
const coversDir = path.join(dataDir, 'covers')
const jsonDir = path.join(root, 'public/json')
const mediaDir = path.join(root, 'public/media')

const BATCH = 216 // 18x12 subgrid, must match the smallest atlas layer capacity

const VERSIONS = [
  { name: 'low', dir: 'low/dds', width: 2048, height: 624, cols: 512, rows: 104, tileW: 4, tileH: 6 },
  { name: 'mid', dir: 'mid/dds', width: 1980, height: 1980, cols: 90, rows: 60, tileW: 22, tileH: 33 },
  { name: 'high', dir: 'high/dds', width: 1980, height: 1980, cols: 18, rows: 12, tileW: 110, tileH: 165 },
]

const SINGLE = { width: 220, height: 330 }

const allGames = JSON.parse(fs.readFileSync(path.join(dataDir, 'games.json'), 'utf8'))
const games = allGames.filter(
  (g) => g.cover?.image_id && fs.existsSync(path.join(coversDir, `${g.cover.image_id}.jpg`)),
)
console.log(`building assets for ${games.length} games (${allGames.length - games.length} dropped, no cover)`)

for (const v of VERSIONS) fs.mkdirSync(path.join(mediaDir, v.dir), { recursive: true })
fs.mkdirSync(path.join(mediaDir, 'single'), { recursive: true })
fs.mkdirSync(jsonDir, { recursive: true })

// ---------- JSON batches ----------
const developerNames = (g) =>
  (g.involved_companies ?? [])
    .filter((ic) => ic.developer && ic.company?.name)
    .map((ic) => ic.company.name)

const toRecord = (g) => ({
  id: g.id,
  title: g.name,
  vote_average: g.total_rating ? (g.total_rating / 10).toFixed(3) : '0',
  vote_count: g.total_rating_count ?? 0,
  overview: g.summary ?? '',
  genres: (g.genres ?? []).map((x) => x.name).join(', '),
  platforms: (g.platforms ?? [])
    .map((p) => p.abbreviation || p.name)
    .filter(Boolean)
    .join(', '),
  developers: developerNames(g).join(', '),
  release_year: g.first_release_date
    ? String(new Date(g.first_release_date * 1000).getUTCFullYear())
    : '',
  // Same shape as TMDB paths ("/xyz.jpg") so the app can just concatenate
  // them onto the IGDB image CDN base URLs
  poster_path: `/${g.cover.image_id}.jpg`,
  backdrop_path: (() => {
    const id = g.artworks?.[0]?.image_id ?? g.screenshots?.[0]?.image_id
    return id ? `/${id}.jpg` : ''
  })(),
  slug: g.slug,
  popularity: String(g.total_rating_count ?? 0),
})

for (let b = 0; b * BATCH < games.length; b++) {
  const chunk = games.slice(b * BATCH, (b + 1) * BATCH).map(toRecord)
  fs.writeFileSync(path.join(jsonDir, `${b}.json`), JSON.stringify(chunk))
}
console.log(`wrote ${Math.ceil(games.length / BATCH)} json batches`)

// ---------- Media atlases ----------
// Per-version state: current layer buffer + index, flushed when full
const state = VERSIONS.map((v) => ({
  ...v,
  perLayer: v.cols * v.rows,
  buffer: Buffer.alloc(v.width * v.height * 3),
  layerIndex: 0,
  layerCounts: [],
}))

function blit(vs, tileIndexInLayer, tileRaw) {
  const col = tileIndexInLayer % vs.cols
  const row = Math.floor(tileIndexInLayer / vs.cols)
  const dstX = col * vs.tileW
  const dstY = row * vs.tileH
  for (let y = 0; y < vs.tileH; y++) {
    const src = y * vs.tileW * 3
    const dst = ((dstY + y) * vs.width + dstX) * 3
    tileRaw.copy(vs.buffer, dst, src, src + vs.tileW * 3)
  }
}

function flushLayer(vs) {
  const blocks = encodeDXT1(vs.buffer, vs.width, vs.height, 3)
  const dds = writeDDS(blocks, vs.width, vs.height)
  fs.writeFileSync(path.join(mediaDir, vs.dir, `${vs.layerIndex}.dds`), dds)
  vs.buffer.fill(0)
  vs.layerIndex++
}

const CONCURRENCY = 12
let nextIndex = 0
let processed = 0

// Phase 1: resize every cover into per-tier raw tiles + the single jpg.
// Results are blitted in order (blitting itself is cheap and sync-safe
// because each game writes to a disjoint region).
const pending = new Map()

async function processGame(i) {
  const g = games[i]
  const coverPath = path.join(coversDir, `${g.cover.image_id}.jpg`)
  const base = sharp(coverPath).removeAlpha()

  const [tiles, single] = await Promise.all([
    Promise.all(
      state.map((vs) =>
        base
          .clone()
          .resize(vs.tileW, vs.tileH, { fit: 'cover', position: 'centre' })
          .raw()
          .toBuffer(),
      ),
    ),
    base
      .clone()
      .resize(SINGLE.width, SINGLE.height, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer(),
  ])

  return { tiles, single }
}

async function worker() {
  while (nextIndex < games.length) {
    const i = nextIndex++
    pending.set(i, await processGame(i))
  }
}

async function consumer() {
  for (let i = 0; i < games.length; i++) {
    while (!pending.has(i)) await new Promise((r) => setTimeout(r, 5))
    const { tiles, single } = pending.get(i)
    pending.delete(i)

    fs.writeFileSync(path.join(mediaDir, 'single', `${i}.jpg`), single)

    state.forEach((vs, vi) => {
      blit(vs, i % vs.perLayer, tiles[vi])
      if ((i + 1) % vs.perLayer === 0) flushLayer(vs)
    })

    processed++
    if (processed % 200 === 0) process.stdout.write(`\r${processed}/${games.length}`)
  }
  // flush partial layers
  for (const vs of state) {
    if (games.length % vs.perLayer !== 0) flushLayer(vs)
  }
}

await Promise.all([...Array.from({ length: CONCURRENCY }, worker), consumer()])
console.log('\natlases written')

// ---------- Env layer counts ----------
const envPath = path.join(root, '.env.local')
const layers = {
  VITE_MEDIA_VERSION_0_LAYERS: Math.ceil(games.length / (512 * 104)),
  VITE_MEDIA_VERSION_1_LAYERS: Math.ceil(games.length / 5400),
  VITE_MEDIA_VERSION_2_LAYERS: Math.ceil(games.length / 216),
  VITE_GAME_COUNT: games.length,
}
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
for (const [key, value] of Object.entries(layers)) {
  const line = `${key}=${value}`
  env = env.match(new RegExp(`^${key}=.*$`, 'm'))
    ? env.replace(new RegExp(`^${key}=.*$`, 'm'), line)
    : `${env.trimEnd()}\n${line}\n`
}
fs.writeFileSync(envPath, env)
console.log('updated .env.local:', layers)
