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
npm run preview       # Build and start production preview

# Code Quality (run these before committing)
npm run check         # Run linting + type checking + format checking
npm run lint          # ESLint only
npm run lint:fix      # ESLint with auto-fixing
npm run typecheck     # TypeScript type checking
npm run format:check  # Prettier format checking
npm run format:write  # Prettier format fixing

# Database
npm run db:generate   # Generate Drizzle migrations
npm run db:migrate    # Apply migrations
npm run db:push       # Push schema changes to database
npm run db:studio     # Open Drizzle Studio

# Testing
npm run test          # Run tests with Vitest
npm run test:watch    # Run tests in watch mode
npx vitest run path/to/test.test.ts  # Run single test file
```

## Technology Stack

- **Framework**: Next.js 15 with React 19, TypeScript
- **State Management**: Legend State observables for reactive UI
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with Iron Session
- **UI**: Radix UI primitives with shadcn/ui, Tailwind CSS v4
- **Client Storage**: IndexedDB via Dexie.js, localStorage persistence
- **Testing**: Vitest with fast-check for property-based testing

## Architecture

### Four-Tier Data Model

1. **State Data**: Ephemeral UI state (not persisted)
2. **Synced Data**: Bi-directionally synchronized with server
3. **Cached Data**: Server-originated assets with local persistence
4. **Local Session Data**: Browser-persistent session information

### Core Directories

- `src/app/`: Next.js App Router pages and API routes (`/api/ping`, `/api/session`, `/api/errors`, `/api/learning-audit`, `/api/convex/token`, `/api/student/new`)
- `src/backend/`: Server actions (`actions/session.ts`), database schema and operations (`db/`), analytics
- `src/components/`: React components including UI primitives, Convex provider, and feature components
- `src/frontend/`: Client-side state management (`observable/`) and IndexedDB storage (`dexie/`)
- `src/lib/`: Shared TypeScript types, utilities, Convex integration (`convex/`), configuration (`config/`), and monitoring
- `convex/`: Convex backend functions and schema definitions
- `docs/`: Comprehensive developer documentation (onboarding, API tutorial, troubleshooting)

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

### Code Organization

- Uses absolute imports with `@/*` paths
- Strict TypeScript with `noUncheckedIndexedAccess`
- Drizzle ORM safety rules enforced via ESLint plugin
- Co-located test files using pattern `**/*.test.{ts,tsx}`

### Architecture Principles

- **Local-first design**: App works offline, syncs when online
- **Performance optimized**: Designed for low-power devices and slow networks
- **UI = f(State)**: Reactive UI driven by Legend State observables
- **Progressive onboarding**: No username required to get started
- **Server Actions over API routes**: Prefer Next.js server actions for database operations

### State Management Patterns

- Legend State observables for all reactive state
- Multi-tier persistence: localStorage (Legend), IndexedDB (Dexie), PostgreSQL (server audit)
- Session management via Iron Session with client-side sync
- Convex integration for real-time sync when enabled

### Key Architectural Concepts

**Dual Data Persistence Strategy**:

- **Working Set**: Convex tables (`libraries`, `learningRecords`, `preferences`) for real-time UI updates
- **Audit Trail**: PostgreSQL (`reader_responses`) for analytics and compliance, synced via `/api/learning-audit`

**Environment-Aware Configuration**:

- `src/lib/config/environment.ts` provides runtime configuration based on deployment environment
- Feature flags control Convex usage, error reporting, and performance settings
- Service endpoints automatically switch between development/preview/production

**Asset Caching System**:

- IndexedDB-based caching with intelligent cleanup (300-asset limit, 8-session or 14-day expiration)
- Usage analytics collection for optimization
- Offline-first asset delivery with fallback to network

**Session Architecture**:

- Iron Session for secure server-side cookies
- Legend State observable `session$` for client-side session state
- Automatic session reconciliation between client and server
- Progressive session enhancement (anonymous → local → sync → authenticated)

## Documentation Maintenance

**IMPORTANT**: When making changes to the codebase, especially API routes, database schema, or core architecture, update the corresponding documentation in `docs/`:

- **API Changes**: Update `docs/api-tutorial.md` with new endpoints, modified request/response formats, or changed authentication patterns
- **Database Changes**: Update schema references in `docs/onboarding-tutorial.md` and `docs/api-tutorial.md`
- **File Structure Changes**: Update all file path references across documentation when files are moved or renamed
- **New Features**: Add examples to `docs/hands-on-exercises.md` and update data flow in `docs/data-flow.md`
- **Configuration Changes**: Update environment setup instructions in all relevant docs
- **Troubleshooting**: Add new common issues and solutions to `docs/troubleshooting.md`

The documentation contains real code examples and hyperlinks to source files. When you change implementation details, verify that documentation examples remain accurate and update them accordingly.

## Testing Architecture

- **Framework**: Vitest with V8 coverage provider
- **Test Pattern**: `**/*.test.{ts,tsx}` co-located with source files
- **Property-Based Testing**: Uses fast-check for data invariant testing
- **Integration Tests**: Comprehensive tests in `src/app/test/integration/`
- **Conventions**: Self-contained tests, factory functions for test data, extensive async/await patterns
