import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get library data for a student
export const getLibrary = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const library = await ctx.db
      .query("libraries")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .first();

    return (
      library ?? {
        studentId: args.studentId,
        bookmarks: [],
        library: [],
        resumeReadings: [],
        clientOptions: undefined,
      }
    );
  },
});

// Create or update library data for a student
export const setLibrary = mutation({
  args: {
    studentId: v.string(),
    bookmarks: v.array(
      v.object({
        readingId: v.string(),
        currentPage: v.number(),
        lastupdate: v.number(),
        completed: v.optional(v.boolean()),
        stars: v.optional(v.number()),
      }),
    ),
    library: v.array(v.string()),
    resumeReadings: v.optional(v.array(v.string())),
    clientOptions: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const existing = await ctx.db
      .query("libraries")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        bookmarks: args.bookmarks,
        library: args.library,
        resumeReadings: args.resumeReadings,
        clientOptions: args.clientOptions,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("libraries", args);
    }
  },
});

// Add a bookmark or update existing one
export const addBookmark = mutation({
  args: {
    studentId: v.string(),
    readingId: v.string(),
    currentPage: v.number(),
    completed: v.optional(v.boolean()),
    stars: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const library = await ctx.db
      .query("libraries")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .first();

    if (!library) {
      // Create new library with this bookmark
      return await ctx.db.insert("libraries", {
        studentId: args.studentId,
        bookmarks: [
          {
            readingId: args.readingId,
            currentPage: args.currentPage,
            lastupdate: Date.now(),
            completed: args.completed,
            stars: args.stars,
          },
        ],
        library: [],
      });
    }

    // Update existing library
    const bookmarks = [...library.bookmarks];
    const existingIndex = bookmarks.findIndex(
      (b) => b.readingId === args.readingId,
    );

    const bookmark = {
      readingId: args.readingId,
      currentPage: args.currentPage,
      lastupdate: Date.now(),
      completed: args.completed,
      stars: args.stars,
    };

    if (existingIndex >= 0) {
      bookmarks[existingIndex] = bookmark;
    } else {
      bookmarks.push(bookmark);
    }

    await ctx.db.patch(library._id, { bookmarks });
    return library._id;
  },
});
