/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { checkInput, secretMatches } from "./lib/kunji";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "kjs_test-secret";
const ME = "me@example.com";
const NOW = Date.UTC(2026, 9, 31, 9, 0);

beforeEach(() => {
  vi.stubEnv("KUNJI_SECRET", SECRET);
  vi.stubEnv("ALLOWED_EMAILS", `${ME},stranger@example.com`);
});
afterEach(() => vi.unstubAllEnvs());

async function setup(text?: string) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: ME, emailVerificationTime: 1 });
    // An unverified sign-up with someone else's email must never count.
    await ctx.db.insert("users", { email: "other@example.com" });
    const strangerId = await ctx.db.insert("users", { email: "stranger@example.com", emailVerificationTime: 1 });
    await ctx.db.insert("pads", { userId: strangerId, text: "their secret", version: 4, updatedAt: NOW });
    if (text !== undefined) await ctx.db.insert("pads", { userId, text, version: 3, updatedAt: NOW });
    return { userId, strangerId };
  });
  return { t, ...ids };
}

const post = (body: unknown, secret = SECRET) => ({
  method: "POST",
  headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

type T = Awaited<ReturnType<typeof setup>>["t"];
async function call(t: T, tool: string, input: unknown = {}, userEmail = ME) {
  const res = await t.fetch("/kunji/call", post({ tool, input, userEmail }));
  expect(res.status).toBe(200);
  return await res.json();
}

describe("secret check", () => {
  it("compares exactly", async () => {
    expect(await secretMatches(SECRET, SECRET)).toBe(true);
    expect(await secretMatches(SECRET + "x", SECRET)).toBe(false);
    expect(await secretMatches("", "")).toBe(false);
  });

  it.each([
    ["GET", "/kunji/tools"],
    ["POST", "/kunji/access"],
    ["POST", "/kunji/call"],
  ])("%s %s refuses a wrong or missing secret", async (method, path) => {
    const { t } = await setup();
    const body = method === "POST" ? JSON.stringify({ userEmail: ME, tool: "read_pad" }) : undefined;
    expect((await t.fetch(path, { method, headers: { Authorization: "Bearer nope" }, body })).status).toBe(401);
    expect((await t.fetch(path, { method, body })).status).toBe(401);
  });

  it("refuses everything when KUNJI_SECRET is unset", async () => {
    vi.stubEnv("KUNJI_SECRET", "");
    const { t } = await setup();
    expect((await t.fetch("/kunji/tools", { headers: { Authorization: "Bearer " } })).status).toBe(401);
  });
});

describe("checkInput", () => {
  it("checks required keys, types and unknown fields", () => {
    const schema = {
      type: "object" as const,
      properties: { q: { type: "string" as const }, n: { type: "integer" as const } },
      required: ["q"],
      additionalProperties: false as const,
    };
    expect(checkInput(schema, { q: "x", n: 2 })).toBeNull();
    expect(checkInput(schema, {})).toBe('Missing "q".');
    expect(checkInput(schema, { q: "x", n: 1.5 })).toBe('"n" must be an integer.');
    expect(checkInput(schema, { q: "x", z: 1 })).toBe('Unknown field "z".');
    expect(checkInput(schema, [])).toBe("Input must be a JSON object.");
  });
});

describe("GET /kunji/tools", () => {
  it("lists the tools with their schemas", async () => {
    const { t } = await setup();
    const res = await t.fetch("/kunji/tools", { headers: { Authorization: `Bearer ${SECRET}` } });
    const tools = (await res.json()) as { name: string; inputSchema: { type: string } }[];
    expect(tools.map((x) => x.name)).toEqual(["read_pad", "append_to_pad"]);
    expect(tools.every((x) => x.inputSchema.type === "object" && /^[a-z][a-z0-9_]{0,63}$/.test(x.name))).toBe(true);
  });
});

describe("POST /kunji/access", () => {
  it.each([
    [ME, "ok"],
    ["ME@Example.com ", "ok"],
    ["nobody@example.com", "no_account"],
    ["other@example.com", "no_account"], // unverified
  ])("%s → %s", async (userEmail, status) => {
    const { t } = await setup();
    const res = await t.fetch("/kunji/access", post({ userEmail }));
    expect(await res.json()).toEqual({ status });
  });

  it("is not_allowed once the email leaves ALLOWED_EMAILS", async () => {
    const { t } = await setup();
    vi.stubEnv("ALLOWED_EMAILS", "someone@else.com");
    expect(await (await t.fetch("/kunji/access", post({ userEmail: ME }))).json()).toEqual({ status: "not_allowed" });
  });

  it("is no_account when two verified rows share the email", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => void (await ctx.db.insert("users", { email: ME, emailVerificationTime: 1 })));
    expect(await (await t.fetch("/kunji/access", post({ userEmail: ME }))).json()).toEqual({ status: "no_account" });
  });

  it("needs userEmail", async () => {
    const { t } = await setup();
    expect((await t.fetch("/kunji/access", post({}))).status).toBe(400);
  });
});

describe("POST /kunji/call", () => {
  it("refuses no_account, not_allowed, unknown tools and bad input", async () => {
    const { t } = await setup();
    expect(await call(t, "read_pad", {}, "nobody@example.com")).toMatchObject({ ok: false, error: { code: "no_account" } });
    expect(await call(t, "delete_everything")).toMatchObject({ ok: false, error: { code: "unknown_tool" } });
    expect(await call(t, "read_pad", { x: 1 })).toMatchObject({ ok: false, error: { code: "bad_input", message: 'Unknown field "x".' } });
    vi.stubEnv("ALLOWED_EMAILS", "someone@else.com");
    expect(await call(t, "read_pad")).toMatchObject({ ok: false, error: { code: "not_allowed" } });
  });

  it("read_pad reads the user's own pad", async () => {
    const { t } = await setup("héllo\nworld");
    expect(await call(t, "read_pad")).toEqual({
      ok: true,
      result: { text: "héllo\nworld", bytes: 12, maxBytes: 100 * 1024, version: 3, updatedAt: new Date(NOW).toISOString() },
    });
  });

  it("read_pad returns an empty pad before the first save", async () => {
    const { t } = await setup();
    expect((await call(t, "read_pad")).result).toEqual({ text: "", bytes: 0, maxBytes: 100 * 1024, version: 0, updatedAt: null });
  });

  it("append_to_pad adds a line at the end and leaves the rest alone", async () => {
    const { t, userId, strangerId } = await setup("one\ntwo");
    const { ok, result } = await call(t, "append_to_pad", { text: "three" });
    expect(ok).toBe(true);
    expect(result).toEqual({ version: 4, bytes: 13, maxBytes: 100 * 1024, tail: "one\ntwo\nthree" });
    await call(t, "append_to_pad", { text: "four\n" });
    await call(t, "append_to_pad", { text: "five" });
    const pads = await t.run((ctx) => ctx.db.query("pads").collect());
    expect(pads.find((p) => p.userId === userId)?.text).toBe("one\ntwo\nthree\nfour\nfive");
    expect(pads.find((p) => p.userId === strangerId)).toMatchObject({ text: "their secret", version: 4 });
  });

  it("append_to_pad creates the pad, refuses empty text and the size limit", async () => {
    const { t } = await setup();
    expect((await call(t, "append_to_pad", { text: "first" })).result).toMatchObject({ version: 1, tail: "first" });
    expect(await call(t, "append_to_pad", { text: "  " })).toMatchObject({ ok: false, error: { code: "tool_error" } });
    expect(await call(t, "append_to_pad", { text: "x".repeat(100 * 1024) })).toMatchObject({
      ok: false,
      error: { code: "tool_error", message: "The pad holds at most 100 KB; only 102394 bytes are left." },
    });
  });
});
