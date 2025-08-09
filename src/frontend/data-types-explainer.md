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
    sessionId: null,
    sessionStartTime: new Date(),
    learningRecords: [],
    state: {
      isHighlighted: false,
      currentTreatment: Treatment.DrawerMatch,
      controlTreatment: Treatment.AidedReading,
      precedingFluencyRecord: [],
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
  if (session$.saveProgress.get() === "sync") {
    await postLibrary(library$.peek());
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
          console.log("Setting library data:", value);
          await postLibrary(
            value ?? {
              studentId: session$.studentId.peek(),
              bookmarks: [],
              library: [],
            },
          );
        },
        persist: {
          name: "library",
          plugin: ObservablePersistLocalStorage,
        },
        debounceSet: 5000,
      }),
    );
  }
  ```
- Fluency records are also synced:

  ```typescript
  // From src/frontend/dexie/sync.ts
  export async function syncFromServer(): Promise<boolean> {
    const studentId = session$.studentId.peek();
    if (!studentId) {
      console.error("No studentId found in session.");
      return false;
    }

    const records = await getFluencyRecords(studentId);

    if (records.length === 0) {
      console.log("No records found on server.");
      return false;
    }

    await clearFluencyRecordsTableByStudentId(studentId);
    await bulkAddItemsToDB(records);
    console.log(`Fetched ${records.length} records from server`);
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
- Expires after 8 sessions of non-use or 14 days
- Maximum of 300 assets stored in cache
- Tracks cache date and last access
- Examples of assets that are cached:
  - Audio files referenced in `WordObj.audio_url`
  - JSON data for readings
  - Images referenced in `Reading.imageURL`
  - Video files for animations or tutorials
- Complete implementation in `src/frontend/dexie/cached-assets.ts`

```typescript
// From src/frontend/dexie/cached-assets.ts
export async function getAsset(params: GetAssetParams): Promise<Asset> {
  const { url, assetType } = params;
  const cachedAsset = await tryCatch(cachedAssetDB.assets.get(url));

  if (assetType === "json") {
    if (!cachedAsset.ok) return fetchAssetFromNetwork(url, assetType);

    await cachedAssetDB.assets.update(url, {
      lastUsedAt: new Date(),
      accessCount: (cachedAsset.data?.accessCount ?? 0) + 1,
    });

    return { assetUrl: url, assetJson: cachedAsset.data as object };
  }

  // For non-JSON assets, try to get from cache first
  if (isIndexedDBSupported()) {
    if (!cachedAsset.ok) {
      // If not in cache, fetch from network
      return fetchAssetFromNetwork(url, assetType);
    }
    // Update last used date and access count
    await cachedAssetDB.assets.update(url, {
      lastUsedAt: new Date(),
      accessCount: (cachedAsset.data?.accessCount ?? 0) + 1,
    });

    // Handle binary data (creates a blob URL)
    if (cachedAsset.data instanceof Blob) {
      const blobUrl = URL.createObjectURL(cachedAsset.data);

      // Create cleanup function
      let objectUrlRevoked = false;
      const cleanup = () => {
        if (!objectUrlRevoked) {
          URL.revokeObjectURL(blobUrl);
          objectUrlRevoked = true;
        }
      };

      return { assetUrl: blobUrl, cleanup };
    }
  }
  // Fetch from network if not in cache or JSON type
  return fetchAssetFromNetwork(url, assetType);
}
```

- Automatic cleanup of stale assets based on session tracking:

```typescript
// From src/frontend/dexie/cached-assets.ts
export async function cleanupStaleAssets(): Promise<void> {
  // Calculate obsolete date (14 days ago)
  const now = new Date();
  const obsoleteDate = new Date(
    now.getTime() - DAYS_UNTIL_OBSOLETE * 24 * 60 * 60 * 1000,
  );
  await cachedAssetDB.assets.where("cachedAt").below(obsoleteDate).delete();

  const sessions = await cachedAssetDB.sessions
    .orderBy("sessionStarted")
    .reverse()
    .toArray();
  const oldSessionDate = sessions[MAX_SESSIONS - 1]?.sessionStarted;
  if (!oldSessionDate) return;
  await cachedAssetDB.assets.where("lastUsedAt").below(oldSessionDate).delete();
  await cachedAssetDB.sessions
    .where("sessionStarted")
    .below(oldSessionDate)
    .delete();

  // truncate cached assets to MAX_ASSETS
  const totalAssets = await cachedAssetDB.assets.count();
  if (totalAssets <= MAX_ASSETS) return;
  // order by lastUsedAt and select the index of MAX_ASSETS
  const maxAssetDate = await cachedAssetDB.assets
    .orderBy("lastUsedAt")
    .reverse()
    .offset(MAX_ASSETS)
    .first()
    .then((asset) => asset?.lastUsedAt);
  if (!maxAssetDate) return;
  await cachedAssetDB.assets.where("lastUsedAt").below(maxAssetDate).delete();
}
```

## 4. Local Session Data

**Characteristics:**

- Specific to the current user session
- More persistent than state but synchronized with server-side cookies
- Bi-directional sync with server via iron-session cookies
- Enhances user experience across page navigation
- Tracks last active time for timeout management

**Implementation:**

- Managed with Legend's persistence plugins and iron-session
- Client-side implementation:

  ```typescript
  // From src/frontend/observable/sessions.ts
  export const session$ = observable<Session>({
    anonymous: true,
    authenticated: false,
    lastActive: Date.now(),
  });

  syncObservable(session$, {
    set: async ({ value }) => {
      if (!session$.studentId.peek() && window.navigator.onLine) {
        const serverSession = await getSession();
        Object.assign({
          target: serverSession,
          source: value as Partial<Session>,
        });
        session$.assign(serverSession);
      }
      const newSession = {
        ...session$.peek(),
        ...(value as Partial<Session>),
        sessionId:
          session$.sessionId.peek() &&
          session$.lastActive.peek() > Date.now() - 15 * 60 * 1000
            ? session$.sessionId.peek()
            : uuid(),
        lastActive: Date.now(),
      } as Session;
      if (!session$.saveProgress.peek()) {
        session$.assign(newSession);
        return;
      }
      void session$.assign((await updateSession(newSession)) ?? newSession);
    },
    persist: {
      name: "session",
      plugin: ObservablePersistLocalStorage,
    },
  });
  ```

- Server-side session management with iron-session:

  ```typescript
  // From src/backend/actions/session.ts
  export async function getSession(): Promise<Session> {
    const ironSession = await getIronSession<Session>(
      await cookies(),
      sessionOptions,
    );
    const newSession: Session = {
      ...defaultSession,
      ...ironSession,
      sessionId:
        ironSession.sessionId &&
        ironSession.lastActive > Date.now() - 15 * 60 * 1000
          ? ironSession.sessionId
          : uuid(),
      studentId: ironSession.studentId ?? uuid(),
      lastActive: Date.now(),
    };
    Object.assign({ target: ironSession, source: newSession });
    ironSession.updateConfig({
      ...sessionOptions,
      ttl: ironSession.saveProgress ? 28 * 24 * 3600 : 15 * 60,
    });
    await ironSession.save();
    return ironSession;
  }
  ```

- The `Session` interface now includes a `lastActive` field for timeout management:
  ```typescript
  // From src/lib/types/session.ts
  export interface Session {
    sessionId?: string;
    studentId?: string;
    lastActive: number;
    anonymous: boolean;
    authenticated: boolean;
    deviceOwnership?: "public" | "private" | "family" | "school";
    saveProgress?: "local" | "sync";
    userId?: string;
    students?: Student[];
    progressiveWebApp?: "iOS" | "Android" | "other";
    notificationsEnabled?: Notifications;
  }
  ```

## 5. Session Management

**Characteristics:**

- Controls user authentication and access
- Tracks session history and activity
- Used for determining data staleness
- Handles bi-directional synchronization with server
- Manages timeout and session restoration
- Supports seamless switching between local-only and server-synced modes

**Implementation:**

- Managed in `session$` observable with server synchronization via iron-session
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
- Session tracking for cached assets:
  ```typescript
  // From src/frontend/dexie/cached-assets.ts
  export async function recordSession(): Promise<void> {
    const sessionId = session$.sessionId.peek();
    if (!sessionId) return;
    const sessionExists = await cachedAssetDB.sessions.get(sessionId);
    if (sessionExists) return;
    // insert new session
    await cachedAssetDB.sessions.add({
      sessionId,
      sessionStarted: new Date(),
    });
    console.log(`Session recorded: ${sessionId}`);
    await tryCatch(cleanupStaleAssets());
  }
  ```
- Server-side session synchronization:
  ```typescript
  // From src/frontend/observable/sessions.ts
  export async function saveProgressLocal(): Promise<boolean> {
    if (!session$.saveProgress.peek()) return false;
    const result = await startSyncLocal(session$.peek());
    if (!result.ok) return false;
    session$.assign(result.session);
    return true;
  }
  ```
- Time-based session management with automatic restoration:
  ```typescript
  // From src/backend/actions/session.ts
  export async function startSyncLocal(
    session: Session,
  ): Promise<{ ok: boolean; session: Session }> {
    const ironSession = await getIronSession<Session>(
      await cookies(),
      sessionOptions,
    );
    // Session setup with proper TTL based on save preference
    ironSession.updateConfig({
      ...sessionOptions,
      ttl: session.saveProgress ? 28 * 24 * 3600 : 15 * 60,
    });
    await ironSession.save();
    return { ok: true, session: ironSession };
  }
  ```

## 6. Learning Records

**Characteristics:**

- Captures user interaction with the learning system
- Used for fluency tracking and adaptive treatment selection
- Stored persistently and synced to the server

**Implementation:**

- FluencyRecord: Captures recognition vs. identification responses

  ```typescript
  // From src/lib/types/fluency-record.ts
  export interface FluencyRecord {
    id?: number;
    studentId: string;
    word: string;
    response: ResponseId;
    timestamp: Date;
  }

  export enum ResponseId {
    // True for recognition, false for identification
    Identification = 0,
    Recognition = 1,
  }
  ```

- LearningRecord: More detailed entry including treatment type and context
  ```typescript
  // From src/lib/types/learning-record.ts
  export interface LearningRecordEntry {
    created_at: Date;
    prediction?: ResponseId;
    response: ResponseId;
    action_id: ActionId;
    word_in_reading?: [number, string];
    word_as_string?: string;
    treatment_id: TreatmentId;
    context?: LearningRecordContext;
  }
  ```
- Word reading fluency levels are calculated based on response history
  ```typescript
  // From src/frontend/learning-record-action.ts
  export const getWordReadingFluencyLevel = (
    target_fluency_record: ResponseId[],
  ): WordReadingFluencyEnum => {
    if (!target_fluency_record.length) return WordReadingFluencyEnum.Unknown;
    const actionId = GetActionId({ record: target_fluency_record });
    switch (actionId) {
      case ActionId.UnknownToInitial || ActionId.PredictedToInitial:
        return WordReadingFluencyEnum.Initial;
      case ActionId.LearnedToLearned || ActionId.DevelopingToLearned:
        return WordReadingFluencyEnum.Learned;
      case ActionId.InitialToStrong ||
        ActionId.LearnedToStrong ||
        ActionId.StrongToStrong:
        return WordReadingFluencyEnum.Strong;
    }
    return WordReadingFluencyEnum.Developing;
  };
  ```

## 7. Library Data

**Characteristics:**

- Contains user's reading library and progress
- Persisted and synchronized across devices
- Bookmarks track progress through readings

**Implementation:**

- Stored in the `library$` observable with syncing option
- Structure includes bookmarks and library collections

  ```typescript
  // From src/lib/types/library.ts
  export interface Library {
    studentId: string | null;
    bookmarks: Bookmark[]; // synced to the server
    library: string[]; // requested from corpus.sara.ai
    resumeReadings?: string[]; // requested from corpus.sara.ai
    clientOptions?: undefined; // future use, TODO: sync to the server
  }

  export interface Bookmark {
    readingId: string;
    currentPage: number;
    lastupdate: Date;
    completed?: boolean;
    stars?: number;
  }
  ```

## Data Flow Architecture

Our application uses a hybrid architecture combining Legend/state for reactive UI updates with Dexie.js for client-side persistence and NextJS server actions for backend communication:

1. UI Layer: React components subscribe to Legend observables (`store$`, `session$`, `library$`)
2. State: Legend/state manages reactive updates; ephemeral state stays in-memory
3. Client Persistence:

- Legend persists selected observables to localStorage (session, optionally library)
- Dexie.js stores complex structures and binary assets (fluency records, cached assets)

4. Synchronization:

- Server actions (`postFluencyRecords`, `getFluencyRecords`, `postLibrary`, `getLibrary`, `updateSession`) handle DB/remote updates
- Legend sync orchestrates when to fetch/push based on `saveProgress` and connectivity

5. Caching System:

- Dexie.js manages asset caching with expiration policies (8 sessions per-student or 14 days)
- Limit 300 assets, LRU trim by `lastAccessedAt`
- Posts usage stats snapshot for observability/tuning

6. Asset Management:

- Unified `getAsset` for audio/image/json/video; blob URL handling for binary
- Resource cleanup via optional `cleanup()`

7. Learning Analytics:

- Tracks reading fluency records
- Pure derivations compute action transitions and fluency levels

This multi-layered approach allows the application to function seamlessly in both online and offline scenarios while optimizing for performance and user experience.
