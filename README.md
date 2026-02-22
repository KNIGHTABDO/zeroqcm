# FMPC QCM

> Premium QCM platform for FMPC medical students. Dark glass UI, spaced repetition, AI inline explanations.

## Stack
- **Next.js 15** + TypeScript
- **Supabase** — auth + question database
- **Framer Motion** — animations
- **Tailwind CSS** — design system

## Design System
Pure black canvas (`#000`), glass cards (`#0d0d0d`), accent blue — see [REELENS design system](https://github.com/KNIGHTABDO).

## Setup

```bash
# 1. Install deps
npm install

# 2. Copy env
cp .env.example .env
# Fill in your Supabase URL + anon key

# 3. Apply database schema
# Go to Supabase Dashboard → SQL Editor → paste scripts/schema.sql

# 4. Scrape question data from DariQCM (~44k questions)
npm run scrape

# 5. Run dev server
npm run dev
```

## Responsive Breakpoints
| Breakpoint | Layout |
|------------|--------|
| Mobile < 768px | Bottom tab nav, single column |
| Tablet 768–1023px | Bottom tab nav, max-w-2xl, 2-col grids |
| Desktop ≥ 1024px | Fixed sidebar (240px), max-w-3xl content, keyboard nav in quiz |

## Data Source
Questions scraped from DariQCM (free platform, 100% public access, no paywall).
All data originates from FMPC past exam papers — public academic material.

## Roadmap
- [ ] Connect quiz page to Supabase
- [ ] Spaced repetition engine
- [ ] Progress persistence
- [ ] Gemini AI explanations
- [ ] S2–S10 when DariQCM adds them
