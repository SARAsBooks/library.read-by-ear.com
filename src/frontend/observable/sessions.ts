"use client";

import { observable } from "@legendapp/state";
import { syncObservable } from "@legendapp/state/sync";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import type { Session } from "@/lib/types/session";
import {
  getSession,
  startSyncLocal,
  updateSession,
} from "@/backend/actions/session";
import { v4 as uuid } from "uuid";

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
  set: async ({ value }) => {
    if (!session$.studentId.peek() && window.navigator.onLine) {
      const serverSession = await getSession();
      Object.assign({
        target: serverSession,
        source: value as Partial<Session>,
      });
      session$.assign(serverSession);
    }
    const newSession = {
      ...session$.peek(),
      ...(value as Partial<Session>),
      sessionId:
        session$.sessionId.peek() &&
        session$.lastActive.peek() > Date.now() - 15 * 60 * 1000
          ? session$.sessionId.peek()
          : uuid(),
      lastActive: Date.now(),
    } as Session;
    if (!session$.saveProgress.peek()) {
      session$.assign(newSession);
      return;
    }
    void session$.assign((await updateSession(newSession)) ?? newSession);
  },
  persist: {
    name: "session",
    plugin: ObservablePersistLocalStorage,
  },
});

if (session$.saveProgress.peek()) {
  const serverSession = await getSession();
  const localSession = session$.peek();
  if (serverSession) {
    const localFirst = localSession.lastActive > serverSession.lastActive;
    Object.assign({
      target: localFirst ? serverSession : localSession,
      source: localFirst ? localSession : serverSession,
    });
    session$.assign(localFirst ? serverSession : localSession);
  } else {
    const result = await startSyncLocal(localSession);
    if (result.ok) {
      session$.assign(result.session);
    }
  }
}

/**
 * Exposes the current session to the server through session management cookies.
 *
 * @returns {boolean} - Returns true if the progress was saved successfully, false otherwise.
 */
export async function saveProgressLocal(): Promise<boolean> {
  if (!session$.saveProgress.peek()) return false;
  const result = await startSyncLocal(session$.peek());
  if (!result.ok) return false;
  session$.assign(result.session);
  return true;
}
