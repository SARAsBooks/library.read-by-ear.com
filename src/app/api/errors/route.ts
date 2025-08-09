// app/api/errors/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { config } from "@/lib/config/environment";

/**
 * Error reporting endpoint for client-side error tracking
 * Part of Phase 4 error monitoring system
 */

interface ErrorReport {
  errorId: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  errorInfo?: {
    componentStack?: string;
    errorBoundary?: string;
  };
  context: {
    url: string;
    userAgent: string;
    environment: string;
    version: string;
  };
}

interface ErrorStorage {
  id: string;
  timestamp: number;
  environment: string;
  version: string;
  errorName: string;
  errorMessage: string;
  errorStack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  count: number;
  lastOccurrence: number;
}

// In-memory error storage (replace with database in production)
const errorStorage = new Map<string, ErrorStorage>();
const MAX_ERRORS = 1000;

/**
 * Report client-side errors
 */
export async function POST(request: NextRequest) {
  try {
    const envConfig = config.getConfig();

    // Only accept error reports if error reporting is enabled
    if (!envConfig.features.enableErrorReporting) {
      return NextResponse.json(
        { error: "Error reporting disabled" },
        { status: 403 },
      );
    }

    const reportData = (await request.json()) as unknown;

    if (!reportData) {
      return NextResponse.json(
        { error: "Invalid error report" },
        { status: 400 },
      );
    }

    // Validate error report structure
    if (!isValidErrorReport(reportData)) {
      return NextResponse.json(
        { error: "Invalid error report format" },
        { status: 400 },
      );
    }

    const errorReport = reportData;

    // Create error key for deduplication
    const errorKey = createErrorKey(errorReport);
    const now = Date.now();

    // Store or update error
    const existingError = errorStorage.get(errorKey);
    if (existingError) {
      // Update existing error
      existingError.count++;
      existingError.lastOccurrence = now;
    } else {
      // Store new error
      const errorData: ErrorStorage = {
        id: errorReport.errorId,
        timestamp: errorReport.timestamp,
        environment: errorReport.context.environment,
        version: errorReport.context.version,
        errorName: errorReport.error.name,
        errorMessage: errorReport.error.message,
        errorStack: errorReport.error.stack,
        componentStack: errorReport.errorInfo?.componentStack,
        url: errorReport.context.url,
        userAgent: errorReport.context.userAgent,
        count: 1,
        lastOccurrence: now,
      };

      errorStorage.set(errorKey, errorData);

      // Cleanup old errors if storage is full
      if (errorStorage.size > MAX_ERRORS) {
        cleanupOldErrors();
      }
    }

    // Log error in development
    if (envConfig.isDevelopment) {
      console.error("[ErrorAPI] Error reported:", {
        errorId: errorReport.errorId,
        error: errorReport.error.name,
        message: errorReport.error.message,
        url: errorReport.context.url,
      });
    }

    // In production, you might want to forward to external error service
    if (envConfig.isProduction) {
      await forwardToExternalService(errorReport).catch((err) => {
        console.warn(
          "[ErrorAPI] Failed to forward error to external service:",
          err,
        );
      });
    }

    return NextResponse.json({
      success: true,
      errorId: errorReport.errorId,
      stored: true,
    });
  } catch (error) {
    console.error("[ErrorAPI] Error processing error report:", error);

    return NextResponse.json(
      { error: "Failed to process error report" },
      { status: 500 },
    );
  }
}

/**
 * Get error statistics (for monitoring/debugging)
 */
export async function GET(request: NextRequest) {
  try {
    const envConfig = config.getConfig();

    // Only allow in development or with proper auth
    if (envConfig.isProduction) {
      return NextResponse.json(
        { error: "Not available in production" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const _since = searchParams.get("since");
    const environment = searchParams.get("environment");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const sinceTimestamp = _since
      ? parseInt(_since, 10)
      : Date.now() - 24 * 60 * 60 * 1000; // Last 24 hours

    // Filter errors
    let errors = Array.from(errorStorage.values()).filter(
      (error) => error.lastOccurrence >= sinceTimestamp,
    );

    if (environment) {
      errors = errors.filter((error) => error.environment === environment);
    }

    // Sort by last occurrence (most recent first)
    errors.sort((a, b) => b.lastOccurrence - a.lastOccurrence);

    // Limit results
    errors = errors.slice(0, limit);

    // Calculate statistics
    const stats = {
      totalErrors: errorStorage.size,
      recentErrors: errors.length,
      topErrors: getTopErrors(errors, 10),
      errorsByEnvironment: getErrorsByEnvironment(errors),
      errorsByHour: getErrorsByHour(errors, sinceTimestamp),
    };

    return NextResponse.json({
      stats,
      errors,
      timeRange: {
        since: sinceTimestamp,
        until: Date.now(),
      },
    });
  } catch (error) {
    console.error("[ErrorAPI] Error fetching error stats:", error);

    return NextResponse.json(
      { error: "Failed to fetch error statistics" },
      { status: 500 },
    );
  }
}

// Helper functions

function isValidErrorReport(report: unknown): report is ErrorReport {
  if (typeof report !== "object" || report === null) return false;

  const r = report as Record<string, unknown>;

  return (
    typeof r.errorId === "string" &&
    typeof r.timestamp === "number" &&
    typeof r.error === "object" &&
    r.error !== null &&
    typeof (r.error as Record<string, unknown>).name === "string" &&
    typeof (r.error as Record<string, unknown>).message === "string" &&
    typeof r.context === "object" &&
    r.context !== null &&
    typeof (r.context as Record<string, unknown>).url === "string" &&
    typeof (r.context as Record<string, unknown>).userAgent === "string" &&
    typeof (r.context as Record<string, unknown>).environment === "string" &&
    typeof (r.context as Record<string, unknown>).version === "string"
  );
}

function createErrorKey(report: ErrorReport): string {
  // Create key for deduplication based on error name, message, and component
  const componentStack = report.errorInfo?.componentStack ?? "";
  const component = componentStack.split("\n")[1] ?? "unknown";

  return `${report.error.name}:${report.error.message}:${component}:${report.context.environment}`;
}

function cleanupOldErrors(): void {
  const errors = Array.from(errorStorage.entries());

  // Sort by last occurrence (oldest first)
  errors.sort(([, a], [, b]) => a.lastOccurrence - b.lastOccurrence);

  // Remove oldest 20% of errors
  const toRemove = Math.floor(errors.length * 0.2);
  for (let i = 0; i < toRemove; i++) {
    const entry = errors[i];
    if (entry) {
      errorStorage.delete(entry[0]);
    }
  }
}

function getTopErrors(errors: ErrorStorage[], limit: number) {
  return errors
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((error) => ({
      errorName: error.errorName,
      errorMessage: error.errorMessage,
      count: error.count,
      lastOccurrence: error.lastOccurrence,
    }));
}

function getErrorsByEnvironment(errors: ErrorStorage[]) {
  const byEnvironment: Record<string, number> = {};

  errors.forEach((error) => {
    byEnvironment[error.environment] =
      (byEnvironment[error.environment] ?? 0) + error.count;
  });

  return byEnvironment;
}

function getErrorsByHour(errors: ErrorStorage[], _since: number) {
  const hourlyData: Record<string, number> = {};
  const now = Date.now();

  // Initialize hourly buckets
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now - i * 60 * 60 * 1000).getHours();
    hourlyData[hour] = 0;
  }

  // Count errors by hour
  errors.forEach((error) => {
    const hour = new Date(error.lastOccurrence).getHours();
    hourlyData[hour] = (hourlyData[hour] ?? 0) + error.count;
  });

  return hourlyData;
}

async function forwardToExternalService(
  errorReport: ErrorReport,
): Promise<void> {
  // Example: Forward to Sentry, LogRocket, or other error tracking service
  // Implementation depends on your chosen service

  const externalServiceUrl = process.env.EXTERNAL_ERROR_SERVICE_URL;
  const apiKey = process.env.EXTERNAL_ERROR_SERVICE_KEY;

  if (!externalServiceUrl || !apiKey) {
    return; // No external service configured
  }

  await fetch(externalServiceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      ...errorReport,
      service: "read-by-ear",
      timestamp: new Date(errorReport.timestamp).toISOString(),
    }),
  });
}
