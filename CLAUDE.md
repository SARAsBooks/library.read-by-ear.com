
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Read-by-Ear Library is an innovative e-reader platform designed to accelerate reading fluency through Engaged Aided Reading (EAR) practice. The application implements six different treatment approaches to make sight vocabulary "Determinate," "Legible," and "Serviceable." It's built for scale, offline-first functionality, and optimal performance on low-power devices.

## Development Commands

```bash
# Development
npm run dev           # Start development server with Turbo
npm run build         # Production build
npm run start         # Start production server

# Code Quality (run these before committing)
npm run check         # Run linting + type checking + format checking
npm run lint          # ESLint only
npm run typecheck     # TypeScript type checking
npm run format:check  # Prettier format checking
npm run format:write  # Prettier format fixing

# Database
npm run db:generate   # Generate Drizzle migrations
npm run db:migrate    # Apply migrations
npm run db:studio     # Open Drizzle Studio
```

## Technology Stack

- **Framework**: Next.js 15 with React 19, TypeScript
- **State Management**: Legend State observables for reactive UI
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with Iron Session
- **UI**: Radix UI primitives with shadcn/ui, Tailwind CSS v4
- **Client Storage**: IndexedDB via Dexie.js, localStorage persistence

## Architecture

### Four-Tier Data Model
1. **State Data**: Ephemeral UI state (not persisted)
2. **Synced Data**: Bi-directionally synchronized with server  
3. **Cached Data**: Server-originated assets with local persistence
4. **Local Session Data**: Browser-persistent session information

### Core Directories
- `src/app/`: Next.js App Router (API routes, pages)
- `src/backend/`: Server actions, database, analytics
- `src/components/`: React components (ear-reader, bookshop, ui)
- `src/frontend/`: Client-side observables and IndexedDB management
- `src/lib/`: Shared types and utilities

### State Management Pattern
Uses Legend State for reactive UI updates following UI = f(State) philosophy:

```typescript
export const store$ = observable<Store>({
  sessionId: null,
  sessionStartTime: new Date(),
  learningRecords: [],
  state: {
    currentTreatment: Treatment.DrawerMatch,
    // ... other UI state
  },
});
```

## Six Treatment Approaches

The platform implements six pedagogical treatments:
1. **DrawerMatch**: Visual pattern matching
2. **PopoverMatch**: Contextual matching  
3. **AidedReading**: Audio pronunciation support
4. **QwertyKeying**: Motor learning via keyboard
5. **DynamicKeying**: Adaptive scaffolding
6. **UnitBridging**: Linguistic connections

## Asset Caching System

- **Storage**: IndexedDB with 300-asset limit
- **Expiration**: 8 sessions unused OR 14 days
- **Types**: Audio, JSON, images, video
- **Analytics**: Usage tracking and performance metrics

## Development Guidelines

- Uses absolute imports with `@/*` paths
- Strict TypeScript with `noUncheckedIndexedAccess`
- Drizzle ORM safety rules enforced
- Local-first design with offline functionality
- Performance optimized for low-power devices
- Progressive onboarding without required usernames