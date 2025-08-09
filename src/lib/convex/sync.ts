"use client";

import { isConvexAvailable, convex } from "./client";
import type { Library } from "@/lib/types/library";
import type { TrackedFluencyRecord } from "@/lib/types/fluency-record";
import { api } from "./hooks";

// Convex sync functions for library data
export const convexLibrarySync = {
  get: async (studentId: string): Promise<Library | null> => {
    if (!isConvexAvailable() || !convex || !studentId) {
      console.log("Convex not available for library get:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!studentId,
      });
      return null;
    }

    try {
      console.log("Fetching library from Convex for student:", studentId);

      // Use the real Convex client to fetch library data
      const result = await convex.query(api.library.getLibrary, { studentId });

      console.log("Convex library fetch result:", result);

      // Convert Convex format (number timestamps) to Library format (Date objects)
      if (result) {
        return {
          ...result,
          bookmarks: result.bookmarks.map((bookmark) => ({
            ...bookmark,
            lastupdate: new Date(bookmark.lastupdate), // Convert number to Date
          })),
        };
      }

      return result;
    } catch (error) {
      console.error("Error fetching library from Convex:", error);
      return null;
    }
  },

  set: async (library: Library): Promise<boolean> => {
    if (!isConvexAvailable() || !convex || !library.studentId) {
      console.log("Convex not available for library set:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!library.studentId,
      });
      return false;
    }

    try {
      console.log("Saving library to Convex:", library);

      // Use the real Convex client to save library data
      const result = await convex.mutation(api.library.setLibrary, {
        studentId: library.studentId ?? "",
        bookmarks: library.bookmarks.map((b) => ({
          ...b,
          lastupdate:
            typeof b.lastupdate === "number"
              ? b.lastupdate
              : new Date(b.lastupdate).getTime(),
        })),
        library: library.library,
        resumeReadings: library.resumeReadings,
        clientOptions: library.clientOptions,
      });

      console.log("Convex library save result:", result);
      return !!result;
    } catch (error) {
      console.error("Error saving library to Convex:", error);
      return false;
    }
  },

  // Add bookmark sync function for more granular updates
  addBookmark: async (
    studentId: string,
    bookmark: {
      readingId: string;
      currentPage: number;
      completed?: boolean;
      stars?: number;
    },
  ): Promise<boolean> => {
    if (!isConvexAvailable() || !convex || !studentId) {
      console.log("Convex not available for bookmark add:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!studentId,
      });
      return false;
    }

    try {
      console.log("Adding bookmark via Convex:", { studentId, bookmark });

      // Use the real Convex client to add bookmark
      const result = await convex.mutation(api.library.addBookmark, {
        studentId,
        ...bookmark,
      });

      console.log("Convex bookmark add result:", result);
      return !!result;
    } catch (error) {
      console.error("Error adding bookmark via Convex:", error);
      return false;
    }
  },
};

// Helper to determine if we should use Convex for a given session
export const shouldUseConvex = (session: {
  useConvex?: boolean;
  saveProgress?: string;
  studentId?: string;
}): boolean => {
  return !!(
    session.useConvex &&
    session.saveProgress === "sync" &&
    session.studentId &&
    isConvexAvailable()
  );
};

// Learning records sync functions with enhanced capabilities
export const convexLearningSync = {
  // Get all learning records for a student (from Convex working set)
  getRecords: async (studentId: string): Promise<TrackedFluencyRecord[]> => {
    if (!isConvexAvailable() || !convex || !studentId) {
      console.log("Convex not available for learning records get:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!studentId,
      });
      return [];
    }

    try {
      console.log(
        "Fetching learning records from Convex for student:",
        studentId,
      );

      const result = await convex.query(api.learning.getLearningRecords, {
        studentId,
      });
      console.log("Convex learning records fetch result:", result);

      // Convert Convex format to TrackedFluencyRecord format
      const trackedRecords: TrackedFluencyRecord[] = [];

      if (result) {
        for (const record of result) {
          // Expand each response in the working set to individual TrackedFluencyRecords
          for (const response of record.responses) {
            if (response !== undefined) {
              trackedRecords.push({
                studentId: record.studentId,
                word: record.word,
                response: response,
                timestamp: new Date(record.updatedAt), // Use updatedAt as approximate timestamp
                origin: "remote" as const,
                synced: true,
              });
            }
          }
        }
      }

      return trackedRecords;
    } catch (error) {
      console.error("Error fetching learning records from Convex:", error);
      return [];
    }
  },

  // Get word-specific learning record
  getWordRecord: async (studentId: string, word: string) => {
    if (!isConvexAvailable() || !convex || !studentId || !word) {
      console.log("Convex not available for word record get:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!studentId,
        hasWord: !!word,
      });
      return null;
    }

    try {
      console.log("Fetching word record from Convex:", { studentId, word });

      const result = await convex.query(api.learning.getWordRecord, {
        studentId,
        word,
      });
      console.log("Convex word record fetch result:", result);

      return result;
    } catch (error) {
      console.error("Error fetching word record from Convex:", error);
      return null;
    }
  },

  // Add single response
  addResponse: async (
    studentId: string,
    word: string,
    response: number,
  ): Promise<boolean> => {
    if (!isConvexAvailable() || !convex || !studentId || !word) {
      console.log("Convex not available for response add:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!studentId,
        hasWord: !!word,
      });
      return false;
    }

    try {
      console.log("Adding response via Convex:", { studentId, word, response });

      const result = await convex.mutation(api.learning.addResponse, {
        studentId,
        word,
        response,
      });
      console.log("Convex response add result:", result);
      return !!result;
    } catch (error) {
      console.error("Error adding response via Convex:", error);
      return false;
    }
  },

  // Bulk sync from Dexie to Convex (for migration/sync)
  syncFromDexie: async (
    studentId: string,
    dexieRecords: TrackedFluencyRecord[],
  ): Promise<{
    success: boolean;
    recordsProcessed: number;
    wordsUpdated: number;
  }> => {
    if (!isConvexAvailable() || !convex || !studentId || !dexieRecords.length) {
      console.log("Convex not available for bulk sync:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!studentId,
        hasRecords: dexieRecords.length,
      });
      return { success: false, recordsProcessed: 0, wordsUpdated: 0 };
    }

    try {
      console.log(
        `Starting bulk sync of ${dexieRecords.length} records to Convex`,
      );

      // Convert TrackedFluencyRecord to the format expected by Convex
      const convexRecords = dexieRecords.map((record) => ({
        word: record.word,
        response: record.response,
        timestamp: record.timestamp.getTime(), // Convert Date to timestamp
      }));

      const result = await convex.mutation(
        api.learning.syncLearningRecordsFromDexie,
        {
          studentId,
          records: convexRecords,
        },
      );

      console.log("Convex bulk sync result:", result);

      return {
        success: true,
        recordsProcessed: result.recordsProcessed || 0,
        wordsUpdated: result.wordsUpdated || 0,
      };
    } catch (error) {
      console.error("Error during bulk sync to Convex:", error);
      return { success: false, recordsProcessed: 0, wordsUpdated: 0 };
    }
  },

  // Get fluency levels for all words
  getFluencyLevels: async (
    studentId: string,
  ): Promise<Record<
    string,
    { level: string; responseCount: number }
  > | null> => {
    if (!isConvexAvailable() || !convex || !studentId) {
      console.log("Convex not available for fluency levels get");
      return null;
    }

    try {
      console.log(
        "Fetching fluency levels from Convex for student:",
        studentId,
      );

      const result = await convex.query(api.learning.calculateFluencyLevels, {
        studentId,
      });
      console.log("Convex fluency levels result:", result);

      return result || {};
    } catch (error) {
      console.error("Error fetching fluency levels from Convex:", error);
      return null;
    }
  },

  // Get fluency summary with statistics
  getFluencySummary: async (studentId: string) => {
    if (!isConvexAvailable() || !convex || !studentId) {
      console.log("Convex not available for fluency summary get");
      return null;
    }

    try {
      console.log(
        "Fetching fluency summary from Convex for student:",
        studentId,
      );

      const result = await convex.query(api.learning.getStudentFluencySummary, {
        studentId,
      });
      console.log("Convex fluency summary result:", result);

      return result;
    } catch (error) {
      console.error("Error fetching fluency summary from Convex:", error);
      return null;
    }
  },

  // Get fluency level for specific word
  getWordFluencyLevel: async (studentId: string, word: string) => {
    if (!isConvexAvailable() || !convex || !studentId || !word) {
      console.log("Convex not available for word fluency level get");
      return null;
    }

    try {
      console.log("Fetching word fluency level from Convex:", {
        studentId,
        word,
      });

      const result = await convex.query(api.learning.getWordFluencyLevel, {
        studentId,
        word,
      });
      console.log("Convex word fluency level result:", result);

      return result;
    } catch (error) {
      console.error("Error fetching word fluency level from Convex:", error);
      return null;
    }
  },
};

// Preferences sync functions - placeholder implementations
export const convexPreferencesSync = {
  get: async (studentId: string): Promise<unknown> => {
    if (!isConvexAvailable() || !convex || !studentId) {
      console.log("Convex not available for preferences get:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!studentId,
      });
      return null;
    }

    try {
      console.log("Fetching preferences from Convex for student:", studentId);
      // Use the real Convex client to fetch preferences
      const result = await convex.query(api.preferences.getPreferences, {
        studentId,
      });
      console.log("Convex preferences fetch result:", result);
      return result;
    } catch (error) {
      console.error("Error fetching preferences from Convex:", error);
      return null;
    }
  },

  set: async (
    studentId: string,
    preferences: {
      saveProgress: "local" | "sync";
      deviceOwnership?: "public" | "private" | "family" | "school";
      useConvex?: boolean;
    },
  ): Promise<boolean> => {
    if (!isConvexAvailable() || !convex || !studentId) {
      console.log("Convex not available for preferences set:", {
        isConvexAvailable: isConvexAvailable(),
        hasConvex: !!convex,
        hasStudentId: !!studentId,
      });
      return false;
    }

    try {
      console.log("Saving preferences to Convex:", { studentId, preferences });
      // Use the real Convex client to save preferences
      const result = await convex.mutation(api.preferences.setPreferences, {
        studentId,
        saveProgress: preferences.saveProgress,
        deviceOwnership: preferences.deviceOwnership,
        useConvex: preferences.useConvex,
      });
      console.log("Convex preferences save result:", result);
      return !!result;
    } catch (error) {
      console.error("Error saving preferences to Convex:", error);
      return false;
    }
  },
};
