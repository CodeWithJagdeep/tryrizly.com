import { describe, expect, it } from "vitest";
import { PRODUCTION_WEB_APP_URL, resolveWebAppUrl } from "./web-app-url";

describe("resolveWebAppUrl", () => {
  it("keeps localhost in development", () => {
    expect(resolveWebAppUrl("http://localhost:3000", "development")).toBe(
      "http://localhost:3000",
    );
  });

  it("never exposes localhost from a production service", () => {
    expect(resolveWebAppUrl("http://localhost:3000", "production")).toBe(
      PRODUCTION_WEB_APP_URL,
    );
  });

  it("keeps a configured HTTPS production domain", () => {
    expect(resolveWebAppUrl("https://app.example.com/", "production")).toBe(
      "https://app.example.com",
    );
  });

  it("rejects insecure public origins in production", () => {
    expect(resolveWebAppUrl("http://app.example.com", "production")).toBe(
      PRODUCTION_WEB_APP_URL,
    );
  });
});
