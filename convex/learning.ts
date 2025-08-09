import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Fluency calculation constants (from src/lib/derive/fluency.ts)
const MIN_STRONG_WINDOW = 5;
const MIN_LEARNED_WINDOW = 3;

// ResponseId enum values (from src/lib/types/fluency-record.ts)
const ResponseId = {
  Identification: 0,
  Recognition: 1,
} as const;

// WordReadingFluencyEnum (from src/lib/types/fluency-record.ts)
const WordReadingFluencyEnum = {
  Unknown: "Unknown",
  Initial: "Initial",
  Developing: "Developing",
  Learned: "Learned",
  Strong: "Strong",
} as const;

// Fluency calculation helper function (ported from src/lib/derive/fluency.ts)
function getWordReadingFluencyLevel(responses: number[]): string {
  if (!responses.length) return WordReadingFluencyEnum.Unknown;

  const strong =
    responses.length >= MIN_STRONG_WINDOW &&
    responses
      .slice(-MIN_STRONG_WINDOW)
      .every((r) => r === ResponseId.Recognition);

  const learned =
    !strong &&
    responses.length >= MIN_LEARNED_WINDOW &&
    responses
      .slice(-MIN_LEARNED_WINDOW)
      .every((r) => r === ResponseId.Recognition);

  if (strong) return WordReadingFluencyEnum.Strong;
  if (learned) return WordReadingFluencyEnum.Learned;
  if (responses.length === 1 && responses[0] === ResponseId.Recognition) {
    return WordReadingFluencyEnum.Initial;
  }

  return WordReadingFluencyEnum.Developing;
}

// Get learning records for a student
export const getLearningRecords = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    return await ctx.db
      .query("learningRecords")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
  },
});

// Get learning record for a specific word
export const getWordRecord = query({
  args: {
    studentId: v.string(),
    word: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    return await ctx.db
      .query("learningRecords")
      .withIndex("by_student_word", (q) =>
        q.eq("studentId", args.studentId).eq("word", args.word),
      )
      .first();
  },
});

// Add response to a word's learning record
export const addResponse = mutation({
  args: {
    studentId: v.string(),
    word: v.string(),
    response: v.number(), // ResponseId enum value
  },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const timestamp = Date.now();

    const existing = await ctx.db
      .query("learningRecords")
      .withIndex("by_student_word", (q) =>
        q.eq("studentId", args.studentId).eq("word", args.word),
      )
      .first();

    let result;

    if (existing) {
      // Add response to existing record
      const responses = [...existing.responses, args.response];
      await ctx.db.patch(existing._id, {
        responses,
        updatedAt: timestamp,
      });
      result = existing._id;
    } else {
      // Create new record
      result = await ctx.db.insert("learningRecords", {
        studentId: args.studentId,
        word: args.word,
        responses: [args.response],
        updatedAt: timestamp,
      });
    }

    // Background audit sync to PostgreSQL
    try {
      const auditRecord = {
        studentId: args.studentId,
        word: args.word,
        response: args.response,
        timestamp: timestamp,
      };

      // Call the audit API (fire and forget - don't block the mutation)
      await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/learning-audit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: [auditRecord],
            studentId: args.studentId,
            source: "convex-addResponse",
          }),
        },
      );
    } catch (auditError) {
      // Log audit errors but don't fail the mutation
      console.error("Audit sync failed for addResponse:", auditError);
    }

    return result;
  },
});

// Batch update multiple responses (for sync efficiency)
export const batchAddResponses = mutation({
  args: {
    studentId: v.string(),
    records: v.array(
      v.object({
        word: v.string(),
        responses: v.array(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const results = [];

    for (const record of args.records) {
      const existing = await ctx.db
        .query("learningRecords")
        .withIndex("by_student_word", (q) =>
          q.eq("studentId", args.studentId).eq("word", record.word),
        )
        .first();

      if (existing) {
        // Merge responses, avoiding duplicates
        const mergedResponses = [...existing.responses];
        for (const response of record.responses) {
          if (!mergedResponses.includes(response)) {
            mergedResponses.push(response);
          }
        }

        await ctx.db.patch(existing._id, {
          responses: mergedResponses,
          updatedAt: Date.now(),
        });
        results.push(existing._id);
      } else {
        const id = await ctx.db.insert("learningRecords", {
          studentId: args.studentId,
          word: record.word,
          responses: record.responses,
          updatedAt: Date.now(),
        });
        results.push(id);
      }
    }

    return results;
  },
});

// Bulk sync learning records from client (for migration/sync)
export const syncLearningRecordsFromDexie = mutation({
  args: {
    studentId: v.string(),
    records: v.array(
      v.object({
        word: v.string(),
        response: v.number(),
        timestamp: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete

    // Group records by word and collect responses
    const wordRecords = new Map<string, number[]>();

    // Sort records by timestamp to maintain chronological order
    const sortedRecords = args.records.sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    for (const record of sortedRecords) {
      if (!wordRecords.has(record.word)) {
        wordRecords.set(record.word, []);
      }
      wordRecords.get(record.word)!.push(record.response);
    }

    const results = [];

    // Update or create learning records for each word
    for (const [word, responses] of wordRecords) {
      const existing = await ctx.db
        .query("learningRecords")
        .withIndex("by_student_word", (q) =>
          q.eq("studentId", args.studentId).eq("word", word),
        )
        .first();

      if (existing) {
        // Merge responses, avoiding duplicates based on position
        const mergedResponses = [...existing.responses, ...responses];
        await ctx.db.patch(existing._id, {
          responses: mergedResponses,
          updatedAt: Date.now(),
        });
        results.push(existing._id);
      } else {
        const id = await ctx.db.insert("learningRecords", {
          studentId: args.studentId,
          word,
          responses,
          updatedAt: Date.now(),
        });
        results.push(id);
      }
    }

    // Background audit sync to PostgreSQL for bulk sync
    try {
      const auditRecords = args.records.map((record) => ({
        studentId: args.studentId,
        word: record.word,
        response: record.response,
        timestamp: record.timestamp,
      }));

      // Call the audit API (fire and forget - don't block the mutation)
      await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/learning-audit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: auditRecords,
            studentId: args.studentId,
            source: "convex-bulkSync",
          }),
        },
      );
    } catch (auditError) {
      // Log audit errors but don't fail the mutation
      console.error("Audit sync failed for bulk sync:", auditError);
    }

    return {
      recordsProcessed: args.records.length,
      wordsUpdated: results.length,
      updatedWords: Array.from(wordRecords.keys()),
    };
  },
});

// Calculate fluency levels for all words for a student
export const calculateFluencyLevels = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const records = await ctx.db
      .query("learningRecords")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const fluencyLevels = new Map<
      string,
      { level: string; responseCount: number }
    >();

    for (const record of records) {
      const level = getWordReadingFluencyLevel(record.responses);
      fluencyLevels.set(record.word, {
        level,
        responseCount: record.responses.length,
      });
    }

    return Object.fromEntries(fluencyLevels);
  },
});

// Get student fluency summary with statistics
export const getStudentFluencySummary = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const records = await ctx.db
      .query("learningRecords")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const summary = {
      totalWords: records.length,
      totalResponses: 0,
      fluencyBreakdown: {
        [WordReadingFluencyEnum.Unknown]: 0,
        [WordReadingFluencyEnum.Initial]: 0,
        [WordReadingFluencyEnum.Developing]: 0,
        [WordReadingFluencyEnum.Learned]: 0,
        [WordReadingFluencyEnum.Strong]: 0,
      },
      lastUpdated: 0,
    };

    for (const record of records) {
      summary.totalResponses += record.responses.length;
      const level = getWordReadingFluencyLevel(record.responses);

      // Type-safe access to fluency breakdown
      if (level in summary.fluencyBreakdown) {
        (summary.fluencyBreakdown as any)[level]++;
      }

      summary.lastUpdated = Math.max(summary.lastUpdated, record.updatedAt);
    }

    return summary;
  },
});

// Get fluency level for a specific word
export const getWordFluencyLevel = query({
  args: {
    studentId: v.string(),
    word: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Add auth validation when auth.sara.ai integration is complete
    const record = await ctx.db
      .query("learningRecords")
      .withIndex("by_student_word", (q) =>
        q.eq("studentId", args.studentId).eq("word", args.word),
      )
      .first();

    if (!record) {
      return {
        word: args.word,
        level: WordReadingFluencyEnum.Unknown,
        responses: [],
        responseCount: 0,
        updatedAt: null,
      };
    }

    const level = getWordReadingFluencyLevel(record.responses);

    return {
      word: args.word,
      level,
      responses: record.responses,
      responseCount: record.responses.length,
      updatedAt: record.updatedAt,
    };
  },
});
