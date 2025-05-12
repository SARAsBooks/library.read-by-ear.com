import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const readerResponses = pgTable(
  "reader_response",
  {
    studentId: uuid("reader_id").notNull(),
    word: varchar({ length: 127 }).notNull(),
    response: integer().notNull(),
    timestamp: timestamp().notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.studentId, table.word, table.timestamp],
      }),
    };
  },
);
