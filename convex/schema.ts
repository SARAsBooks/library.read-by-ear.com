import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Library data - bookmarks and reading collections
  libraries: defineTable({
    studentId: v.string(),
    bookmarks: v.array(
      v.object({
        readingId: v.string(),
        currentPage: v.number(),
        lastupdate: v.number(), // timestamp
        completed: v.optional(v.boolean()),
        stars: v.optional(v.number()),
      }),
    ),
    library: v.array(v.string()), // reading IDs
    resumeReadings: v.optional(v.array(v.string())),
    clientOptions: v.optional(v.any()), // future use
  }).index("by_student", ["studentId"]),

  // Learning records working set for UI reactivity
  learningRecords: defineTable({
    studentId: v.string(),
    word: v.string(),
    responses: v.array(v.number()), // ResponseId enum values
    updatedAt: v.number(), // timestamp
  })
    .index("by_student", ["studentId"])
    .index("by_student_word", ["studentId", "word"]),

  // User preferences that sync across devices
  preferences: defineTable({
    studentId: v.string(),
    saveProgress: v.union(v.literal("local"), v.literal("sync")),
    deviceOwnership: v.optional(
      v.union(
        v.literal("public"),
        v.literal("private"),
        v.literal("family"),
        v.literal("school"),
      ),
    ),
    useConvex: v.optional(v.boolean()),
    // Add other preferences as needed
  }).index("by_student", ["studentId"]),
});
