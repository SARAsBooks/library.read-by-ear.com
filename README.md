# Read-by-Ear Library Platform

An innovative reading platform implementing the Engaged Aided Reading (EAR) method to accelerate reading fluency through state-of-the-art data persistence and state management.

## Overview

This application is a specialized e-reader platform designed to accelerate reading fluency through the Engaged Aided Reading (EAR) method. It focuses on building instant word recognition while maintaining an experience of reading fluency. The platform provides a personalized reading experience that adapts to each reader's sight vocabulary and learning needs.

The current implementation focuses on the state management and data persistence layers, with the UI layer planned for future development.

## Key Features

### State Management Architecture

- **Reactive State with Legend State**: Uses Legend's observable state for all UI and application state
- **Multi-level Data Persistence**: Implements a sophisticated data model with different persistence strategies
- **Offline-First Design**: Supports fully offline functionality with intelligent sync when online
- **Asset Caching System**: Implements smart caching of assets with automatic cleanup

### Data Model Types

1. **State Data**: Ephemeral UI state that isn't persisted (implemented with Legend observables)
2. **Synced Data**: Bi-directionally synchronized with server (uses Legend sync with server actions)
3. **Cached Data**: Server-originated assets with local persistence and expiration policies
4. **Local Session Data**: User session information with browser persistence

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
- **UI Components**: Tailwind CSS, Radix UI primitives
- **Styling**: Tailwind CSS with PostCSS

Acknowledgements to the following:
-
- [Theo](https://t3.gg) for his videos on many topics
- [Create T3 App](https://create.t3.gg) for the boilerplate
- [Claude Code](https://www.anthropic.com/claude-code) for the accelleration it affords me
- [shadcn/ui](https://ui.shadcn.com/) for the UI components

## Project Structure

- `/src/frontend/`: Frontend code organization
  - `/observable/`: Legend State observables and sync configuration
  - `/dexie/`: IndexedDB storage with Dexie.js
- `/src/backend/`: Backend server code
  - `/db/`: Database schema and queries
  - `/sync.ts`: Server synchronization endpoints
- `/src/lib/types/`: TypeScript type definitions
- `/src/components/`: React components (UI layer in development)
- `/src/app/`: Next.js app router configuration

## Data Flow Architecture

1. **UI Layer**: React components subscribe to Legend observables
2. **State Management**: Legend State manages reactive updates
3. **Client Persistence**:
   - Legend persists to localStorage
   - Dexie.js handles IndexedDB storage
4. **Synchronization**:
   - Server actions handle database interactions
   - Legend sync mechanisms orchestrate when to sync
5. **Caching System**:
   - Implements expiration policies (8 sessions or 14 days)
   - Limits cache to 300 assets, removing least recently used

## Getting Started

First, install dependencies:

```bash
npm install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development Scripts

- `pnpm build` - Build the project for production
- `pnpm check` - Run linting and type checking
- `pnpm format:write` - Format code with Prettier
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking

## Database Management

- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Apply database migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio for database management

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

Copyright © Sara's Books LLC. All rights reserved. This application and its content are proprietary. No part of this application may be reproduced, distributed, or transmitted in any form or by any means without the prior written permission of Sara's Books LLC.