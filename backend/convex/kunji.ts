import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { findKunjiUser, type KunjiTool } from "./lib/kunji";
import { MAX_TEXT_BYTES, textBytes } from "./lib/limits";
import { findPad, writePad } from "./pad";

// Panna's tools for kunji (kunji SPEC.md → App contract). Each runs as the
// user kunji named and only ever sees that user's pad. The one write is
// append_to_pad; nothing replaces, clears or edits existing text.

const TAIL_LINES = 5;

export const access = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => await findKunjiUser(ctx, email),
});

export const readPad = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const row = await findPad(ctx, userId);
    const text = row?.text ?? "";
    return {
      text,
      bytes: textBytes(text),
      maxBytes: MAX_TEXT_BYTES,
      version: row?.version ?? 0,
      updatedAt: row ? new Date(row.updatedAt).toISOString() : null,
    };
  },
});

export const appendToPad = internalMutation({
  args: { userId: v.id("users"), text: v.string() },
  handler: async (ctx, { userId, text: added }) => {
    if (added.trim() === "") throw new ConvexError("Nothing to append: the text is empty.");
    const before = (await findPad(ctx, userId))?.text ?? "";
    const text = before === "" || before.endsWith("\n") ? before + added : `${before}\n${added}`;
    const bytes = textBytes(text);
    if (bytes > MAX_TEXT_BYTES) {
      const left = Math.max(0, MAX_TEXT_BYTES - textBytes(before) - 1);
      throw new ConvexError(`The pad holds at most 100 KB; only ${left} bytes are left.`);
    }
    const version = await writePad(ctx, userId, text);
    return { version, bytes, maxBytes: MAX_TEXT_BYTES, tail: text.split("\n").slice(-TAIL_LINES).join("\n") };
  },
});

export const tools: KunjiTool[] = [
  {
    name: "read_pad",
    description:
      "Read the user's Panna pad: a single plain-text scratch pad synced between their phone and browser. " +
      "Returns the whole text, its size in bytes (the pad holds at most 100 KB), its version (0 if never " +
      "saved) and when it was last saved.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (ctx, userId) => await ctx.runQuery(internal.kunji.readPad, { userId }),
  },
  {
    name: "append_to_pad",
    description:
      "Append text to the end of the user's Panna pad, on a new line (the pad is created if it doesn't exist). " +
      "Existing text is never changed. Refused if the pad would go over 100 KB. If the user is typing in the pad " +
      "at that very moment, their save can replace the appended text (the pad is last-write-wins). Returns the " +
      `new version, size and the pad's last ${TAIL_LINES} lines.`,
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "The text to add; may span several lines." } },
      required: ["text"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) =>
      await ctx.runMutation(internal.kunji.appendToPad, { userId, text: input.text as string }),
  },
];
