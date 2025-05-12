"use client";

import { observable } from "@legendapp/state";
import { syncObservable, synced } from "@legendapp/state/sync";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import { session$ } from "./sessions";
import type { Library } from "@/lib/types/library";
import { postLibrary, getLibrary } from "@/backend/sync";

export const library$ = observable<Library>({
  studentId: session$.studentId.get(),
  bookmarks: [],
  library: [],
});

if (
  session$.studentId.get() === library$.studentId.get() &&
  session$.saveProgress.get() !== undefined
) {
  if (session$.saveProgress.get() === "local") {
    syncObservable(library$, {
      persist: {
        name: "library",
        plugin: ObservablePersistLocalStorage,
      },
    });
  } else if (session$.saveProgress.get() === "sync") {
    await postLibrary(library$.peek());
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
          console.log("Setting library data:", value);
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
