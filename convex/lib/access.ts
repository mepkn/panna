import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isAllowedEmail } from "./allowlist";

export async function requireUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("notAuthenticated");
  // Re-checked on every call, so removing an email cuts off existing sessions.
  const user = await ctx.db.get("users", userId);
  if (!isAllowedEmail(user?.email)) throw new ConvexError("notAllowed");
  return userId;
}
