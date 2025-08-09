import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get preferences for a student
export const getPreferences = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const prefs = await ctx.db
      .query("preferences")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .first();

    return (
      prefs ?? {
        studentId: args.studentId,
        saveProgress: "local" as const,
        deviceOwnership: "private" as const,
        useConvex: false,
      }
    );
  },
});

// Set preferences for a student
export const setPreferences = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        saveProgress: args.saveProgress,
        deviceOwnership: args.deviceOwnership,
        useConvex: args.useConvex,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("preferences", args);
    }
  },
});
