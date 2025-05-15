"use server";

interface cacheUsageStats {
  sessionId: string;
  studentCount?: number;
  assetCount: number;
  cacheSize: number; // bytes
  medianAccessCount: number;
  maxAccessCount: number;
  averageMinutesBetweenSessions: number;
}

export function postUsageStats(stats: cacheUsageStats) {
  console.log("postUsageStats", stats);
}
