// Fetches the top-rated/most-reviewed games from IGDB and stores raw data
// in pipeline/data/games.json, sorted by number of ratings (descending),
// so the most recognizable games end up in the center of the lattice.
import fs from 'node:fs'
import path from 'node:path'
import { createIgdbClient } from './lib/igdb.mjs'

const TOTAL = Number(process.env.GAMES_TOTAL ?? 10000)
const PAGE = 500 // IGDB max page size

const dataDir = path.join(import.meta.dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })

const { query } = await createIgdbClient()

const fields = [
  'id',
  'name',
  'slug',
  'summary',
  'total_rating',
  'total_rating_count',
  'first_release_date',
  'genres.name',
  'platforms.abbreviation',
  'platforms.name',
  'cover.image_id',
  'artworks.image_id',
  'screenshots.image_id',
  'involved_companies.company.name',
  'involved_companies.developer',
].join(',')

const games = []
for (let offset = 0; games.length < TOTAL; offset += PAGE) {
  const batch = await query(
    'games',
    `fields ${fields};
     where cover != null & total_rating_count != null & version_parent = null & parent_game = null;
     sort total_rating_count desc;
     limit ${PAGE};
     offset ${offset};`,
  )
  if (batch.length === 0) break
  games.push(...batch)
  process.stdout.write(`\rfetched ${games.length}`)
}
console.log()

const trimmed = games.slice(0, TOTAL)
fs.writeFileSync(path.join(dataDir, 'games.json'), JSON.stringify(trimmed))
console.log(`saved ${trimmed.length} games to pipeline/data/games.json`)
