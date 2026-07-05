import { describe, expect, it } from "vitest";
import {
  companyNameFromDomain,
  isFreeEmailDomain,
  isRoleLocalPart,
  registrableDomain,
} from "./entity-resolver.service";

describe("registrableDomain", () => {
  it("collapses a mail subdomain onto the registrable domain", () => {
    expect(registrableDomain("accounts.google.com")).toBe("google.com");
    expect(registrableDomain("mail.google.com")).toBe("google.com");
    expect(registrableDomain("google.com")).toBe("google.com");
  });

  it("handles a compound (second-level) TLD like .co.uk", () => {
    expect(registrableDomain("mail.example.co.uk")).toBe("example.co.uk");
    expect(registrableDomain("example.co.uk")).toBe("example.co.uk");
  });

  it("falls back to the last two labels for an unrecognized compound TLD", () => {
    expect(registrableDomain("sub.example.io")).toBe("example.io");
  });
});

describe("isFreeEmailDomain", () => {
  it("recognizes common free-email providers regardless of subdomain", () => {
    expect(isFreeEmailDomain("gmail.com")).toBe(true);
    expect(isFreeEmailDomain("mail.gmail.com")).toBe(true);
    expect(isFreeEmailDomain("outlook.com")).toBe(true);
  });

  it("does not flag a real company domain as free email", () => {
    expect(isFreeEmailDomain("acmecorp.com")).toBe(false);
  });
});

describe("isRoleLocalPart", () => {
  it("recognizes known automated/role mailbox locals", () => {
    expect(isRoleLocalPart("no-reply")).toBe(true);
    expect(isRoleLocalPart("noreply")).toBe(true);
    expect(isRoleLocalPart("billing")).toBe(true);
    expect(isRoleLocalPart("support")).toBe(true);
  });

  it("catches automated locals the enumerated list can't cover, via the regex fallback", () => {
    expect(isRoleLocalPart("noreply-orders")).toBe(true);
    expect(isRoleLocalPart("billing.alerts")).toBe(true);
  });

  it("does not flag an ordinary personal local part", () => {
    expect(isRoleLocalPart("jagdeep")).toBe(false);
    expect(isRoleLocalPart("j.singh")).toBe(false);
  });
});

describe("companyNameFromDomain", () => {
  it("title-cases the registrable domain's first label", () => {
    expect(companyNameFromDomain("acmecorp.com")).toBe("Acmecorp");
    expect(companyNameFromDomain("mail.acme-corp.com")).toBe("Acme Corp");
  });

  it("returns undefined for a domain too short to be a real company name", () => {
    expect(companyNameFromDomain("a.com")).toBeUndefined();
  });
});
