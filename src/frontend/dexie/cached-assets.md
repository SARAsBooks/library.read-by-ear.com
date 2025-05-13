# Cached Assets Implementation

## Overview

This document outlines the implementation of cached assets using Dexie.js. The caching system:

- Stores assets referenced by URL
- Tracks usage and freshness
- Automatically cleans up stale/obsolete assets
- Supports multiple asset types (audio, JSON, images, video)

## Requirements

- Assets persist in IndexedDB (via Dexie.js)
- Assets become stale after not being used for 8 sessions
- Assets become obsolete after 14 days
- Maximum of 300 assets are kept in cache
- Each asset has timestamps for caching and last use
- Automatic cleanup of stale/obsolete assets
- Helper functions to access cached assets

## Type Definitions

The system uses the following types defined in `src/lib/types/cached-asset.ts`:

```typescript
export type AssetType = "audio" | "json" | "image" | "video";

export interface CachedAsset {
  url: string; // Primary key - unique identifier
  assetType: AssetType; // Type of asset
  data: Blob | string; // The actual asset data (Blob for binary, string for JSON)
  cachedAt: Date; // When it was first cached
  lastUsedAt: Date; // When it was last accessed
  accessCount: number; // How many times it's been accessed
}

export interface SessionTracker {
  sessionId: string; // Unique ID for the session
  sessionStarted: Date; // When the session started
}

export interface Asset {
  assetUrl: string; // URL to use for the asset (original or blob URL)
  assetJson?: object; // Parsed JSON (only for JSON assets)
  cleanup?: () => void; // Function to release resources (for blob URLs)
}

export interface GetAssetParams {
  url: string; // Original URL of the asset
  assetType: "json" | "audio" | "image" | "video"; // Asset type
}
```

## Core Functions

### Session Tracking

- `recordSession()` - Records a new app session and updates the session tracker
- `cleanupStaleAssets()` - Removes assets that haven't been used in the last 8 sessions or are older than 14 days, and limits total assets to 300

### Asset Management

- `getAsset(params: GetAssetParams): Promise<Asset>` - Core function to get asset from cache or fetch from network
- `clearCachedAssets()` - Purges all cached assets

### Implementation Flow

1. When an asset is requested:

   - Check if asset exists in cache
   - If found, update lastUsedAt and accessCount, then return data
   - If not found, fetch from network, store in cache, and return

2. Cleanup process:
   - Triggered on every new session
   - Removes assets not used since oldest of 8 tracked sessions
   - Removes assets older than 14 days regardless of use
   - Limits total cached assets to 300, removing least recently used first

## Usage Example

```typescript
// For audio playback
const wordAudio = await getAsset({
  url: "https://example.com/audio.mp3",
  assetType: "audio",
});
audioElement.src = wordAudio.assetUrl;

// Important: Call cleanup when done with the asset
audioElement.onended = () => {
  wordAudio.cleanup?.();
};

// For JSON data
const reading = await getAsset({
  url: "https://example.com/data.json",
  assetType: "json",
});
const data = reading.assetJson;

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
imageElement.onunload = () => {
  thumbnail.cleanup?.();
};
```

## Benefits

- Reduces network requests for frequently used assets
- Improves app performance and offline capabilities
- Automatically manages storage to prevent bloat
- Provides consistent API for all asset types
