# Cached Assets Implementation

## Overview

This document outlines the cached assets system using IndexedDB via Dexie.js. The caching system:

- Stores assets referenced by URL
- Tracks usage and freshness per student
- Automatically cleans up stale/obsolete assets
- Supports multiple asset types (audio, JSON, images, video)
- Provides offline-first functionality with network fallback

## Requirements

- Assets persist in IndexedDB (via Dexie.js)
- Per-student cache hygiene: "stale" is evaluated against the last 8 sessions for the current student
- Assets become obsolete after 14 days
- Maximum of 300 assets are kept in cache
- Each asset tracks size, first cache time, last access time, last accessed student, and access count
- Automatic cleanup of stale/obsolete assets
- Lightweight analytics posted after cleanup (asset count, size, median/max access count, avg time between sessions)
- Helper functions to access cached assets, with graceful fallback if IndexedDB is unavailable

## Type Definitions

The system uses the following types defined in [src/lib/types/cached-asset.ts](../../lib/types/cached-asset.ts):

### Supported Asset Types

```typescript
export type AssetType = "audio" | "json" | "image" | "video";
```
[Link to definition](../../lib/types/cached-asset.ts#L8)

### CachedAsset Interface

```typescript
export interface CachedAsset {
  url: string; // Primary key - unique identifier
  assetType: AssetType; // Type of asset
  data: Blob | string; // The actual asset data (Blob for binary, string for JSON)
  size: number; // Size of the asset in bytes
  cachedAt: Date; // When it was first cached
  lastAccessedAt: Date; // When it was last accessed
  lastAccessedBy: string; // Student ID who last accessed this asset
  accessCount: number; // How many times it's been accessed
}
```
[Link to definition](../../lib/types/cached-asset.ts#L13)

### Session Tracking

```typescript
export interface SessionTracker {
  sessionId: string; // Unique ID for the session
  studentId: string; // Student associated with this session
  sessionStarted: Date; // When the session started
}
```
[Link to definition](../../lib/types/cached-asset.ts#L27)

### Asset Retrieval

```typescript
export interface Asset {
  /**
   * The URL string to use for the asset.
   * This will be a temporary object URL (blob: URL) for cached/fetched binary types,
   * or the original URL if IndexedDB is unsupported or the type is 'json'.
   */
  assetUrl: string;

  /**
   * The parsed JavaScript object if the asset type is 'json'. Undefined otherwise.
   */
  assetJson?: object;

  /**
   * An optional function to call when you are finished with the asset to release
   * associated resources (e.g., revoke blob URLs).
   * This method is only present on the object if `assetUrl` is a temporary `blob:` URL.
   * Calling it multiple times has no additional effect.
   */
  cleanup?: () => void;
}

export interface GetAssetParams {
  /**
   * The original URL of the asset to retrieve.
   */
  url: string;

  /**
   * The type of asset.
   */
  assetType: "json" | "audio" | "image" | "video";
}
```
[Link to definitions](../../lib/types/cached-asset.ts#L36)

## Core Functions

Implementation in [cached-assets.ts](./cached-assets.ts):

### Session Tracking

- `logSession()` - Records a new app session (per student) and triggers cleanup ([line 21](./cached-assets.ts#L21))
- `cleanupStaleAssets()` - Removes assets that haven't been used in the last 8 sessions for the current student or are older than 14 days, and limits total assets to 300 ([line 43](./cached-assets.ts#L43))
- `logUsageStats()` - Posts anonymized cache usage metrics after cleanup completes (implementation calls [postCacheUsageStats](../../backend/analytics/post-stats.ts#L13)) ([line 102](./cached-assets.ts#L102))

### Asset Management

- `getAsset(params: GetAssetParams): Promise<Asset>` - Core function to get asset from cache or fetch from network ([line 177](./cached-assets.ts#L177))
- `clearCachedAssets()` - Purges all cached assets ([line 322](./cached-assets.ts#L322))

## Database Schema

IndexedDB tables defined in [db.ts](./db.ts):

```typescript
const cachedAssetDB = new Dexie("CachedAssetsDatabase") as Dexie & {
  assets: EntityTable<CachedAsset, "url">; // Key is url
  sessions: EntityTable<SessionTracker, "sessionId">; // Track past sessions
};

cachedAssetDB.version(1).stores({
  assets: "url, cachedAt, lastAccessedAt",
  sessions: "sessionId, sessionStarted",
});
```
[Link to schema definition](./db.ts#L17)

## Implementation Flow

### Asset Request Flow

1. When an asset is requested:
   - Check if asset exists in cache
   - If found, update `lastAccessedAt`, `lastAccessedBy`, and `accessCount`, then return data
   - If not found, fetch from network, store in cache, and return

2. For JSON assets:
   - Original URL is returned as `assetUrl`
   - Parsed data is provided in `assetJson`
   - No cleanup function needed

3. For binary assets (audio, image, video):
   - Blob URL is created and returned as `assetUrl`
   - `cleanup()` function provided to revoke blob URL when finished

### Cleanup Process (Per Student)

Triggered on every new session via `logSession()`:

1. Remove assets older than 14 days regardless of usage ([line 46](./cached-assets.ts#L46))
2. Get the 8th most recent session for the current student ([line 56](./cached-assets.ts#L56))
3. Remove assets for current student not accessed since that session date ([line 65](./cached-assets.ts#L65))
4. If total assets exceed 300, remove least recently used assets ([line 77](./cached-assets.ts#L77))
5. Post usage statistics via analytics ([line 99](./cached-assets.ts#L99))

### Constants

- `MAX_SESSIONS = 8` - Number of past sessions to track per student ([line 14](./cached-assets.ts#L14))
- `DAYS_UNTIL_OBSOLETE = 14` - Days until an asset is considered obsolete ([line 15](./cached-assets.ts#L15))
- `MAX_ASSETS = 300` - Maximum number of assets to keep in cache ([line 16](./cached-assets.ts#L16))

## Usage Examples

### Audio Playback

```typescript
// For audio playbook
const wordAudio = await getAsset({
  url: "https://example.com/audio.mp3",
  assetType: "audio",
});
audioElement.src = wordAudio.assetUrl;

// Important: Call cleanup when done with the asset
audioElement.onended = () => {
  wordAudio.cleanup?.();
};
```

### JSON Data

```typescript
// For JSON data
const reading = await getAsset({
  url: "https://example.com/data.json",
  assetType: "json",
});
const data = reading.assetJson;
// No cleanup needed for JSON assets
```

### Images

```typescript
// For images
const thumbnail = await getAsset({
  url: "https://example.com/image.jpg",
  assetType: "image",
});
imageElement.src = thumbnail.assetUrl;

// Important: Clean up image resources when no longer needed
imageElement.onload = () => {
  // Do something with the loaded image
};
// Clean up when image is no longer displayed
thumbnail.cleanup?.();
```

### Video

```typescript
// For video
const videoAsset = await getAsset({
  url: "https://example.com/video.mp4",
  assetType: "video",
});
videoElement.src = videoAsset.assetUrl;

// Important: Clean up video resources when no longer needed
videoElement.onended = () => {
  videoAsset.cleanup?.();
};
```

## Important Notes

- For JSON assets, `assetUrl` remains the original URL and `assetJson` is populated
- If IndexedDB is unavailable, assets are fetched and returned (binary via blob URL), but not persisted
- The cleanup function should always be called for binary assets to prevent memory leaks
- Assets are cached per-student to support multi-user scenarios
- Analytics are collected anonymously to help optimize cache policy

## Benefits

- Reduces network requests for frequently used assets
- Improves app performance and offline capabilities  
- Automatically manages storage to prevent bloat (per-student usage aware)
- Provides consistent API for all asset types
- Emits lightweight analytics to help tune cache policy
