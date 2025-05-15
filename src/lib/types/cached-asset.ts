/**
 * Types for cached assets system.
 */

/**
 * Supported asset types for caching.
 */
export type AssetType = "audio" | "json" | "image" | "video";

/**
 * Represents a cached asset in the IndexedDB.
 */
export interface CachedAsset {
  url: string; // Primary key - unique identifier
  assetType: AssetType; // Type of asset
  data: Blob | string; // The actual asset data (Blob for binary, string for JSON)
  size: number; // Size of the asset in bytes
  cachedAt: Date; // When it was first cached
  lastAccessedAt: Date; // When it was last accessed
  lastAccessedBy: string; // When it was last accessed
  accessCount: number; // How many times it's been accessed
}

/**
 * Tracks user sessions for cache management.
 */
export interface SessionTracker {
  sessionId: string; // Unique ID for the session
  studentId: string; // Optional student ID
  sessionStarted: Date; // Array of timestamps of the last 5 sessions
}

/**
 * Represents the retrieved asset data and provides an optional method for cleanup.
 */
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

/**
 * Interface defining the input parameters for getAsset.
 */
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
