import type { VoroforceCell } from '../types'

export type FilmData = Record<string, string | number>
export type FilmBatch = FilmData[]
export type FilmBatches = Map<number, FilmBatch>

// A "Film" is now a game (IGDB data), the original naming is kept internally
export class Film {
  tmdbId: number // IGDB game id
  imdbId?: string // IGDB slug (used for the igdb.com link)
  title: string
  tagline?: string // developer studio(s)
  overview?: string
  genres?: string[]
  platforms?: string[]
  year: number
  rating: number
  popularity: number
  poster: string
  backdrop: string

  constructor(data: FilmData) {
    this.tmdbId = Number(data.id)
    this.imdbId = data.slug ? String(data.slug) : undefined
    this.title = String(data.title)
    this.tagline = data.developers ? String(data.developers) : undefined
    this.overview = data.overview ? String(data.overview) : undefined
    this.genres = data.genres ? String(data.genres).split(', ') : undefined
    this.platforms = data.platforms
      ? String(data.platforms).split(', ')
      : undefined
    this.year = Number(data.release_year)
    this.rating = Number(data.vote_average) * 10
    this.popularity = Number(data.popularity)
    this.poster = String(data.poster_path)
    this.backdrop = String(data.backdrop_path)
  }
}

const loadCellFilmBatch = async (batchIndex: number) => {
  const url = `${import.meta.env.VITE_FILM_INFO_BASE_URL}/${batchIndex}.json`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.log('batchIndex', batchIndex)
    console.error('Error loading JSON:', error)
  }
}

export const getCellFilm = async (
  cell: VoroforceCell,
  filmBatches: FilmBatches,
) => {
  if (!cell) return
  let filmBatch = filmBatches.get(cell.subgrid)
  if (!filmBatch) {
    filmBatch = await loadCellFilmBatch(cell.subgrid)
    filmBatches.set(cell.subgrid, filmBatch ?? [])
  }

  return filmBatch?.[cell.subgridIndex]
    ? new Film(filmBatch[cell.subgridIndex])
    : undefined
}
