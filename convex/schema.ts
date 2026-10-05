import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // At most one row per user, created on the first save.
  pads: defineTable({
    userId: v.id("users"),
    text: v.string(),
    version: v.number(), // increments on each save
    updatedAt: v.number(), // UTC ms
  }).index("by_user", ["userId"]),
});
