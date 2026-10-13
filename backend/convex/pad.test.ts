import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { MAX_TEXT_BYTES } from "./lib/limits";
import { newTest, signedInUser } from "./test.helpers";

describe("allowlist", () => {
  test("a non-allowlisted email can't sign up or sign in", async () => {
    const t = newTest();
    for (const flow of ["signUp", "signIn"] as const) {
      await expect(
        t.action(api.auth.signIn, {
          provider: "password",
          params: { email: "mallory@example.com", password: "password123", flow },
        }),
      ).rejects.toThrow("notAllowed");
    }
    // Rejected before anything is stored.
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toEqual([]);
  });

  test("an allowlisted email can sign up, case-insensitively", async () => {
    const t = newTest();
    // Token minting needs JWT_PRIVATE_KEY, which tests don't set; the account
    // is stored before that step.
    await t
      .action(api.auth.signIn, {
        provider: "password",
        params: { email: " BOB@example.com ", password: "password123", flow: "signUp" },
      })
      .catch(() => {});
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.map((u) => u.email)).toEqual(["bob@example.com"]);
  });

  test("an unset list allows nobody", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    vi.stubEnv("ALLOWED_EMAILS", "");
    await expect(alice.as.query(api.pad.get, {})).rejects.toThrow("notAllowed");
  });

  test("a signed-in user whose email isn't allowed is refused", async () => {
    const t = newTest();
    const mallory = await signedInUser(t, "mallory@example.com");
    await expect(mallory.as.query(api.pad.get, {})).rejects.toThrow("notAllowed");
    await expect(
      mallory.as.mutation(api.pad.save, { text: "x", baseVersion: 0 }),
    ).rejects.toThrow("notAllowed");
    await expect(mallory.as.query(api.users.me, {})).rejects.toThrow("notAllowed");
  });

  test("removing an email cuts off an existing session", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    expect(await alice.as.query(api.pad.get, {})).toBeNull();
    vi.stubEnv("ALLOWED_EMAILS", "bob@example.com");
    await expect(alice.as.query(api.pad.get, {})).rejects.toThrow("notAllowed");
    await expect(
      alice.as.mutation(api.pad.save, { text: "x", baseVersion: 0 }),
    ).rejects.toThrow("notAllowed");
  });

  test("anonymous callers are refused", async () => {
    const t = newTest();
    await expect(t.query(api.pad.get, {})).rejects.toThrow("notAuthenticated");
  });
});

describe("pad", () => {
  test("each user only sees and overwrites their own text", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const bob = await signedInUser(t, "bob@example.com");
    await alice.as.mutation(api.pad.save, { text: "alice's secret", baseVersion: 0 });
    expect(await bob.as.query(api.pad.get, {})).toBeNull();
    await bob.as.mutation(api.pad.save, { text: "bob's", baseVersion: 0 });
    expect((await alice.as.query(api.pad.get, {}))?.text).toBe("alice's secret");
    expect((await bob.as.query(api.pad.get, {}))?.text).toBe("bob's");
    const rows = await t.run((ctx) => ctx.db.query("pads").collect());
    expect(rows).toHaveLength(2);
  });

  test("version bumps on each save, and a stale save still wins", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    expect(await alice.as.mutation(api.pad.save, { text: "a", baseVersion: 0 })).toBe(1);
    expect(await alice.as.mutation(api.pad.save, { text: "b", baseVersion: 1 })).toBe(2);
    // Based on version 1 while the server is at 2: last write wins.
    expect(await alice.as.mutation(api.pad.save, { text: "c", baseVersion: 1 })).toBe(3);
    const got = await alice.as.query(api.pad.get, {});
    expect(got).toMatchObject({ text: "c", version: 3 });
    const rows = await t.run((ctx) => ctx.db.query("pads").collect());
    expect(rows).toHaveLength(1);
  });

  test("the size cap is enforced in bytes", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    await expect(
      alice.as.mutation(api.pad.save, { text: "a".repeat(MAX_TEXT_BYTES), baseVersion: 0 }),
    ).resolves.toBe(1);
    await expect(
      alice.as.mutation(api.pad.save, { text: "a".repeat(MAX_TEXT_BYTES + 1), baseVersion: 1 }),
    ).rejects.toThrow("textTooLong");
    // Multi-byte characters count by their UTF-8 size.
    await expect(
      alice.as.mutation(api.pad.save, { text: "é".repeat(MAX_TEXT_BYTES / 2 + 1), baseVersion: 1 }),
    ).rejects.toThrow("textTooLong");
    expect((await alice.as.query(api.pad.get, {}))?.version).toBe(1);
  });
});
