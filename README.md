# There's nothing to play...

Too many games, too little time. And yet, somehow, there's never anything to play.

An experimental WebGL gallery that visualizes thousands of video game covers in an interactive force-directed voronoi diagram. Adapted from the open-source [nothing-to-watch](https://github.com/gnovotny/nothing-to-watch) project by gnovotny, with game data from [IGDB](https://www.igdb.com).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Creative Commons License](https://img.shields.io/badge/License-CC%20BY--NC--SA%203.0-lightgrey.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)
![React](https://img.shields.io/badge/React-19.1-blue.svg)
![WebGL](https://img.shields.io/badge/WebGL-enabled-green.svg)

## 🚀 Quick Start

### Prerequisites

- Node.js 20.19+ (or Bun)
- Modern browser with WebGL 2.0 support
- Twitch developer credentials for the IGDB data pipeline (free at [dev.twitch.tv](https://dev.twitch.tv/console/apps))

### 1. Install dependencies

```bash
npm install
cd pipeline && npm install && cd ..
```

### 2. Generate the game dataset (IGDB pipeline)

The engine does not call any API at runtime: all game data and cover atlases are pre-generated as static assets. Set your credentials once:

```bash
# pipeline/.env  (copy from pipeline/.env.example)
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

Then run the full pipeline (fetch top 10,000 games -> download covers -> build texture atlases + JSON):

```bash
cd pipeline
npm run all
```

Steps can also be run individually (`npm run fetch`, `npm run covers`, `npm run build`). Cover downloads are cached in `pipeline/data/covers/`, so re-runs are fast. To change the dataset size: `GAMES_TOTAL=25000 npm run all` (also re-check `CELL_LIMIT` options in `app/vf/consts.ts`).

The pipeline writes:

- `public/json/{n}.json` — game info in batches of 216 (one per 18x12 subgrid)
- `public/media/low|mid|high/dds/{n}.dds` — DXT1-compressed texture atlas layers
- `public/media/single/{i}.jpg` — 220x330 covers for the selected-game view
- `.env.local` — atlas layer counts (`VITE_MEDIA_VERSION_*_LAYERS`, `VITE_GAME_COUNT`)

### 3. Start the dev server

```bash
npm run dev
```

Navigate to `http://localhost:3000`.

## 🏗 Architecture

- **React 19** + TypeScript + Vite, Tailwind CSS with Radix UI, Zustand for state
- **Voroforce**: custom vanilla JS force-simulation + WebGL2 rendering engine (OGL + GLSL), multi-threaded
- Game covers are packed into DXT1 texture-array atlases at three resolutions (4x6, 22x33 and 110x165 px per tile) and streamed to the GPU as you move; a fourth level uses individual JPGs for the close-up view

```
├── app/            # React application (UI, store, voroforce integration)
├── voroforce/      # Standalone WebGL engine
├── pipeline/       # IGDB data pipeline (fetch, covers, atlas builder)
└── public/         # Generated static assets (json + media)
```

## 🛠 Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run check` | Run Biome checks (lint + format) |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:e2e` | Run end-to-end tests with Playwright |

## 📄 License & Credits

- Code: MIT License (see LICENSE), based on [nothing-to-watch](https://github.com/gnovotny/nothing-to-watch) by gnovotny
- WebGL fragment shaders: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
- Game data and cover art provided by [IGDB.com](https://www.igdb.com). This project is not endorsed by or affiliated with IGDB or Twitch
