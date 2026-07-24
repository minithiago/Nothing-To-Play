// Runs the full pipeline: fetch game data -> download covers -> build assets.
// Re-runnable: cover downloads are cached, everything else is regenerated.
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const here = import.meta.dirname
for (const script of ['1-fetch-games.mjs', '2-download-covers.mjs', '3-build-assets.mjs']) {
  console.log(`\n=== ${script} ===`)
  execFileSync(process.execPath, [path.join(here, script)], {
    stdio: 'inherit',
    env: process.env,
  })
}
