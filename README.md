## TaXing Web

Official website for the public-good project **TaXing (她行)**, built with **Next.js 15 + TypeScript + MUI**. It includes Home, About, Past Programs, Podcast pages, and a volunteer directory.

## Requirements
- Node.js **18+** (20 recommended)
- npm (or pnpm / yarn / bun; examples use npm)

## Quick Start
```bash
# 1) Install dependencies
npm install

# 2) Start dev server
npm run dev
# visit http://localhost:3000

# 3) Lint (optional)
npm run lint

# 4) Production build (optional)
npm run build
# run the built app:
npm run start
```

> No env vars are required today. If you add APIs/domains later, create `.env.local` in the project root and configure as needed.

## Project Structure (summary)
```
src/
  app/                # Next.js App Router pages
    about/
    past-programs/
    podcast/
  components/
    sections/         # Page sections (Hero, Volunteers, etc.)
    common/           # Reusable UI (AppBar, Card, SectionContainer, etc.)
    about/            # About-page specific components (Header, Timeline, VolunteerAccordion)
  data/               # Copy and volunteer data
  theme.ts            # MUI theme setup
public/
  icons/ images/      # Static assets
```

## Scripts
- `npm run dev`   Local development
- `npm run lint`  ESLint checks
- `npm run build` Production build
- `npm run start` Run built app (requires build)

## Contributing
Issues and PRs are welcome. For content/design updates, prefer editing data in `src/data` so components stay presentational.
