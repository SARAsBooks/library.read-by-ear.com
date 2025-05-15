"use client";

import { observable } from "@legendapp/state";
import { syncObservable } from "@legendapp/state/sync";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import type { Session } from "@/lib/types/session";

export const session$ = observable<Session>({
  anonymous: true,
  authenticated: false,
});

syncObservable(session$, {
  persist: {
    name: "session",
    plugin: ObservablePersistLocalStorage,
  },
});
