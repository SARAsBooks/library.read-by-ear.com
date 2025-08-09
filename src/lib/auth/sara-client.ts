// lib/auth/sara-client.ts
"use client";

import { v7 as uuidv7 } from "uuid";

export interface AuthSession {
  id: string;
  token: string;
  expiresAt: string;
  canonicalStudentId: string;
  studentIdMapped: boolean;
}

export interface ConvexTokenResponse {
  convexToken: string;
  expiresIn: number;
  claims: {
    sub: string;
    sessionId: string;
    isAnonymous: boolean;
    deviceOwnership: string;
  };
}

export interface StudentProfile {
  id: string;
  isAnonymous: boolean;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  deviceOwnership: string;
  saveProgress: string;
  relationships: {
    parents: string[];
    teachers: string[];
    classrooms: string[];
  };
}

export interface SessionValidationResponse {
  isValid: boolean;
  session: {
    token: string;
    expiresAt: string;
    lastActive: string;
  };
  student: StudentProfile;
  convexToken: string;
}

export interface EmailUpgradeResponse {
  success: boolean;
  verificationSent: boolean;
  maskedEmail: string;
  expiresIn: number;
}

export interface EmailVerificationResponse {
  success: boolean;
  session: AuthSession;
  student: StudentProfile;
  convexToken: string;
}

export interface PhraseGenerationResponse {
  success: boolean;
  phrase: string;
  expiresAt: string;
  instructions: string;
}

export interface PhraseSignInResponse {
  success: boolean;
  session: AuthSession;
  student: StudentProfile;
  convexToken: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  canonicalStudentId?: string;
  mapping?: {
    local: string;
    canonical: string;
  };
}

export class SaraAuthError extends Error {
  constructor(
    public error: AuthError,
    public status: number,
  ) {
    super(error.message);
    this.name = "SaraAuthError";
  }
}

/**
 * Auth.sara.ai client for Read-by-Ear authentication integration
 * Handles session registration, token management, and account upgrades
 */
export class SaraAuthClient {
  private baseUrl: string;
  private clientVersion: string;
  private origin: string;

  constructor(options?: {
    baseUrl?: string;
    clientVersion?: string;
    enableDebug?: boolean;
  }) {
    this.baseUrl = options?.baseUrl ?? "https://auth.sara.ai";
    this.clientVersion = options?.clientVersion ?? "1.0";
    this.origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://library.read-by-ear.com";
  }

  /**
   * Register an anonymous student session with auth.sara.ai
   */
  async registerSession(
    studentId: string,
    sessionId: string,
    options: {
      deviceOwnership: "private" | "public" | "family" | "school";
      saveProgress: "sync";
      metadata?: {
        userAgent?: string;
        timezone?: string;
        locale?: string;
        referrer?: string;
        utm_source?: string;
      };
    },
  ): Promise<{ session: AuthSession; convexToken: string }> {
    const response = await this.makeRequest("POST", "/student/register", {
      studentId,
      sessionId,
      deviceOwnership: options.deviceOwnership,
      saveProgress: options.saveProgress,
      metadata: {
        userAgent:
          options.metadata?.userAgent ??
          (typeof navigator !== "undefined" ? navigator.userAgent : ""),
        timezone:
          options.metadata?.timezone ??
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale:
          options.metadata?.locale ??
          (typeof navigator !== "undefined" ? navigator.language : "en-US"),
        referrer:
          options.metadata?.referrer ??
          (typeof document !== "undefined" ? document.referrer : ""),
        utm_source: options.metadata?.utm_source,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }

    const data = (await response.json()) as {
      session: AuthSession;
      convexToken: string;
    };
    return {
      session: data.session,
      convexToken: data.convexToken,
    };
  }

  /**
   * Validate an existing session token
   */
  async validateSession(token: string): Promise<SessionValidationResponse> {
    const response = await this.makeRequest("GET", "/session/validate", null, {
      Authorization: `Bearer ${token}`,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }

    return response.json() as Promise<SessionValidationResponse>;
  }

  /**
   * Refresh session to extend expiration
   */
  async refreshSession(
    token: string,
    activity: {
      lastActive: string;
      activityType: "reading" | "browsing" | "learning";
    },
  ): Promise<{ session: AuthSession }> {
    const response = await this.makeRequest(
      "POST",
      "/session/refresh",
      activity,
      {
        Authorization: `Bearer ${token}`,
      },
    );

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }

    const data = (await response.json()) as { session: AuthSession };
    return { session: data.session };
  }

  /**
   * Generate a Convex authentication token
   */
  async generateConvexToken(token: string): Promise<ConvexTokenResponse> {
    const response = await this.makeRequest("POST", "/convex/token", null, {
      Authorization: `Bearer ${token}`,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }

    return response.json() as Promise<ConvexTokenResponse>;
  }

  /**
   * Initiate email authentication upgrade
   */
  async initiateEmailUpgrade(
    token: string,
    emailAddress: string,
    options?: {
      name?: string;
      callbackUrl?: string;
    },
  ): Promise<EmailUpgradeResponse> {
    const response = await this.makeRequest(
      "POST",
      "/student/upgrade/email",
      {
        emailAddress,
        name: options?.name,
        callbackUrl:
          options?.callbackUrl ?? `${this.origin}/auth/email-verified`,
      },
      {
        Authorization: `Bearer ${token}`,
      },
    );

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }

    return response.json() as Promise<EmailUpgradeResponse>;
  }

  /**
   * Verify email and complete upgrade
   */
  async verifyEmailUpgrade(
    token: string,
    emailAddress: string,
    otpCode: string,
  ): Promise<EmailVerificationResponse> {
    const response = await this.makeRequest(
      "POST",
      "/student/upgrade/email/verify",
      {
        emailAddress,
        otpCode,
      },
      {
        Authorization: `Bearer ${token}`,
      },
    );

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }

    return response.json() as Promise<EmailVerificationResponse>;
  }

  /**
   * Generate unique phrase for cross-device access
   */
  async generatePhrase(token: string): Promise<PhraseGenerationResponse> {
    const response = await this.makeRequest(
      "POST",
      "/student/phrase/generate",
      null,
      {
        Authorization: `Bearer ${token}`,
      },
    );

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }

    return response.json() as Promise<PhraseGenerationResponse>;
  }

  /**
   * Sign in with unique phrase
   */
  async signInWithPhrase(phrase: string): Promise<PhraseSignInResponse> {
    const response = await this.makeRequest("POST", "/student/phrase/signin", {
      phrase,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }

    return response.json() as Promise<PhraseSignInResponse>;
  }

  /**
   * Logout and invalidate session
   */
  async logout(token: string): Promise<void> {
    const response = await this.makeRequest("POST", "/logout", null, {
      Authorization: `Bearer ${token}`,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error: AuthError };
      throw new SaraAuthError(errorData.error, response.status);
    }
  }

  /**
   * Report activity to maintain session
   */
  async reportActivity(
    token: string,
    activity: {
      timestamp: string;
      activityType: "reading" | "browsing" | "learning";
      metadata?: {
        readingId?: string;
        treatment?: string;
        wordsRead?: number;
      };
    },
  ): Promise<void> {
    const response = await this.makeRequest("POST", "/activity", activity, {
      Authorization: `Bearer ${token}`,
    });

    // Activity reporting is fire-and-forget, don't throw on failure
    if (!response.ok) {
      console.warn(
        "Failed to report activity to auth.sara.ai:",
        response.status,
      );
    }
  }

  /**
   * Upgrade account (placeholder implementation)
   */
  async upgradeAccount(
    _accountType: string,
    _paymentInfo?: unknown,
  ): Promise<unknown> {
    // This would be implemented based on the specific upgrade flow
    throw new Error("Account upgrade not yet implemented");
  }

  /**
   * Generate local identifiers for anonymous sessions
   */
  generateLocalIdentifiers(): { studentId: string; sessionId: string } {
    const studentId = uuidv7();
    const sessionId = `${studentId}:${uuidv7()}`;
    return { studentId, sessionId };
  }

  /**
   * Check if session should sync with auth.sara.ai based on thresholds
   */
  shouldSyncWithAuth(session: {
    timeActive?: number;
    learningEvents?: number;
    saveProgress?: string;
    authenticated?: boolean;
  }): boolean {
    if (session.authenticated || session.saveProgress !== "sync") {
      return false;
    }

    // Sync thresholds from API spec
    const timeThreshold = (session.timeActive ?? 0) >= 300; // 5 minutes
    const eventThreshold = (session.learningEvents ?? 0) >= 10; // 10 interactions

    return timeThreshold || eventThreshold;
  }

  /**
   * Make authenticated request to auth.sara.ai
   */
  private async makeRequest(
    method: "GET" | "POST",
    endpoint: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Origin: this.origin,
      "X-Client-Version": this.clientVersion,
      ...headers,
    };

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      mode: "cors",
      credentials: "omit", // No cookies needed
    };

    if (body && method === "POST") {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      return await fetch(url, requestOptions);
    } catch (error) {
      throw new SaraAuthError(
        {
          code: "NETWORK_ERROR",
          message: "Failed to connect to auth.sara.ai",
          details: {
            originalError:
              error instanceof Error ? error.message : String(error),
          },
        },
        0,
      );
    }
  }
}

// Default instance for application use
export const saraAuth = new SaraAuthClient();

/**
 * Utility to determine if user should be prompted for account upgrade
 */
export function shouldPromptForUpgrade(session: {
  authenticated?: boolean;
  timeActive?: number;
  learningEvents?: number;
  wordsRead?: number;
}): boolean {
  if (session.authenticated) return false;

  // Prompt for upgrade at higher thresholds than sync
  const significantTime = (session.timeActive ?? 0) >= 1800; // 30 minutes
  const significantEvents = (session.learningEvents ?? 0) >= 50; // 50 interactions
  const significantReading = (session.wordsRead ?? 0) >= 200; // 200 words read

  return significantTime || significantEvents || significantReading;
}

/**
 * Storage keys for auth.sara.ai integration
 */
export const AUTH_STORAGE_KEYS = {
  STUDENT_ID: "rbe.studentId",
  SESSION_ID: "rbe.sessionId",
  AUTH_TOKEN: "rbe.authToken",
  CONVEX_TOKEN: "rbe.convexToken",
  TOKEN_EXPIRY: "rbe.tokenExpiry",
  LAST_AUTH_SYNC: "rbe.lastAuthSync",
} as const;
