# Cached Assets Implementation Strategy

## Overview
This document outlines the implementation strategy for cached assets using Dexie.js. The caching system will:
- Store assets referenced by URL
- Track usage and freshness
- Automatically clean up stale/obsolete assets
- Support multiple asset types (audio, JSON, images, video)

## Requirements
- Assets should persist in IndexedDB (via Dexie.js)
- Assets become stale after 5 sessions without use
- Assets become obsolete after 14 days
- Each asset has timestamps for caching and last use
- Automatic cleanup of stale/obsolete assets
- Helper functions to access cached assets

## Type Definitions

```typescript
// src/lib/types/cached-asset.ts
export type AssetType = 'audio' | 'readingJSON' | 'images' | 'video';

export interface CachedAsset {
  url: string;           // Primary key - unique identifier
  type: AssetType;       // Type of asset
  data: Blob | string;   // The actual asset data (Blob for binary, string for JSON)
  cachedAt: Date;        // When it was first cached
  lastUsedAt: Date;      // When it was last accessed
  accessCount: number;   // How many times it's been accessed
}

export interface SessionTracker {
  id: string;            // ID for the session tracker (there will only be one record)
  pastSessions: Date[];  // Array of timestamps of the last 5 sessions
}
```

## Database Schema

```typescript
// src/frontend/dexie/cached-asset.ts
"use client";

import Dexie, { type Table } from "dexie";
import type { CachedAsset, SessionTracker } from "@/lib/types/cached-asset";

const db = new Dexie("CachedAssetsDexie") as Dexie & {
  assets: Table<CachedAsset, string>; // Key is url
  sessions: Table<SessionTracker, string>; // Track past sessions
};

// Schema declaration:
db.version(1).stores({
  assets: "url, type, cachedAt, lastUsedAt",
  sessions: "id" // Only one record for session tracking
});
```

## Core Functions

### Session Tracking
- `recordSession()` - Records a new app session and updates the session tracker
- `cleanupStaleAssets()` - Removes assets that haven't been used in 5 sessions or are older than 14 days

### Asset Management
- `getAsset(url, type)` - Core function to get asset from cache or fetch from network
- Type-specific helpers:
  - `getAudioAsset(url)` - Returns Object URL for audio playback
  - `getJSONAsset<T>(url)` - Returns parsed JSON data
  - `getImageAsset(url)` - Returns Object URL for image display
  - (Similar function for video assets)
- `clearCachedAssets()` - Purges all cached assets

## Implementation Flow

1. When an asset is requested:
   - Record the current session
   - Check if asset exists in cache
   - If found, update lastUsedAt and return data
   - If not found, fetch from network, store in cache, and return

2. Cleanup process:
   - Triggered on every new session
   - Removes assets not used since oldest of 5 tracked sessions
   - Removes assets older than 14 days regardless of use

## Usage Pattern

```typescript
// For audio playback
const audioUrl = await getAudioAsset("https://example.com/audio.mp3");
audioElement.src = audioUrl;

// For JSON data
const data = await getJSONAsset<ReadingData>("https://example.com/data.json");

// For images
const imageUrl = await getImageAsset("https://example.com/image.jpg");
imageElement.src = imageUrl;
```

## Benefits
- Reduces network requests for frequently used assets
- Improves app performance and offline capabilities
- Automatically manages storage to prevent bloat
- Provides consistent API for all asset types