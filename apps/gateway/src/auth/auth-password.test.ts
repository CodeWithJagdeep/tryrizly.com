import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth.service";

describe("password hashing", () => {
  it("verifies the correct password against its own hash+salt", () => {
    const { hash, salt } = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", salt, hash)).toBe(true);
  });

  it("rejects a wrong password against the same hash+salt", () => {
    const { hash, salt } = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", salt, hash)).toBe(false);
  });

  it("produces a different hash for the same password with a different salt (no fixed-salt reuse bug)", () => {
    const a = hashPassword("same password");
    const b = hashPassword("same password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // But each is still independently verifiable against its own salt.
    expect(verifyPassword("same password", a.salt, a.hash)).toBe(true);
    expect(verifyPassword("same password", b.salt, b.hash)).toBe(true);
  });

  it("never crashes on a hash-length mismatch (bad/legacy data)", () => {
    const { salt } = hashPassword("x");
    expect(() => verifyPassword("x", salt, "not-a-real-hash")).not.toThrow();
    expect(verifyPassword("x", salt, "not-a-real-hash")).toBe(false);
  });
});
