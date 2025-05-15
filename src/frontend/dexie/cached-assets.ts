"use client";

import type {
  Asset,
  GetAssetParams,
  AssetType,
} from "@/lib/types/cached-asset";
import { tryCatch } from "@/lib/util/try-catch";
import { cachedAssetDB } from "./db";
import { session$ } from "@/frontend/observable/sessions";
import { postUsageStats } from "@/backend/analytics/post-stats";

// Constants
const MAX_SESSIONS = 8; // Number of past sessions to track
const DAYS_UNTIL_OBSOLETE = 14; // Days until an asset is considered obsolete
const MAX_ASSETS = 300; // Maximum number of assets to keep in cache

/**
 * Records a new app session and updates the session tracker
 */
export async function logSession(): Promise<void> {
  const sessionId = session$.sessionId.peek();
  if (!sessionId) return;
  const sessionExists = await cachedAssetDB.sessions
    .get(sessionId)
    .catch(() => false);
  if (sessionExists) return;
  // insert new session
  await cachedAssetDB.sessions
    .add({
      sessionId,
      studentId: session$.studentId.peek() ?? "",
      sessionStarted: new Date(),
    })
    .catch(() => null);
  console.log(`Session recorded: ${sessionId}`);
  void cleanupStaleAssets();
}

/**
 * Removes assets that haven't been used in the last MAX_SESSIONS or are older than 14 days
 */
export async function cleanupStaleAssets(): Promise<void> {
  const studentId = session$.studentId.peek() ?? "";
  // Calculate obsolete date (14 days ago)
  const now = new Date();
  const obsoleteDate = new Date(
    now.getTime() - DAYS_UNTIL_OBSOLETE * 24 * 60 * 60 * 1000,
  );
  await cachedAssetDB.assets
    .where("cachedAt")
    .below(obsoleteDate)
    .delete()
    .catch(() => null);

  const oldSessionDate = await cachedAssetDB.sessions
    .orderBy("sessionStarted")
    .reverse()
    .filter((session) => session.studentId === studentId)
    .offset(MAX_SESSIONS)
    .first()
    .then((session) => session?.sessionStarted)
    .catch(() => null);
  if (!oldSessionDate) return;
  await cachedAssetDB.assets
    .where("lastAccessedAt")
    .below(oldSessionDate)
    .filter((asset) => asset.lastAccessedBy === studentId)
    .delete()
    .catch(() => null);
  await cachedAssetDB.sessions
    .where("sessionStarted")
    .below(oldSessionDate)
    .filter((session) => session.studentId === studentId)
    .delete();

  // truncate cached assets to MAX_ASSETS
  const totalAssets = await cachedAssetDB.assets.count().catch(() => 0);
  if (totalAssets <= MAX_ASSETS) {
    void logUsageStats();
    return;
  }
  // order by lastAccessedAt and select the index of MAX_ASSETS
  const maxAssetDate = await cachedAssetDB.assets
    .orderBy("lastAccessedAt")
    .reverse()
    .offset(MAX_ASSETS)
    .first()
    .then((asset) => asset?.lastAccessedAt);
  if (!maxAssetDate) {
    void logUsageStats();
    return;
  }
  await cachedAssetDB.assets
    .where("lastAccessedAt")
    .below(maxAssetDate)
    .delete()
    .catch(() => null);
  void logUsageStats();
}

async function logUsageStats() {
  const sessionId = session$.sessionId.peek();
  if (!sessionId) return;
  const sessionCount = await cachedAssetDB.sessions.count().catch(() => 0);
  if (sessionCount < MAX_SESSIONS) return;
  const assetCount = await cachedAssetDB.assets.count().catch(() => 0);
  if (!assetCount) return;
  const cacheSize = await cachedAssetDB.assets
    .toArray()
    .then((assets) =>
      assets.reduce((total, asset) => total + (asset.size ?? 0), 0),
    );
  const accessCounts = await cachedAssetDB.assets
    .orderBy("accessCount")
    .toArray()
    .then((assets) => assets.map((asset) => asset.accessCount));
  const medianAccessCount =
    accessCounts[Math.floor(accessCounts.length / 2)] ?? 0;
  const maxAccessCount = Math.max(...accessCounts, 0);
  const oldSessionDate = await cachedAssetDB.sessions
    .orderBy("sessionStarted")
    .reverse()
    .offset(MAX_SESSIONS)
    .first()
    .then((session) => session?.sessionStarted);
  const lastSessionDate = await cachedAssetDB.sessions
    .orderBy("sessionStarted")
    .reverse()
    .first()
    .then((session) => session?.sessionStarted);
  if (!oldSessionDate || !lastSessionDate || oldSessionDate === lastSessionDate)
    return;
  const averageMinutesBetweenSessions = Math.floor(
    (lastSessionDate.getTime() - oldSessionDate.getTime()) /
      (1000 * 60 * MAX_SESSIONS),
  );
  void postUsageStats({
    sessionId,
    studentCount: session$.students.peek()?.length,
    assetCount,
    cacheSize,
    medianAccessCount,
    maxAccessCount,
    averageMinutesBetweenSessions,
  });
}

/**
 * Check if IndexedDB is supported in the current browser
 */
function isIndexedDBSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    typeof window.IDBKeyRange !== "undefined"
  );
}

/**
 * Asynchronously retrieves an asset from the cache (IndexedDB) or fetches it from the network.
 *
 * @param params - An object containing the asset's url and type.
 * @returns A Promise that resolves with an Asset object.
 * @throws Error if the asset cannot be retrieved.
 */
export async function getAsset(params: GetAssetParams): Promise<Asset> {
  void logSession();
  const { url, assetType } = params;
  const cachedAsset = await tryCatch(cachedAssetDB.assets.get(url));

  if (assetType === "json") {
    if (!cachedAsset.ok) return fetchAssetFromNetwork(url, assetType);

    await cachedAssetDB.assets.update(url, {
      lastAccessedAt: new Date(),
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
      lastAccessedAt: new Date(),
      lastAccessedBy: session$.studentId.peek() ?? "",
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

/**
 * Fetches an asset from the network
 */
async function fetchAssetFromNetwork(
  url: string,
  assetType: "json" | "audio" | "image" | "video",
): Promise<Asset> {
  const response = await tryCatch(fetch(url));

  if (response.error) {
    console.log(`Network response was not ok: ${response.error}`);
    return { assetUrl: url };
  }

  if (assetType === "json") {
    // Handle JSON data
    const assetJson = (await response.data.json()) as object;

    // Cache the JSON if IndexedDB is supported
    if (isIndexedDBSupported()) {
      cacheAsset(url, "json", JSON.stringify(assetJson)).catch((err) =>
        console.error("Failed to cache JSON:", err),
      );
    }

    return { assetUrl: url, assetJson };
  }
  // Handle binary data
  const blob = await response.data.blob();

  // Cache the binary data if IndexedDB is supported
  if (isIndexedDBSupported()) {
    cacheAsset(url, assetType, blob).catch((err) =>
      console.error(`Failed to cache ${assetType}:`, err),
    );
  }

  // Create a blob URL
  const blobUrl = URL.createObjectURL(blob);

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

/**
 * Caches an asset in IndexedDB
 */
async function cacheAsset(
  url: string,
  assetType: AssetType,
  data: Blob | string,
): Promise<void> {
  if (!isIndexedDBSupported()) return;

  const now = new Date();

  try {
    // Check if asset already exists
    const existingAsset = await cachedAssetDB.assets.get(url);

    if (existingAsset) {
      // Update existing asset
      await cachedAssetDB.assets.update(url, {
        data,
        lastAccessedAt: now,
        accessCount: existingAsset.accessCount + 1,
      });
    } else {
      // Add new asset
      await cachedAssetDB.assets.add({
        url,
        assetType,
        data,
        size: data instanceof Blob ? data.size : new Blob([data]).size,
        cachedAt: now,
        lastAccessedAt: now,
        lastAccessedBy: session$.studentId.peek() ?? "",
        accessCount: 1,
      });
    }
  } catch (error) {
    console.error("Failed to cache asset:", error);
    throw error;
  }
}

/**
 * Purges all cached assets
 */
export async function clearCachedAssets(): Promise<void> {
  try {
    await cachedAssetDB.assets.clear();
    console.log("Cleared all cached assets");
  } catch (error) {
    console.error("Failed to clear cached assets:", error);
  }
}
