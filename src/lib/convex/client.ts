"use client";

import { ConvexReactClient } from "convex/react";
import { session$ } from "@/frontend/observable/sessions";
import { env } from "@/env";

// Initialize Convex client with environment URL (only if available)
export const convex = env.NEXT_PUBLIC_CONVEX_URL
  ? new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL)
  : null;

// Auth token provider for Convex integration with auth.sara.ai
export const getAuthToken = async (): Promise<string | null> => {
  const session = session$.peek();

  // Only provide auth token if user is authenticated and using sync mode
  if (
    !session.studentId ||
    !session.authenticated ||
    session.saveProgress !== "sync"
  ) {
    return null;
  }

  try {
    // TODO: Replace with actual auth.sara.ai API call once auth service is implemented
    // For now, return a placeholder token based on session data
    const response = await fetch("/api/convex/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: session.studentId,
        sessionId: session.sessionId,
        userId: session.userId,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { token: string };
      return data.token;
    }
  } catch (error) {
    console.warn("Failed to get auth token for Convex:", error);
  }

  return null;
};

// Generate local JWT token for development/fallback
export const generateLocalToken = (studentId: string): string => {
  // This is a simple base64 encoded token for development
  // In production, this should be replaced with proper JWT from auth.sara.ai
  const payload = {
    sub: studentId,
    iss: "read-by-ear-local",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  return btoa(JSON.stringify(payload));
};

// Check if Convex is available and configured
export const isConvexAvailable = (): boolean => {
  return !!(env.NEXT_PUBLIC_CONVEX_URL && convex);
};
