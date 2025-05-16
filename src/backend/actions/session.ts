"use server";
import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import type { Session } from "@/lib/types/session";
import { v4 as uuid } from "uuid";
// import { revalidatePath } from "next/cache";

const defaultSession: Session = {
  lastActive: Date.now(),
  anonymous: true,
  authenticated: false,
};

const sessionOptions: SessionOptions = {
  password: "complex_password_at_least_32_characters_long",
  cookieName: "iron-examples-app-router-server-component-and-action",
  cookieOptions: {
    secure: true,
  },
};

/**
 * Retrieves the session from the server using iron-session.
 *
 * @returns A Promise that resolves with the session object.
 */
export async function getSession(): Promise<Session> {
  const ironSession = await getIronSession<Session>(
    await cookies(),
    sessionOptions,
  );
  const newSession: Session = {
    ...defaultSession,
    ...ironSession,
    sessionId:
      ironSession.sessionId &&
      ironSession.lastActive > Date.now() - 15 * 60 * 1000
        ? ironSession.sessionId
        : uuid(),
    studentId: ironSession.studentId ?? uuid(),
    lastActive: Date.now(),
  };
  Object.assign({ target: ironSession, source: newSession });
  ironSession.updateConfig({
    ...sessionOptions,
    ttl: ironSession.saveProgress ? 28 * 24 * 3600 : 15 * 60,
  });
  await ironSession.save();
  return ironSession;
}

export async function destroySession() {
  const session = await getIronSession<Session>(
    await cookies(),
    sessionOptions,
  );
  session.destroy();
  //   revalidatePath("/");
}

/**
 * Exposes the local session to the server through session management cookies.
 * result = { ok: boolean; session: Session }
 *
 * @param session - The session object from localStorage to expose to the server.
 * @returns A Promise that resolves with an object containing the status of the
 * operation and the session.
 */
export async function startSyncLocal(
  session: Session,
): Promise<{ ok: boolean; session: Session }> {
  const ironSession = await getIronSession<Session>(
    await cookies(),
    sessionOptions,
  );
  if (ironSession.sessionId === undefined)
    return { ok: false, session: ironSession };
  // Note on security: this is a local session, so we are not going to
  // expose sensitive information. However, be cautious about what you
  // store in the session because a client could delete cookies and pass
  // a studentId that already exists in the database.
  const newSession: Session = {
    ...ironSession,
    ...session,
    sessionId:
      session.sessionId && session.lastActive > Date.now() - 15 * 60 * 1000
        ? session.sessionId
        : uuid(),
    saveProgress: "local",
    authenticated: false,
    // since we are passing in client data, we need to make sure
    // we are overwriting a false `true` value in authenticated.
    // This cookie should not be relied on for security or exposing
    // sensitive information, regardless, but we should still be
    // cautious.
  };
  Object.assign({ target: ironSession, source: newSession });
  ironSession.updateConfig({
    ...sessionOptions,
    ttl: session.saveProgress ? 28 * 24 * 3600 : 15 * 60,
  });
  await ironSession.save();
  return { ok: true, session: ironSession };
}

/**
 * Updates the session on the server with the provided session object.
 *
 * @param session - The session object to update.
 * @returns A Promise that resolves when the session is updated.
 */
export async function updateSession(session: Session): Promise<Session | void> {
  const ironSession = await getIronSession<Session>(
    await cookies(),
    sessionOptions,
  );
  if (ironSession.sessionId === undefined) return;
  const newSession: Session = {
    ...ironSession,
    ...session,
    lastActive: Date.now(),
    authenticated: false,
  };
  Object.assign({ target: ironSession, source: newSession });
  ironSession.updateConfig({
    ...sessionOptions,
    ttl: session.saveProgress ? 28 * 24 * 3600 : 15 * 60,
  });
  await ironSession.save();
}
