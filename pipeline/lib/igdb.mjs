import { loadEnv } from './env.mjs'

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const API_URL = 'https://api.igdb.com/v4'

export async function createIgdbClient() {
  const env = loadEnv()
  const clientId = env.TWITCH_CLIENT_ID
  const clientSecret = env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET missing in pipeline/.env')
  }

  const res = await fetch(
    `${TOKEN_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' },
  )
  if (!res.ok) {
    throw new Error(`Twitch OAuth failed (${res.status}): ${await res.text()}`)
  }
  const { access_token } = await res.json()

  let lastRequest = 0
  // IGDB allows 4 req/s; stay at ~3/s to be safe
  const MIN_INTERVAL = 350

  async function query(endpoint, body, attempt = 0) {
    const wait = lastRequest + MIN_INTERVAL - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequest = Date.now()

    const res = await fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
      body,
    })
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      return query(endpoint, body, attempt + 1)
    }
    if (!res.ok) {
      throw new Error(`IGDB ${endpoint} failed (${res.status}): ${await res.text()}`)
    }
    return res.json()
  }

  return { query }
}
