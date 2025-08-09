import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { insertFluencyRecords } from "@/backend/db/fluency-records";
import type { FluencyRecord } from "@/lib/types/fluency-record";

/**
 * POST /api/learning-audit
 *
 * Background sync API endpoint for writing learning records from Convex to PostgreSQL
 * for audit trail purposes. This endpoint is called by Convex mutations to maintain
 * a complete audit log in PostgreSQL while using Convex as the working set.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      records: unknown[];
      studentId: unknown;
      source?: string;
    };
    const { records, studentId, source } = body;

    // Validate request
    if (!Array.isArray(records) || typeof studentId !== "string") {
      return NextResponse.json(
        { error: "Invalid request: records array and studentId required" },
        { status: 400 },
      );
    }

    // Validate that records are FluencyRecord format
    const validRecords: FluencyRecord[] = records.map((record: unknown) => {
      if (
        typeof record !== "object" ||
        record === null ||
        !("studentId" in record) ||
        !("word" in record) ||
        !("response" in record) ||
        !("timestamp" in record) ||
        typeof (record as { studentId: unknown }).studentId !== "string" ||
        typeof (record as { word: unknown }).word !== "string" ||
        typeof (record as { response: unknown }).response !== "number" ||
        (typeof (record as { timestamp: unknown }).timestamp !== "string" &&
          typeof (record as { timestamp: unknown }).timestamp !== "number")
      ) {
        throw new Error("Invalid record format");
      }

      const validRecord = record as {
        studentId: string;
        word: string;
        response: number;
        timestamp: string | number;
      };

      return {
        studentId: validRecord.studentId,
        word: validRecord.word,
        response: validRecord.response,
        timestamp: new Date(validRecord.timestamp), // Ensure timestamp is Date object
      };
    });

    // Log audit operation
    console.log(
      `[Audit] Syncing ${validRecords.length} learning records to PostgreSQL`,
      {
        studentId,
        source: source ?? "convex",
        recordCount: validRecords.length,
        words: [...new Set(validRecords.map((r) => r.word))],
      },
    );

    // Insert records into PostgreSQL
    await insertFluencyRecords(validRecords);

    console.log(
      `[Audit] Successfully synced ${validRecords.length} learning records to PostgreSQL`,
    );

    return NextResponse.json({
      success: true,
      recordsProcessed: validRecords.length,
      studentId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[Audit] Error syncing learning records to PostgreSQL:",
      error,
    );

    return NextResponse.json(
      {
        error: "Failed to sync learning records to audit database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/learning-audit?studentId=<id>&summary=true
 *
 * Optional endpoint to get audit summary information for debugging/monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const summary = searchParams.get("summary") === "true";

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId query parameter required" },
        { status: 400 },
      );
    }

    if (summary) {
      // For now, return basic info - could be enhanced to query PostgreSQL for audit statistics
      return NextResponse.json({
        studentId,
        auditEnabled: true,
        lastChecked: new Date().toISOString(),
        message: "Audit trail is active for learning records",
      });
    }

    return NextResponse.json(
      { error: "Only summary view is currently supported" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[Audit] Error checking audit status:", error);

    return NextResponse.json(
      { error: "Failed to check audit status" },
      { status: 500 },
    );
  }
}
