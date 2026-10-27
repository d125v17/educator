import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = (typeof roleEnum.enumValues)[number];
