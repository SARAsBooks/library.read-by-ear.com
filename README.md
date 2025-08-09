# Read-by-Ear Library

An innovative reading library to accelerate reading fluency through implementing an Engaged Aided Reading (EAR) practice and making `Determinate` sightword vocabulary `Legible` and `Serviceable`.

## Overview

This application is a specialized e-reader designed to accelerate time to reading fluency through an Engaged Aided Reading (EAR) practice. It focuses on building instant word recognition while maintaining an experience of reading fluency. The platform provides a personalized reading experience that adapts to each reader’s sight vocabulary and learning needs.

This is a gound-up, [#buildinpublic](https://www.reddit.com/r/buildinpublic/) rewrite of [https://first-chapter.read-by-ear.com](https://first-chapter.read-by-ear.com) that focuses on state management and data persistence layers.

## Author

<img src="https://avatars.githubusercontent.com/u/128427608" alt="Sara's Books LLC" width="100" height="100" />

Sara’s Books LLC is currently one person, Russ “Rustie” Fugal. By day I am a system engineer and account manager for physical automation in the semiconductor industry. I am a [SLCC alum](https://slcc.digication.com/rfugal/Home), [U of U alum](https://writing.utah.edu/undergraduate/transferstudents.php#writing-studies-scholars), [Quantic MBA alum](https://quantic.edu/students/our-students/), and [UAlbany student](https://www.albany.edu/cehc/programs/ms-information-science) working on a MS in Information Science. I’m available for [author visits](https://first-chapter.read-by-ear.com/author-visits) and [knowledge management consulting](https://smart-knowledge-systems.com).

## Key Features

### State Management Architecture

- **Reactive State with Legend State**: Uses Legend’s observable state for all UI and application state
- **Multi-level Data Persistence**: Implements a sophisticated data model with different persistence strategies
- **Offline-First Design**: Supports fully offline functionality with intelligent sync when online
- **Asset Caching System**: Implements smart caching of assets with automatic cleanup
- **Session Management**: Iron-session based server-side session with client-side persistence

### Data Model Types

1. **State Data**: Ephemeral UI state that isn’t persisted (implemented with Legend observables)
2. **Synced Data**: Bi-directionally synchronized with server (uses Legend sync with server actions)
3. **Cached Data**: Server-originated assets with local persistence and expiration policies
4. **Local Session Data**: User session information with browser persistence and server cookie sync

### Six Treatment Approaches

The platform implements six different treatment approaches for word identification:

1. **DrawerMatch**: Visual pattern matching to develop orthographic awareness
2. **PopoverMatch**: Contextually integrated matching for minimal disruption
3. **AidedReading**: Audio support for pronunciation with minimal visual segmentation
4. **QwertyKeying**: Motor learning through standard keyboard typing
5. **DynamicKeying**: Adaptive scaffolding with limited letter choices
6. **UnitBridging**: Linguistic connections between unfamiliar and familiar words

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **State Management**: Legend State for reactive updates and persistence
- **Client Storage**:
  - Legend persistence plugins for localStorage
  - Dexie.js for IndexedDB storage and asset caching
- **Backend**:
  - Next.js server actions for API endpoints
  - Drizzle ORM with PostgreSQL for server-side persistence
  - Iron-session for secure cookie-based sessions
- **Analytics**: Client-side metrics collection with server-side aggregation
- **UI Components**: Tailwind CSS, Radix UI primitives
- **Styling**: Tailwind CSS with PostCSS

## Acknowledgements to the following:

- [Theo](https://t3.gg) for his videos on many topics
- [Create T3 App](https://create.t3.gg) for the boilerplate
- [Claude Code](https://www.anthropic.com/claude-code) for the accelleration it affords me (especially keeping my docs in sync with my code because transformers are best at transliterating)
- [shadcn/ui](https://ui.shadcn.com/) for the UI components

## Project Structure

- `/src/frontend/`: Frontend code organization
  - `./observable/`: Legend State observables and sync configuration
  - `./dexie/`: IndexedDB storage with Dexie.js
- `/src/backend/`: Backend server code
  - `./db/`: PostgreSQL database schema and queries
  - `./sync.ts`: Server action synchronization endpoints
- `/src/lib/types/`: TypeScript type definitions
- `/src/components/`: React components
  - `./ui/`: UI components and primitives
- `/src/app/`: Next.js app router configuration

## Data Flow Architecture

1. **UI Layer**: React components subscribe to Legend observables
2. **State Management**: Legend State manages reactive updates
3. **Client Persistence**:
   - Legend persists to localStorage
   - Dexie.js handles IndexedDB storage
4. **Session Management**:
   - Iron-session provides secure cookie-based sessions
   - Client-server session synchronization
   - Automatic session restoration and timeout handling
5. **Synchronization**:
   - Server actions handle database interactions
   - Legend sync mechanisms orchestrate when to sync
6. **Caching System**:
   - Implements expiration policies (8 sessions or 14 days)
   - Limits cache to 300 assets, removing least recently used
   - Collects usage analytics for optimization

## Philosophy

The codebase is designed with the following principles in mind:

- **UI = f(State)**: The UI is a direct reflection of the state
- **Scale**: The time for prototyped hacks is over; the codebase is designed for rapid scale in students and future devs (including future-me and future-team). Maintainable is scalable.
- **TTFP**: The time to first paint is critical; the app should be fast and responsive
- **Optimized for Low-Power and Low-Data**: The app should work well on older devices and slower networks
- **On-device Compute**: The app should do as much low-complexity work on the device as reasonable to minimize server calls and latency
- **Local-first**: The app should work offline and sync when online
- **Frictionless**: The app should be easy to use and understand, with minimal friction for the student. Onboarding is progressive and contextual, no username required to get started.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Documentation & Tutorials

Follow the tutorials in sequence for the best onboarding experience:

1. [Onboarding Tutorial](./docs/01-onboarding-tutorial.md) - Project overview and quickstart
2. [Data Flow Guide](./docs/02-data-flow.md) - Understanding the architecture
3. [Convex Primer](./docs/03-convex-primer.md) - Convex integration details
4. [API Tutorial](./docs/04-api-tutorial.md) - Comprehensive API reference
5. [Hands-on Exercises](./docs/05-hands-on-exercises.md) - Practical labs
6. [Troubleshooting](./docs/06-troubleshooting.md) - Common issues and solutions

## Development Scripts

- `npm run build` - Build the project for production
- `npm run check` - Run linting and type checking
- `npm run format:write` - Format code with Prettier
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Database Management

- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Apply database migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio for database management

## Implementation Guide

The codebase implements several key patterns:

1. **Observable State**:

   ```typescript
   export const store$ = observable<Store>({
     sessionId: null,
     sessionStartTime: new Date(),
     learningRecords: [],
     state: {
       isHighlighted: false,
       currentTreatment: Treatment.DrawerMatch,
       controlTreatment: Treatment.AidedReading,
       // ...
     },
   });
   ```

2. **Data Synchronization**:

   ```typescript
   syncObservable(
     library$,
     synced({
       get: () => getLibrary(studentId),
       set: async ({ value }) => await postLibrary(value),
       persist: {
         name: "library",
         plugin: ObservablePersistLocalStorage,
       },
       debounceSet: 5000,
     }),
   );
   ```

3. **Asset Caching**:
   ```typescript
   const cachedAsset = await cachedAssetDB.assets.get(url);
   if (!cachedAsset) {
     return fetchAssetFromNetwork(url, assetType);
   }
   await cachedAssetDB.assets.update(url, {
     lastUsedAt: new Date(),
     accessCount: (cachedAsset.accessCount ?? 0) + 1,
   });
   ```

## Current State and Roadmap

The codebase currently focuses on:

- State management layer implementation
- Data persistence with syncing capability
- Asset caching system
- Fluency record tracking foundation

Future development will focus on:

- User interface implementation
- Reading experience components
- Treatment UI implementations
- Analytics and reporting features

## License

Copyright © Russ Fugal. All rights reserved. This application and its content are proprietary. No part of this application may be reproduced, distributed, or transmitted in any form or by any means without the prior written permission.
