# Fluency Context and Sync Hooks

This directory contains React hooks implementation for managing fluency records with Dexie IndexedDB storage and server synchronization.

## Overview

The implementation follows the React hooks patterns from the guide, adapted to work with your existing Dexie infrastructure instead of localStorage.

## Key Files

- `fluency-context.tsx` - React context with async hydration pattern
- `useFluencySync.ts` - Sync hook with debounce support
- `useDebouncedCallback.ts` - Utility hook for debouncing

## Architecture

### Data Flow

1. **Initial Load**: Empty state → Hydrate from Dexie → Hydrate from server → Auto-sync unsynced records
2. **Adding Records**: Component → Context → Dexie (with tracking fields)
3. **Sync**: Manual/auto → Get unsynced from context → Send to server → Mark as synced in Dexie & context

### Storage

- **Dexie IndexedDB**: Source of truth with `TrackedFluencyRecord` (includes `origin` and `synced` fields)
- **React Context**: Mirrors Dexie data for reactive UI updates
- **Server**: Remote persistence via existing backend actions

## Usage Examples

### Basic Setup (Already done in layout.tsx)

```tsx
import { FluencyProvider } from "@/hooks/fluency-context";

<FluencyProvider>{children}</FluencyProvider>;
```

### Adding Records

```tsx
import { useAddFluencyRecord } from "@/hooks/fluency-context";

function MyComponent() {
  const addRecord = useAddFluencyRecord();

  const handleAddRecord = async () => {
    await addRecord({
      studentId: "student-123",
      word: "example",
      response: ResponseId.Recognition,
      timestamp: new Date(),
    });
    // Record is automatically added to Dexie with origin: "local", synced: false
    // Context state is updated for reactive UI
  };
}
```

### Manual Sync

```tsx
import { useFluencySync } from "@/hooks/useFluencySync";

function SyncButton() {
  const { sync, forceSync, isSyncing, unsyncedCount } = useFluencySync();

  return (
    <button onClick={forceSync} disabled={isSyncing}>
      {isSyncing ? "Syncing..." : `Sync ${unsyncedCount} records`}
    </button>
  );
}
```

### Auto-Sync with Debounce

```tsx
import { useAutoSync } from "@/hooks/useFluencySync";

function MyApp() {
  // Auto-sync after 5 seconds of no new records
  useAutoSync(5000);

  return <div>App content...</div>;
}
```

### Debounced Manual Sync

```tsx
import { useFluencySync } from "@/hooks/useFluencySync";

function MyComponent() {
  // Sync function is debounced by 3 seconds
  const { sync, isSyncing } = useFluencySync(3000);

  // Multiple calls to sync() within 3 seconds will only trigger once
  const handleMultipleActions = () => {
    sync(); // Will be debounced
    sync(); // Will be debounced (same call)
    sync(); // Will be debounced (same call)
  };
}
```

### Accessing State

```tsx
import { useFluency, useUnsyncedRecords } from "@/hooks/fluency-context";

function StatusComponent() {
  const { state } = useFluency();
  const unsyncedRecords = useUnsyncedRecords();

  return (
    <div>
      <p>Total records: {state.records.length}</p>
      <p>Unsynced: {unsyncedRecords.length}</p>
      <p>Loading: {state.isLoading ? "Yes" : "No"}</p>
      <p>Hydrated: {state.isHydrated ? "Yes" : "No"}</p>
      {state.error && <p>Error: {state.error}</p>}
    </div>
  );
}
```

## Benefits

- **Local-first**: Works offline, syncs when online
- **Reactive**: UI updates automatically when data changes
- **Efficient**: Debounced sync prevents spam
- **Type-safe**: Full TypeScript support
- **Backward compatible**: Extends existing Dexie patterns
- **Conflict resolution**: Deduplicates records during server sync
- **Error handling**: Graceful error handling with user feedback

## Integration with Existing Code

The new hooks work alongside your existing Legend State observables:

- Use Legend State for session management (session$)
- Use React hooks for fluency record management
- Both systems can coexist and complement each other
