import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/access";
import { MAX_TEXT_BYTES, textBytes } from "./lib/limits";

// The user's row is always found from the auth identity, never from client ids.
function findScratch(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("scratches")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export const get = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ text: v.string(), version: v.number(), updatedAt: v.number() }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await findScratch(ctx, userId);
    if (row === null) return null;
    return { text: row.text, version: row.version, updatedAt: row.updatedAt };
  },
});

// Last write wins: a save based on an older version still replaces the text.
// baseVersion is accepted so clients can report it, but never rejects a save.
export const save = mutation({
  args: { text: v.string(), baseVersion: v.number() },
  returns: v.number(),
  handler: async (ctx, { text }) => {
    const userId = await requireUserId(ctx);
    if (textBytes(text) > MAX_TEXT_BYTES) throw new ConvexError("textTooLong");
    const row = await findScratch(ctx, userId);
    const updatedAt = Date.now();
    if (row === null) {
      await ctx.db.insert("scratches", { userId, text, version: 1, updatedAt });
      return 1;
    }
    const version = row.version + 1;
    await ctx.db.patch("scratches", row._id, { text, version, updatedAt });
    return version;
  },
});
