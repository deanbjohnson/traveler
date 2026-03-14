# Travelers

AI-powered travel planning assistant. Plan trips, search flights, discover deals, and build itineraries through natural conversation.

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **UI:** React 19, Tailwind CSS, Radix UI, Framer Motion
- **Auth:** Clerk
- **Database:** PostgreSQL, Prisma
- **AI:** Vercel AI SDK, Cohere
- **Integrations:** Duffel (flights), Mapbox (maps)

## Features

- **Trip Management** — Create and organize trips with timelines
- **AI Chat** — Natural-language travel planning with tool calling (flight search, stays, budget discovery)
- **Budget Discovery** — Multi-destination flight search and deal hunting
- **Timeline** — Hierarchical itineraries (flights, stays, activities)
- **Pending Flights** — Parse flight confirmation emails and suggest adding to trips
- **Profile** — Account settings and booking information

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Accounts: [Clerk](https://clerk.com), [Duffel](https://duffel.com), [Mapbox](https://mapbox.com)

## Setup

1. Clone and install dependencies:

```bash
npm install
```

2. Copy environment variables and configure:

```bash
cp .env.example .env
```

3. Set the following in `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `DUFFEL_ACCESS_TOKEN` | Duffel API token |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox access token (for maps) |

4. Initialize the database:

```bash
npm run db:push
```

5. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run airports:build` | Build airport database (public/airports.min.json for geocoding) |
| `npm run airports:comprehensive` | Build comprehensive airport DB (requires airports.csv; outputs lib/airport-database-generated.json) |

## Project Structure

```
app/
├── page.tsx              # Home: trip list or welcome
├── discover/             # Redirects to latest trip or home
├── discover/[tripId]/    # Trip workspace: chat, timeline, flight search
├── profile/              # User profile and booking info
├── api/                  # Chat, flights, pending-flights, webhooks
└── actions/              # Server actions

components/
├── ui/                   # UI components
├── main-timeline.tsx     # Timeline visualization
└── chat-demo.tsx         # AI chat interface

lib/
├── db/                   # Prisma client and DB helpers
│   ├── index.ts
│   ├── client.ts
│   ├── users.ts
│   ├── trips.ts
│   ├── timeline.ts
│   ├── bookings.ts
│   └── search.ts
├── tools/                # AI tools (findFlight, findStay, addToTimeline, etc.)
└── airport-database*.ts  # Airport data
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow, module overview, and Prisma schema.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Duffel API](https://duffel.com/docs/api)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
