"use client";

import Dexie, { type EntityTable } from "dexie";
import type { FluencyRecord } from "@/lib/types/fluency-record";
import type { CachedAsset, SessionTracker } from "@/lib/types/cached-asset";

const fluencyRecordDB = new Dexie("FluencyRecordsDexie") as Dexie & {
  records: EntityTable<FluencyRecord, "id">;
};

// Schema declaration:
fluencyRecordDB.version(1).stores({
  records: "++id, studentId, word, timestamp",
});

const cachedAssetDB = new Dexie("CachedAssetsDatabase") as Dexie & {
  assets: EntityTable<CachedAsset, "url">; // Key is url
  sessions: EntityTable<SessionTracker, "sessionId">; // Track past sessions
};

cachedAssetDB.version(1).stores({
  assets: "url, cachedAt, lastUsedAt",
  sessions: "sessionId, sessionStarted", // Only one record for session tracking
});
export { fluencyRecordDB, cachedAssetDB };
