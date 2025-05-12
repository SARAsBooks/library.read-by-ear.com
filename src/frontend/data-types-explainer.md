# Read-by-Ear Data Model Types

This document explains the different types of data in our application model and their characteristics, with specific examples from our codebase.

## 1. State Data

**Characteristics:**
- Ephemeral data that represents the current UI state
- Not persisted between sessions
- Stored in memory during runtime

**Implementation:**
- Managed with Legend's `observable` state management
- Examples from our codebase:
  ```typescript
  // From src/frontend/observable/stores.ts
  export const store$ = observable<Store>({
    // ...
    state: {
      isHighlighted: false,
      currentTreatment: Treatment.DrawerMatch,
      controlTreatment: Treatment.AidedReading,
      isEngaged: false,
      choiceIndex: null,
      isIncorrect: false,
      isExploding: false,
      isPlaying: false,
      inputType: "touch",
    },
  });
  ```
- The `isHighlighted`, `isEngaged`, `isPlaying` flags in the state object are examples of ephemeral UI state

## 2. Synced Data

**Characteristics:**
- Persisted on server and client
- Bi-directional synchronization
- Preserved across sessions and devices

**Implementation:**
- Server-side: PostgreSQL database accessed via NextJS server actions
- Client-side: Combination of Legend/state with localStorage and Dexie.js
- Synchronization: Using server actions and Legend sync mechanisms
- Examples from our codebase:
  ```typescript
  // From src/frontend/observable/librarys.ts
  syncObservable(
    library$,
    synced({
      get: () => {
        const studentId = session$.studentId.peek();
        if (!studentId) {
          console.error("No studentId found in session.");
          return null;
        }
        return getLibrary(studentId);
      },
      set: async ({ value }) => {
        await postLibrary(value ?? {
          studentId: session$.studentId.peek(),
          bookmarks: [],
          library: [],
        });
      },
      persist: {
        name: "library",
        plugin: ObservablePersistLocalStorage,
      },
      debounceSet: 5000,
    }),
  );
  ```
- Fluency records are also synced:
  ```typescript
  // From src/frontend/dexie/sync.ts
  export async function syncFromServer(): Promise<boolean> {
    const studentId = session$.studentId.peek();
    if (!studentId) return false;

    const records = await getFluencyRecords(studentId);
    
    await clearFluencyRecordsTableByStudentId(studentId);
    await bulkAddItemsToDB(records);
    return true;
  }
  ```

## 3. Cached Data

**Characteristics:**
- Server-originated assets stored locally
- Temporary persistence with expiration policy
- Not synced back to server

**Implementation:**
- Stored in IndexedDB via Dexie.js
- Expires after 5 sessions of non-use or 14 days
- Tracks cache date and last access
- Examples of assets to be cached:
  - Audio files referenced in `WordObj.audio_url`
  - Reading JSON data
  - Images referenced in `Reading.imageURL`
- See planned implementation in `src/frontend/dexie/cached-assets.md`

## 4. Local Session Data

**Characteristics:**
- Specific to the current user session
- More persistent than state but not synced to server
- Enhances user experience across page navigation

**Implementation:**
- Managed with Legend's persistence plugins
- Examples from our codebase:
  ```typescript
  // From src/frontend/observable/sessions.ts
  export const session$ = observable<Session>({
    sessionId: null,
    studentId: null,
    anonymous: true,
    authenticated: false,
  });

  syncObservable(session$, {
    persist: {
      name: "session",
      plugin: ObservablePersistLocalStorage,
    },
  });
  ```
- This persists the session information in localStorage but doesn't sync with the server

## 5. Session Management

**Characteristics:**
- Controls user authentication and access
- Tracks session history and activity
- Used for determining data staleness

**Implementation:**
- Managed in `session$` observable and stored in localStorage
- Session start time tracked in our store:
  ```typescript
  // From src/frontend/observable/stores.ts
  export const store$ = observable<Store>({
    sessionId: null,
    sessionStartTime: new Date(),
    // ...
  });
  ```
- Used as a reference point for determining staleness of cached assets

## 6. Sensitive Data

**Characteristics:**
- Requires authentication to access
- Higher security requirements
- Personal or protected information

**Implementation:**
- Only available when user is authenticated (`session$.authenticated === true`)
- Examples include student profiles:
  ```typescript
  // From src/app/api/student/new/route.ts
  // Server route for creating new student profiles
  ```
- Never stored in client-side persistent storage without proper safeguards

## Data Flow Architecture

Our application uses a hybrid architecture combining Legend/state for reactive UI updates with Dexie.js for client-side persistence and NextJS server actions for backend communication:

1. **UI Layer**: React components subscribe to Legend observables (`store$`, `session$`, `library$`)
2. **State Management**: Legend/state manages reactive updates and persistence
3. **Client Persistence**: 
   - Legend persists some data to localStorage
   - Dexie.js provides IndexedDB storage for more complex structures
4. **Synchronization**: 
   - Server actions (`postFluencyRecords`, `getFluencyRecords`) handle database interactions
   - Legend sync mechanisms orchestrate when to sync
5. **Caching System**: 
   - Dexie.js manages asset caching with expiration policies
   - Reduces network requests and improves offline capability

This multi-layered approach allows the application to function seamlessly in both online and offline scenarios while optimizing for performance and user experience.