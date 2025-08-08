// frontend/observable/sessions.ts
"use client";

import { observable } from "@legendapp/state";
import { syncObservable } from "@legendapp/state/sync";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import type { Session } from "@/lib/types/session";
import { updateSession } from "@/backend/actions/session";

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
});

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
