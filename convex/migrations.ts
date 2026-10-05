import { internalMutation } from "./_generated/server";

// One-off: copies every scratches row into pads, skipping users already copied.
export const copyScratchesToPads = internalMutation({
  args: {},
  handler: async (ctx) => {
    let copied = 0;
    for (const row of await ctx.db.query("scratches").collect()) {
      const existing = await ctx.db
        .query("pads")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .unique();
      if (existing !== null) continue;
      const { userId, text, version, updatedAt } = row;
      await ctx.db.insert("pads", { userId, text, version, updatedAt });
      copied++;
    }
    return copied;
  },
});
