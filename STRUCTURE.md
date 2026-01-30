# Project Structure Guide

This document summarizes the TaXing Web codebase layout and what each folder is responsible for.

## Top-level
- `package.json` / `tsconfig.json` / `next.config.ts` / `eslint.config.mjs` — tooling, scripts, lint, and TypeScript/Next.js settings.
- `.next/` — build output (ignored in version control). 
- `public/` — static assets served as-is.

## `public/`
- `icons/` — SVG/PNG icons (logos, social media, custom badges like `forward-with-her-bridge.png`).
- `images/` — hero and other raster images.

## `src/`
- `app/` — Next.js **App Router** pages and route segments.
  - `layout.tsx` — root layout (applies to all routes).
  - `page.tsx` — home page.
  - `about/` — About page route.
  - `past-programs/` — Past Programs route.
  - `podcast/` — Podcast route.
  - `join/`, `api/` — other route segments as needed.
- `components/` — React components, organized by intent:
  - `sections/` — page-level sections (e.g., `HeroSection`, `VolunteersSection`, `PastProgramsSection`).
  - `common/` — shared UI primitives (e.g., `AppBar`, `Card`, `SectionContainer`, `TextDivider`, `PodcastPlayer`).
  - `about/` — About-page specific pieces (`AboutPageHeader`, `HistoryTimeline`, `VolunteerAccordion`).
- `data/` — content/data sources used by the UI (e.g., `aboutContent.ts`, `volunteers.ts`, `navigation.ts`).
- `types/` — TypeScript interfaces shared across the project (e.g., `aboutContent.ts`, `volunteer.ts`, `home.ts`, `podcast.ts`).
- `theme.ts` — MUI theme configuration.

## `scripts` (package.json)
- `npm run dev` — start local dev server.
- `npm run lint` — run ESLint.
- `npm run build` — production build.
- `npm run start` — serve the built app (requires `build`).

## Conventions
- Keep page-specific components near their route (`components/about` for About).
- Put reusable UI in `components/common`; page sections in `components/sections`.
- Store text/content in `src/data` to keep components presentational.
- Static assets belong in `public/` (use `public/icons` for icons, `public/images` for larger visuals).

Use this as a quick reference when navigating or contributing to the codebase.
