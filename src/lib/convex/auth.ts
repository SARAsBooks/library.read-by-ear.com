// lib/convex/auth.ts
"use client";

import { ConvexReactClient } from "convex/react";
import {
  saraAuth,
  SaraAuthError,
  AUTH_STORAGE_KEYS,
} from "@/lib/auth/sara-client";

/**
 * Enhanced Convex client with auth.sara.ai integration
 * Manages JWT tokens and automatic authentication flows
 */
export class AuthenticatedConvexClient {
  private client: ConvexReactClient;
  private tokenRefreshPromise: Promise<string> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private currentToken: string | null = null;

  constructor(options: { url: string; verbose?: boolean } | ConvexReactClient) {
    if (options instanceof ConvexReactClient) {
      this.client = options;
    } else {
      this.client = new ConvexReactClient(options.url);
    }
    void this.initializeAuth();
  }

  /**
   * Initialize authentication state from storage
   */
  private async initializeAuth() {
    if (typeof window === "undefined") return;

    const storedToken = localStorage.getItem(AUTH_STORAGE_KEYS.CONVEX_TOKEN);
    const storedExpiry = localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRY);

    if (storedToken && storedExpiry) {
      const expiryTime = new Date(storedExpiry).getTime();
      const now = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

      if (expiryTime > now + bufferTime) {
        // Token is still valid, use it
        this.setConvexToken(storedToken);
        this.scheduleTokenRefresh(expiryTime - now - bufferTime);
      } else {
        // Token expired or close to expiry, refresh it
        await this.refreshToken();
      }
    }
  }

  /**
   * Authenticate with auth.sara.ai and get Convex token
   */
  async authenticate(session: {
    studentId: string;
    sessionId: string;
    deviceOwnership: "private" | "public" | "family" | "school";
    saveProgress: "sync";
    authenticated?: boolean;
    authToken?: string;
  }): Promise<string> {
    try {
      let authToken = session.authToken;

      // If not already authenticated with sara auth, register session
      if (!session.authenticated || !authToken) {
        console.log("[ConvexAuth] Registering session with auth.sara.ai");

        const result = await saraAuth.registerSession(
          session.studentId,
          session.sessionId,
          {
            deviceOwnership: session.deviceOwnership,
            saveProgress: session.saveProgress,
          },
        );

        authToken = result.session.token;

        // Store auth token
        localStorage.setItem(AUTH_STORAGE_KEYS.AUTH_TOKEN, authToken);
        localStorage.setItem(
          AUTH_STORAGE_KEYS.TOKEN_EXPIRY,
          result.session.expiresAt,
        );

        // Use the Convex token from registration response
        const convexToken = result.convexToken;
        this.setConvexToken(convexToken);

        return convexToken;
      }

      // Generate fresh Convex token from existing auth session
      console.log(
        "[ConvexAuth] Generating Convex token from existing auth session",
      );
      const convexResponse = await saraAuth.generateConvexToken(authToken);

      const convexToken = convexResponse.convexToken;
      this.setConvexToken(convexToken, convexResponse.expiresIn);

      return convexToken;
    } catch (error) {
      console.error("[ConvexAuth] Authentication failed:", error);

      if (error instanceof SaraAuthError) {
        // Handle specific auth errors
        if (error.error.code === "STUDENT_ID_COLLISION") {
          console.warn(
            "[ConvexAuth] Student ID collision - using canonical ID",
            error.error.canonicalStudentId,
          );

          // Could trigger a session update with the canonical ID
          // For now, we'll let the application handle this
        }

        throw error;
      }

      throw new Error(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Refresh the current Convex token
   */
  private async refreshToken(): Promise<string> {
    // Prevent multiple simultaneous refresh attempts
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.doRefreshToken();

    try {
      const token = await this.tokenRefreshPromise;
      return token;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async doRefreshToken(): Promise<string> {
    const authToken = localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);

    if (!authToken) {
      throw new Error("No auth token available for refresh");
    }

    try {
      // First try to refresh the auth session
      await saraAuth.refreshSession(authToken, {
        lastActive: new Date().toISOString(),
        activityType: "browsing",
      });

      // Then get a new Convex token
      const convexResponse = await saraAuth.generateConvexToken(authToken);
      const convexToken = convexResponse.convexToken;

      this.setConvexToken(convexToken, convexResponse.expiresIn);

      console.log("[ConvexAuth] Token refreshed successfully");
      return convexToken;
    } catch (error) {
      console.error("[ConvexAuth] Token refresh failed:", error);

      // Clear stored tokens if refresh failed
      this.clearStoredTokens();

      throw error;
    }
  }

  /**
   * Set Convex token and schedule automatic refresh
   */
  private setConvexToken(token: string, expiresInSeconds = 3600): void {
    this.currentToken = token;
    this.client.setAuth(() => Promise.resolve(token));

    // Store token info
    localStorage.setItem(AUTH_STORAGE_KEYS.CONVEX_TOKEN, token);

    const expiryTime = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(
      AUTH_STORAGE_KEYS.TOKEN_EXPIRY,
      new Date(expiryTime).toISOString(),
    );

    // Schedule refresh 5 minutes before expiry
    const refreshTime = Math.max(0, (expiresInSeconds - 300) * 1000);
    this.scheduleTokenRefresh(refreshTime);
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(delayMs: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      void (async () => {
        try {
          await this.refreshToken();
        } catch (error) {
          console.error("[ConvexAuth] Scheduled token refresh failed:", error);
        }
      })();
    }, delayMs);
  }

  /**
   * Clear stored auth tokens
   */
  private clearStoredTokens(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.CONVEX_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRY);

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Logout and clear all auth state
   */
  async logout(): Promise<void> {
    const authToken = localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);

    if (authToken) {
      try {
        await saraAuth.logout(authToken);
      } catch (error) {
        console.warn("[ConvexAuth] Logout request failed:", error);
      }
    }

    this.clearStoredTokens();
    this.clearAuth();
  }

  /**
   * Report activity to maintain auth session
   */
  async reportActivity(activity: {
    activityType: "reading" | "browsing" | "learning";
    metadata?: {
      readingId?: string;
      treatment?: string;
      wordsRead?: number;
    };
  }): Promise<void> {
    const authToken = localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);

    if (authToken) {
      await saraAuth.reportActivity(authToken, {
        timestamp: new Date().toISOString(),
        ...activity,
      });
    }
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(): {
    isAuthenticated: boolean;
    hasValidToken: boolean;
    tokenExpiry: Date | null;
  } {
    const convexToken = localStorage.getItem(AUTH_STORAGE_KEYS.CONVEX_TOKEN);
    const authToken = localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);
    const expiryString = localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRY);

    const tokenExpiry = expiryString ? new Date(expiryString) : null;
    const hasValidToken = !!(
      convexToken &&
      tokenExpiry &&
      tokenExpiry.getTime() > Date.now()
    );

    return {
      isAuthenticated: !!authToken,
      hasValidToken,
      tokenExpiry,
    };
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentToken;
  }

  /**
   * Get token expiry
   */
  getTokenExpiry(): Date | null {
    const expiryString = localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRY);
    return expiryString ? new Date(expiryString) : null;
  }

  /**
   * Check if token needs refresh
   */
  needsTokenRefresh(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return true;

    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    return expiry.getTime() <= Date.now() + bufferTime;
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.currentToken = null;
    this.client.setAuth(() => Promise.resolve(null));
    this.clearStoredTokens();
  }

  /**
   * Get the underlying Convex client
   */
  getClient(): ConvexReactClient {
    return this.client;
  }
}

/**
 * Check if authentication thresholds are met for a session
 */
export function shouldAuthenticate(session: {
  anonymous?: boolean;
  authenticated?: boolean;
  timeActive?: number;
  learningEvents?: number;
  saveProgress?: string;
}): boolean {
  // Already authenticated or not syncing
  if (
    !session.anonymous ||
    session.authenticated ||
    session.saveProgress !== "sync"
  ) {
    return false;
  }

  return saraAuth.shouldSyncWithAuth({
    timeActive: session.timeActive,
    learningEvents: session.learningEvents,
    saveProgress: session.saveProgress,
    authenticated: session.authenticated,
  });
}

/**
 * Get student ID from local storage or generate new one
 */
export function getOrCreateStudentId(): string {
  if (typeof window === "undefined") return "";

  let studentId = localStorage.getItem(AUTH_STORAGE_KEYS.STUDENT_ID);

  if (!studentId) {
    const identifiers = saraAuth.generateLocalIdentifiers();
    studentId = identifiers.studentId;

    localStorage.setItem(AUTH_STORAGE_KEYS.STUDENT_ID, studentId);
    localStorage.setItem(AUTH_STORAGE_KEYS.SESSION_ID, identifiers.sessionId);
  }

  return studentId;
}

/**
 * Get session ID from local storage or generate new one
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = localStorage.getItem(AUTH_STORAGE_KEYS.SESSION_ID);

  if (!sessionId) {
    const identifiers = saraAuth.generateLocalIdentifiers();
    sessionId = identifiers.sessionId;

    localStorage.setItem(AUTH_STORAGE_KEYS.STUDENT_ID, identifiers.studentId);
    localStorage.setItem(AUTH_STORAGE_KEYS.SESSION_ID, sessionId);
  }

  return sessionId;
}
