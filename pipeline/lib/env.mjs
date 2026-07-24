import fs from 'node:fs'
import path from 'node:path'

// Minimal .env parser (avoids a dotenv dependency)
export function loadEnv() {
  const envPath = path.join(import.meta.dirname, '..', '.env')
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `Missing ${envPath}. Copy .env.example to .env and fill in your Twitch credentials.`,
    )
  }
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
