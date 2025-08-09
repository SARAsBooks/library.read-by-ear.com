"use client";

import { observable } from "@legendapp/state";
import { syncObservable, synced } from "@legendapp/state/sync";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import { session$ } from "./sessions";
import type { Library } from "@/lib/types/library";
import { postLibrary, getLibrary } from "@/backend/sync";
import { convexLibrarySync, shouldUseConvex } from "@/lib/convex/sync";

export const library$ = observable<Library>({
  studentId: session$.studentId.get(),
  bookmarks: [],
  library: [],
});

// Initialize sync based on session configuration
const initializeLibrarySync = () => {
  const session = session$.peek();
  const currentStudentId = session.studentId;

  if (!currentStudentId) return;

  // Update library studentId if it changed
  if (library$.studentId.peek() !== currentStudentId) {
    library$.studentId.set(currentStudentId);
  }

  if (session.saveProgress === "local") {
    // Local-only mode
    syncObservable(library$, {
      persist: {
        name: "library",
        plugin: ObservablePersistLocalStorage,
      },
    });
  } else if (session.saveProgress === "sync") {
    const useConvex = shouldUseConvex(session);

    if (useConvex) {
      // Convex sync mode
      console.log("Initializing Convex sync for library");
      syncObservable(
        library$,
        synced({
          get: () => {
            const studentId = session$.studentId.peek();
            if (!studentId) {
              console.error("No studentId found in session.");
              return null;
            }
            return convexLibrarySync.get(studentId);
          },
          set: async ({ value }) => {
            console.log("Setting library data via Convex:", value);
            if (value) {
              await convexLibrarySync.set(value);
            }
          },
          persist: {
            name: "library",
            plugin: ObservablePersistLocalStorage,
          },
          debounceSet: 2000, // Faster debounce for real-time sync
        }),
      );
    } else {
      // Legacy server actions sync mode
      console.log("Initializing legacy sync for library");
      syncObservable(
        library$,
        synced({
          get: () => {
            const studentId = session$.studentId.peek();
            if (!studentId) {
              console.error("No studentId found in session.");
              return null;
            }
            return getLibrary(studentId);
          },
          set: async ({ value }) => {
            console.log("Setting library data via server actions:", value);
            await postLibrary(
              value ?? {
                studentId: session$.studentId.peek(),
                bookmarks: [],
                library: [],
              },
            );
          },
          persist: {
            name: "library",
            plugin: ObservablePersistLocalStorage,
          },
          debounceSet: 5000,
        }),
      );
    }
  }
};

// Initialize sync when conditions are met
if (session$.studentId.get() && session$.saveProgress.get() !== undefined) {
  initializeLibrarySync();
}

// Reinitialize when session changes
session$.onChange(() => {
  const session = session$.peek();
  if (session.studentId && session.saveProgress !== undefined) {
    initializeLibrarySync();
  }
});
