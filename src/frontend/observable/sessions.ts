// frontend/observable/sessions.ts
"use client";

import { observable } from "@legendapp/state";
import { syncObservable } from "@legendapp/state/sync";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import type { Session } from "@/lib/types/session";
import { updateSession } from "@/backend/actions/session";
import { SaraAuthClient } from "@/lib/auth/sara-client";
import { AuthenticatedConvexClient } from "@/lib/convex/auth";
import { config } from "@/lib/config/environment";
import { performanceMonitor } from "@/lib/performance/monitor";

/**
 * The session$ observable is used to manage the session state of the application.
 * It is initialized with default values and is synchronized with local storage.
 *
 * @type {Observable<Session>} - The observable representing the session state.
 */
export const session$ = observable<Session>({
  anonymous: true,
  authenticated: false,
  lastActive: Date.now(),
  useConvex: false, // Default to false for backward compatibility
});

// Auth clients for Phase 4 integration
let saraAuthClient: SaraAuthClient | null = null;
let convexClient: AuthenticatedConvexClient | null = null;

/**
 * Initialize auth clients when feature flags enable them
 */
function initializeAuthClients(): void {
  if (!saraAuthClient && config.isFeatureEnabled("useConvexAuth")) {
    const authConfig = config.getConfig();

    saraAuthClient = new SaraAuthClient({
      baseUrl: authConfig.services.auth,
      clientVersion: authConfig.version,
      enableDebug: authConfig.features.enableDebugMode,
    });

    convexClient = new AuthenticatedConvexClient({
      url: authConfig.services.convex,
      verbose: authConfig.features.enableDebugMode,
    });

    console.log("[Sessions] Auth clients initialized for Phase 4");
  }
}

/**
 * Authenticate session with auth.sara.ai and get JWT token
 */
export async function authenticateSession(
  studentId: string,
  sessionId: string,
  options: {
    deviceOwnership: "private" | "public" | "family" | "school";
    saveProgress: "sync";
    metadata?: Record<string, unknown>;
  },
): Promise<{ success: boolean; token?: string; error?: string }> {
  const startTime = performance.now();

  try {
    initializeAuthClients();

    if (
      !saraAuthClient ||
      !convexClient ||
      !config.isFeatureEnabled("useConvexAuth")
    ) {
      console.log(
        "[Sessions] Auth integration disabled, using development mode",
      );
      return { success: true }; // Fallback for development
    }

    // Register session with auth.sara.ai
    const authResult = await saraAuthClient.registerSession(
      studentId,
      sessionId,
      options,
    );

    // Authenticate Convex client with JWT
    const convexToken = await convexClient.authenticate({
      studentId,
      sessionId,
      deviceOwnership: options.deviceOwnership,
      saveProgress: options.saveProgress,
    });

    // Update session state with auth info
    session$.authenticated.set(true);
    session$.useConvex.set(true);
    session$.lastActive.set(Date.now());

    // Record performance metric
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric({
      name: "session-authentication",
      value: duration,
      unit: "ms",
      timestamp: Date.now(),
      tags: {
        success: "true",
        deviceOwnership: options.deviceOwnership,
        studentId,
      },
    });

    console.log("[Sessions] Session authenticated successfully", {
      sessionId: authResult.session.id,
      studentId,
      deviceOwnership: options.deviceOwnership,
    });

    return { success: true, token: convexToken };
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Record performance metric for failure
    performanceMonitor.recordMetric({
      name: "session-authentication",
      value: duration,
      unit: "ms",
      timestamp: Date.now(),
      tags: {
        success: "false",
        error: errorMessage,
        studentId,
      },
    });

    console.error("[Sessions] Authentication failed:", error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Upgrade session account (if supported)
 */
export async function upgradeSessionAccount(
  accountType: "premium" | "family" | "school",
  paymentInfo?: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    initializeAuthClients();

    if (!saraAuthClient || !config.isFeatureEnabled("useConvexAuth")) {
      return { success: false, error: "Auth integration not available" };
    }

    const currentSession = session$.peek();
    if (!currentSession.authenticated) {
      return { success: false, error: "Session not authenticated" };
    }

    await saraAuthClient.upgradeAccount(accountType, paymentInfo);

    console.log("[Sessions] Account upgraded successfully", { accountType });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[Sessions] Account upgrade failed:", error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get current authentication status
 */
export function getAuthStatus(): {
  isAuthenticated: boolean;
  useConvex: boolean;
  hasValidToken: boolean;
  tokenExpiry?: number;
} {
  const currentSession = session$.peek();
  const hasValidToken = convexClient ? convexClient.isAuthenticated() : false;
  const tokenExpiry = convexClient ? convexClient.getTokenExpiry() : null;

  return {
    isAuthenticated: currentSession.authenticated ?? false,
    useConvex: currentSession.useConvex ?? false,
    hasValidToken,
    tokenExpiry: tokenExpiry ? tokenExpiry.getTime() : undefined,
  };
}

/**
 * Refresh authentication token if needed
 */
export async function refreshAuthToken(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!convexClient || !saraAuthClient) {
      return { success: false, error: "Auth clients not initialized" };
    }

    const needsRefresh = convexClient.needsTokenRefresh();
    if (!needsRefresh) {
      return { success: true }; // Token is still valid
    }

    // Token needs refresh - re-authenticate
    const currentSession = session$.peek();
    const authResult = await authenticateSession(
      currentSession.studentId ?? "anonymous",
      currentSession.sessionId ?? `session-${Date.now()}`,
      {
        deviceOwnership: "private",
        saveProgress: "sync",
      },
    );

    return authResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[Sessions] Token refresh failed:", error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sign out and clear authentication
 */
export async function signOut(): Promise<void> {
  try {
    if (convexClient) {
      convexClient.clearAuth();
    }

    session$.authenticated.set(false);
    session$.useConvex.set(false);
    session$.lastActive.set(Date.now());

    console.log("[Sessions] Session signed out successfully");
  } catch (error) {
    console.error("[Sessions] Sign out error:", error);
  }
}

syncObservable(session$, {
  get: async () => {
    if (
      typeof window !== undefined &&
      window.navigator.onLine &&
      session$.saveProgress.peek()
    ) {
      return await updateSession(session$.peek());
    }
    return undefined;
  },
  set: async (session) => {
    if (
      session.value?.saveProgress &&
      typeof window !== undefined &&
      window.navigator.onLine
    ) {
      session.value.lastActive = Date.now();
      void updateSession(session.value);
    }
  },
  persist: {
    name: "session",
    plugin: ObservablePersistLocalStorage,
  },
});
