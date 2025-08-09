"use client";

import { ConvexProvider as BaseConvexProvider } from "convex/react";
import { convex, isConvexAvailable, getAuthToken } from "@/lib/convex/client";
import { useEffect, useState } from "react";

interface ConvexProviderProps {
  children: React.ReactNode;
}

export function ConvexProvider({ children }: ConvexProviderProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isConvexAvailable() && convex) {
      // Set up auth token provider
      convex.setAuth(getAuthToken);
    }
    setIsReady(true);
  }, []);

  // If Convex is not available or not ready, render children without provider
  if (!isConvexAvailable() || !isReady || !convex) {
    return <>{children}</>;
  }

  return <BaseConvexProvider client={convex}>{children}</BaseConvexProvider>;
}
