import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The allowed user roles. Restricted to exactly `user` and `admin` at the
 * database level via a native PostgreSQL enum.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

/**
 * User accounts. Each account has exactly one role (`user` or `admin`) and a
 * scrypt password hash; plaintext passwords are never stored.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Server-side sessions for authenticated users. The client only ever holds the
 * opaque session `id` (in an HttpOnly cookie); the row is the source of truth
 * and can be revoked by deleting it. Sessions are removed automatically when
 * their user is deleted.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  // Index the foreign key so per-user lookups and `ON DELETE CASCADE` do not
  // scan the whole table (F-8).
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = (typeof roleEnum.enumValues)[number];
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
