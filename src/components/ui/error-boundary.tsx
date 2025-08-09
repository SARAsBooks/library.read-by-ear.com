// components/ui/error-boundary.tsx
"use client";

import React from "react";
import { performanceMonitor } from "@/lib/performance/monitor";
import { config } from "@/lib/config/environment";

export interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    errorId: string;
    retry: () => void;
  }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

/**
 * Enhanced Error Boundary with monitoring and performance tracking
 * Integrates with Phase 4 performance monitoring system
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId;

    // Enhanced error info
    const enhancedErrorInfo: ErrorInfo = {
      ...errorInfo,
      errorBoundary: this.constructor.name,
    };

    // Record performance metric for error
    performanceMonitor.recordMetric({
      name: "react-error",
      value: 1,
      unit: "count",
      timestamp: Date.now(),
      tags: {
        errorId,
        errorName: error.name,
        errorMessage: error.message.substring(0, 100), // Truncate long messages
        component: this.getComponentName(errorInfo.componentStack),
        environment: config.getConfig().env,
      },
    });

    // Log error details
    if (config.isFeatureEnabled("enableErrorReporting")) {
      console.error("[ErrorBoundary] React error caught:", {
        errorId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo: enhancedErrorInfo,
        timestamp: new Date().toISOString(),
        url: typeof window !== "undefined" ? window.location.href : "unknown",
        userAgent:
          typeof window !== "undefined"
            ? window.navigator.userAgent
            : "unknown",
      });

      // Send to external error service if configured
      void this.reportErrorToService(error, enhancedErrorInfo, errorId);
    }

    // Update state with error info
    this.setState({
      errorInfo: enhancedErrorInfo,
    });

    // Call custom error handler
    this.props.onError?.(error, enhancedErrorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, idx) => key !== prevProps.resetKeys![idx],
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }

    // Reset error boundary when any prop changes (if resetOnPropsChange is true)
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    });

    performanceMonitor.recordMetric({
      name: "error-boundary-reset",
      value: 1,
      unit: "count",
      timestamp: Date.now(),
      tags: {
        component: this.constructor.name,
      },
    });
  };

  /**
   * Auto-retry with exponential backoff
   */
  scheduleRetry = (delayMs = 5000) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = window.setTimeout(() => {
      console.log("[ErrorBoundary] Auto-retrying after error");
      this.resetErrorBoundary();
    }, delayMs);
  };

  render() {
    const { hasError, error, errorId } = this.state;
    const { children, fallback: FallbackComponent } = this.props;

    if (hasError && error) {
      // Use custom fallback component if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            errorId={errorId}
            retry={this.resetErrorBoundary}
          />
        );
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={error}
          errorId={errorId}
          retry={this.resetErrorBoundary}
        />
      );
    }

    return children;
  }

  /**
   * Extract component name from component stack
   */
  private getComponentName(componentStack: string): string {
    const lines = componentStack.split("\n").filter((line) => line.trim());
    const firstComponent = lines[1] ?? lines[0] ?? "";
    const match = /^\s*(?:in\s+)?(\w+)/.exec(firstComponent);
    return match ? (match[1] ?? "Unknown") : "Unknown";
  }

  /**
   * Report error to external monitoring service
   */
  private async reportErrorToService(
    error: Error,
    errorInfo: ErrorInfo,
    errorId: string,
  ): Promise<void> {
    try {
      // Only report in production
      if (!config.isFeatureEnabled("enableErrorReporting")) {
        return;
      }

      const errorReport = {
        errorId,
        timestamp: Date.now(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo,
        context: {
          url: typeof window !== "undefined" ? window.location.href : "unknown",
          userAgent:
            typeof window !== "undefined"
              ? window.navigator.userAgent
              : "unknown",
          environment: config.getConfig().env,
          version: config.getConfig().version,
        },
      };

      // Send to API endpoint (implement based on your error service)
      await fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorReport),
      }).catch((err) => {
        console.warn("[ErrorBoundary] Failed to report error:", err);
      });
    } catch (reportError) {
      console.warn("[ErrorBoundary] Error reporting failed:", reportError);
    }
  }
}

/**
 * Default fallback component when no custom fallback is provided
 */
function DefaultErrorFallback({
  error,
  errorId,
  retry,
}: {
  error: Error;
  errorId: string;
  retry: () => void;
}) {
  const isDevelopment = config.getConfig().isDevelopment;

  return (
    <div className="flex min-h-[200px] items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h3 className="mb-2 text-lg font-semibold text-gray-900">
          Something went wrong
        </h3>

        <p className="mb-4 text-sm text-gray-600">
          We encountered an unexpected error. Please try again.
        </p>

        {isDevelopment && (
          <details className="mb-4 rounded bg-gray-100 p-3 text-left text-xs">
            <summary className="cursor-pointer font-medium">
              Error Details
            </summary>
            <div className="mt-2 space-y-2">
              <div>
                <strong>Error ID:</strong> {errorId}
              </div>
              <div>
                <strong>Message:</strong> {error.message}
              </div>
              <div>
                <strong>Stack:</strong>
                <pre className="mt-1 break-all whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </div>
            </div>
          </details>
        )}

        <div className="space-x-3">
          <button
            onClick={retry}
            className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            Try Again
          </button>

          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            Reload Page
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500">Error ID: {errorId}</p>
      </div>
    </div>
  );
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryConfig?: Omit<ErrorBoundaryProps, "children">,
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryConfig}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName ?? Component.name})`;

  return WrappedComponent;
}

/**
 * React hook to manually report errors
 */
export function useErrorReporting() {
  const reportError = React.useCallback(
    (error: Error, context?: Record<string, unknown>) => {
      const errorId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Record performance metric
      performanceMonitor.recordMetric({
        name: "manual-error-report",
        value: 1,
        unit: "count",
        timestamp: Date.now(),
        tags: {
          errorId,
          errorName: error.name,
          errorMessage: error.message.substring(0, 100),
          hasContext: context ? "true" : "false",
        },
      });

      // Log error
      console.error("[ErrorReporting] Manual error report:", {
        errorId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
        timestamp: new Date().toISOString(),
      });

      return errorId;
    },
    [],
  );

  return { reportError };
}
