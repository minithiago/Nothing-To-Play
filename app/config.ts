const env = import.meta.env as unknown as {
  VITE_TELEMETRY_ENABLED?: string
  VITE_TELEMETRY_ENDPOINT?: string
  VITE_APP_VERSION?: string
}

export default {
  backdropBaseUrl: 'https://images.igdb.com/igdb/image/upload/t_1080p',
  posterBaseUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big',
  sourceCodeUrl: 'https://github.com/minithiago/nothing-to-play',
  tmdbUrl: 'https://www.igdb.com',
  tmdbFilmBaseUrl: 'https://www.igdb.com/games/',
  imdbFilmBaseUrl: 'https://www.igdb.com/games/',
  contactEmail: 'ivanind04@gmail.com',
  disableUI: false,
  telemetry: {
    enabled:
      env?.VITE_TELEMETRY_ENABLED === '1' ||
      env?.VITE_TELEMETRY_ENABLED === 'true',
    endpoint: env?.VITE_TELEMETRY_ENDPOINT || undefined,
    appVersion: env?.VITE_APP_VERSION || undefined,
  },
}
