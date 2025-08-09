// app/api/ping/route.ts
import { NextResponse } from "next/server";

/**
 * Simple ping endpoint for connection testing and performance monitoring
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    server: "read-by-ear-api",
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Timestamp": new Date().toISOString(),
    },
  });
}
