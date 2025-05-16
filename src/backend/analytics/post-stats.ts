"use server";

interface cacheUsage {
  sessionId: string;
  studentCount?: number;
  assetCount: number;
  cacheSize: number; // bytes
  medianAccessCount: number;
  maxAccessCount: number;
  averageMinutesBetweenSessions?: number;
}

export function postCacheUsageStats(stats: cacheUsage) {
  console.log("postUsageStats", stats);
}
