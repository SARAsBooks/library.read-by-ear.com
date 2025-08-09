// lib/config/environment.ts
"use client";

/**
 * Environment configuration for Read-by-Ear
 * Handles production vs development settings, feature flags, and service endpoints
 */

export type Environment = "development" | "preview" | "production";

export interface ServiceEndpoints {
  convex: string;
  auth: string;
  api: string;
  cdn?: string;
}

export interface FeatureFlags {
  useConvexAuth: boolean;
  enableRealTimeSync: boolean;
  enablePerformanceMonitoring: boolean;
  enableOfflineQueue: boolean;
  enableAnalytics: boolean;
  enableErrorReporting: boolean;
  enableDebugMode: boolean;
  enableBetaFeatures: boolean;
}

export interface PerformanceConfig {
  syncBatchSize: number;
  syncInterval: number;
  cacheMaxSize: number;
  cacheMaxAge: number; // milliseconds
  queryTimeout: number;
  networkTimeout: number;
}

export interface SecurityConfig {
  tokenExpiryBuffer: number; // milliseconds
  maxRetryAttempts: number;
  rateLimitWindow: number; // milliseconds
  rateLimitRequests: number;
  enableCSP: boolean;
  enableSRI: boolean;
}

export interface AnalyticsConfig {
  trackingId?: string;
  enableUserMetrics: boolean;
  enablePerformanceMetrics: boolean;
  enableErrorTracking: boolean;
  enableDebugLogging: boolean;
  samplingRate: number; // 0-1
}

export interface EnvironmentConfig {
  env: Environment;
  isDevelopment: boolean;
  isPreview: boolean;
  isProduction: boolean;
  version: string;
  buildDate: string;
  commitHash?: string;
  services: ServiceEndpoints;
  features: FeatureFlags;
  performance: PerformanceConfig;
  security: SecurityConfig;
  analytics: AnalyticsConfig;
}

class ConfigManager {
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.buildConfig();
  }

  /**
   * Build configuration based on environment variables and deployment context
   */
  private buildConfig(): EnvironmentConfig {
    // Detect environment
    const env = this.detectEnvironment();

    return {
      env,
      isDevelopment: env === "development",
      isPreview: env === "preview",
      isProduction: env === "production",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
      buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? new Date().toISOString(),
      commitHash: process.env.NEXT_PUBLIC_COMMIT_HASH,

      services: this.getServiceEndpoints(env),
      features: this.getFeatureFlags(env),
      performance: this.getPerformanceConfig(env),
      security: this.getSecurityConfig(env),
      analytics: this.getAnalyticsConfig(env),
    };
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): Environment {
    if (typeof window === "undefined") {
      // Server-side detection
      if (process.env.NODE_ENV === "production") {
        return process.env.VERCEL_ENV === "preview" ? "preview" : "production";
      }
      return "development";
    }

    // Client-side detection
    const hostname = window.location.hostname;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "development";
    }

    if (hostname.includes("vercel.app") || hostname.includes("-preview")) {
      return "preview";
    }

    if (hostname === "library.read-by-ear.com") {
      return "production";
    }

    return "development"; // Default fallback
  }

  /**
   * Get service endpoints for environment
   */
  private getServiceEndpoints(env: Environment): ServiceEndpoints {
    switch (env) {
      case "production":
        return {
          convex:
            process.env.NEXT_PUBLIC_CONVEX_URL ??
            "https://read-by-ear.convex.cloud",
          auth: "https://auth.sara.ai",
          api: "https://library.read-by-ear.com/api",
          cdn: "https://cdn.read-by-ear.com",
        };

      case "preview":
        return {
          convex:
            process.env.NEXT_PUBLIC_CONVEX_URL ??
            "https://read-by-ear-preview.convex.cloud",
          auth: "https://auth-preview.sara.ai",
          api: `https://${process.env.VERCEL_URL ?? "preview.read-by-ear.com"}/api`,
        };

      case "development":
      default:
        return {
          convex:
            process.env.NEXT_PUBLIC_CONVEX_URL ??
            "https://read-by-ear-dev.convex.cloud",
          auth: process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth-dev.sara.ai",
          api: "http://localhost:3000/api",
        };
    }
  }

  /**
   * Get feature flags for environment
   */
  private getFeatureFlags(env: Environment): FeatureFlags {
    const baseFlags: FeatureFlags = {
      useConvexAuth: env === "production", // Only use real auth in production
      enableRealTimeSync: true,
      enablePerformanceMonitoring: true,
      enableOfflineQueue: true,
      enableAnalytics: env !== "development",
      enableErrorReporting: env === "production",
      enableDebugMode: env === "development",
      enableBetaFeatures: env !== "production",
    };

    // Override with environment variables
    if (typeof window !== "undefined") {
      return {
        ...baseFlags,
        useConvexAuth:
          this.parseBool(localStorage.getItem("rbe.feature.convexAuth")) ??
          baseFlags.useConvexAuth,
        enableDebugMode:
          this.parseBool(localStorage.getItem("rbe.feature.debugMode")) ??
          baseFlags.enableDebugMode,
        enableBetaFeatures:
          this.parseBool(localStorage.getItem("rbe.feature.betaFeatures")) ??
          baseFlags.enableBetaFeatures,
      };
    }

    return baseFlags;
  }

  /**
   * Get performance configuration for environment
   */
  private getPerformanceConfig(env: Environment): PerformanceConfig {
    switch (env) {
      case "production":
        return {
          syncBatchSize: 100,
          syncInterval: 5000, // 5 seconds
          cacheMaxSize: 100 * 1024 * 1024, // 100MB
          cacheMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          queryTimeout: 30000, // 30 seconds
          networkTimeout: 10000, // 10 seconds
        };

      case "preview":
        return {
          syncBatchSize: 50,
          syncInterval: 10000, // 10 seconds
          cacheMaxSize: 50 * 1024 * 1024, // 50MB
          cacheMaxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
          queryTimeout: 20000, // 20 seconds
          networkTimeout: 8000, // 8 seconds
        };

      case "development":
      default:
        return {
          syncBatchSize: 10,
          syncInterval: 2000, // 2 seconds for faster development
          cacheMaxSize: 10 * 1024 * 1024, // 10MB
          cacheMaxAge: 60 * 60 * 1000, // 1 hour
          queryTimeout: 10000, // 10 seconds
          networkTimeout: 5000, // 5 seconds
        };
    }
  }

  /**
   * Get security configuration for environment
   */
  private getSecurityConfig(env: Environment): SecurityConfig {
    return {
      tokenExpiryBuffer: 5 * 60 * 1000, // 5 minutes
      maxRetryAttempts: env === "development" ? 5 : 3,
      rateLimitWindow: 60 * 1000, // 1 minute
      rateLimitRequests: env === "development" ? 100 : 50,
      enableCSP: env === "production",
      enableSRI: env === "production",
    };
  }

  /**
   * Get analytics configuration for environment
   */
  private getAnalyticsConfig(env: Environment): AnalyticsConfig {
    return {
      trackingId:
        env === "production" ? process.env.NEXT_PUBLIC_GA_ID : undefined,
      enableUserMetrics: env !== "development",
      enablePerformanceMetrics: true,
      enableErrorTracking: env === "production",
      enableDebugLogging: env === "development",
      samplingRate: env === "production" ? 0.1 : 1.0, // 10% in prod, 100% in dev
    };
  }

  /**
   * Parse boolean from string (handles null/undefined)
   */
  private parseBool(value: string | null): boolean | null {
    if (value === null || value === undefined) return null;
    return value.toLowerCase() === "true" || value === "1";
  }

  /**
   * Get current configuration
   */
  getConfig(): EnvironmentConfig {
    return this.config;
  }

  /**
   * Get specific service endpoint
   */
  getServiceEndpoint(service: keyof ServiceEndpoints): string {
    return this.config.services[service] ?? "";
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.config.features[feature];
  }

  /**
   * Get performance setting
   */
  getPerformanceSetting<K extends keyof PerformanceConfig>(
    setting: K,
  ): PerformanceConfig[K] {
    return this.config.performance[setting];
  }

  /**
   * Get security setting
   */
  getSecuritySetting<K extends keyof SecurityConfig>(
    setting: K,
  ): SecurityConfig[K] {
    return this.config.security[setting];
  }

  /**
   * Update feature flag (for debugging/testing)
   */
  setFeatureFlag(feature: keyof FeatureFlags, enabled: boolean): void {
    this.config.features[feature] = enabled;

    if (typeof window !== "undefined") {
      localStorage.setItem(`rbe.feature.${feature}`, String(enabled));
    }
  }

  /**
   * Log current configuration (debug only)
   */
  logConfig(): void {
    if (this.config.features.enableDebugMode) {
      console.group("[Config] Environment Configuration");
      console.log("Environment:", this.config.env);
      console.log("Version:", this.config.version);
      console.log("Build Date:", this.config.buildDate);
      console.log("Services:", this.config.services);
      console.log("Features:", this.config.features);
      console.log("Performance:", this.config.performance);
      console.groupEnd();
    }
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required service endpoints
    if (!this.config.services.convex) {
      errors.push("Missing Convex endpoint");
    }

    if (!this.config.services.auth) {
      errors.push("Missing auth service endpoint");
    }

    // Validate performance settings
    if (this.config.performance.syncBatchSize <= 0) {
      errors.push("Invalid sync batch size");
    }

    if (this.config.performance.syncInterval <= 0) {
      errors.push("Invalid sync interval");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Global configuration instance
export const config = new ConfigManager();

// Export commonly used configuration values
export const { env, isDevelopment, isPreview, isProduction, version } =
  config.getConfig();

/**
 * React hook for accessing configuration
 */
export function useConfig(): EnvironmentConfig {
  return config.getConfig();
}

/**
 * Get configuration for external libraries
 */
export function getConvexConfig() {
  return {
    url: config.getServiceEndpoint("convex"),
    verbose: config.isFeatureEnabled("enableDebugMode"),
  };
}

export function getAuthConfig() {
  return {
    baseUrl: config.getServiceEndpoint("auth"),
    clientVersion: version,
    enableDebug: config.isFeatureEnabled("enableDebugMode"),
  };
}

/**
 * Initialize configuration and perform validation
 */
export function initializeConfig(): void {
  const validation = config.validate();

  if (!validation.valid) {
    console.error("[Config] Configuration validation failed:");
    validation.errors.forEach((error) => console.error(`  - ${error}`));
  }

  config.logConfig();
}

// Auto-initialize in browser
if (typeof window !== "undefined") {
  initializeConfig();
}
