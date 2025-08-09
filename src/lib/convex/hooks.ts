"use client";

import { useQuery, useMutation } from "convex/react";
import type { Library } from "@/lib/types/library";
import { api } from "../../../convex/_generated/api";

// Real Convex API is now available!

// Library hooks with real Convex API
export const useLibrary = (studentId: string): Library | undefined => {
  const result = useQuery(api.library.getLibrary, { studentId });

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

  return result ?? undefined;
};

export const useSetLibrary = () => {
  return useMutation(api.library.setLibrary);
};

export const useAddBookmark = () => {
  return useMutation(api.library.addBookmark);
};

// Learning record hooks
export const useLearningRecords = (studentId: string) => {
  return useQuery(api.learning.getLearningRecords, { studentId });
};

export const useWordRecord = (studentId: string, word: string) => {
  return useQuery(api.learning.getWordRecord, { studentId, word });
};

export const useAddResponse = () => {
  return useMutation(api.learning.addResponse);
};

export const useBatchAddResponses = () => {
  return useMutation(api.learning.batchAddResponses);
};

// Preferences hooks
export const usePreferences = (studentId: string) => {
  return useQuery(api.preferences.getPreferences, { studentId });
};

export const useSetPreferences = () => {
  return useMutation(api.preferences.setPreferences);
};

// Enhanced learning record hooks with fluency calculations
export const useLearningRecordsWithFluency = (studentId: string) => {
  return useQuery(api.learning.getLearningRecords, { studentId });
};

export const useWordFluencyLevel = (studentId: string, word: string) => {
  return useQuery(api.learning.getWordFluencyLevel, { studentId, word });
};

export const useFluencyLevels = (studentId: string) => {
  return useQuery(api.learning.calculateFluencyLevels, { studentId });
};

export const useStudentFluencySummary = (studentId: string) => {
  return useQuery(api.learning.getStudentFluencySummary, { studentId });
};

export const useSyncLearningRecords = () => {
  return useMutation(api.learning.syncLearningRecordsFromDexie);
};

// Convenience hook for adding learning responses with optimistic updates
export const useAddLearningResponse = () => {
  return useMutation(api.learning.addResponse);
};

export const useBatchAddLearningResponses = () => {
  return useMutation(api.learning.batchAddResponses);
};

// Export the generated API for external use
export { api };
