import { describe, expect, it } from "vitest";
import {
  getAuthRedirectBaseUrl,
  resolveOAuthCallbackUrl,
} from "./redirect-url";

const callbackPath = "/api/auth/google/callback";

describe("OAuth redirect URLs", () => {
  it("keeps local development on HTTP", () => {
    const requestUrl = new URL("https://localhost:3000/api/auth/google");

    expect(getAuthRedirectBaseUrl(requestUrl, {})).toBe("http://localhost:3000");
    expect(resolveOAuthCallbackUrl(requestUrl, callbackPath, undefined, {})).toBe(
      "http://localhost:3000/api/auth/google/callback",
    );
  });

  it("never redirects a browser to a server bind address", () => {
    const requestUrl = new URL("http://0.0.0.0:3000/api/auth/google");

    expect(getAuthRedirectBaseUrl(requestUrl, {})).toBe("http://localhost:3000");
    expect(resolveOAuthCallbackUrl(requestUrl, callbackPath, undefined, {})).toBe(
      "http://localhost:3000/api/auth/google/callback",
    );
  });

  it("uses the external host when production runs behind a localhost proxy", () => {
    const request = new Request("http://localhost:3000/api/auth/google", {
      headers: {
        host: "localhost:3000",
        "x-forwarded-host": "getrizly.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(
      getAuthRedirectBaseUrl(request, { WEB_APP_URL: "http://localhost:3000" }),
    ).toBe("https://getrizly.com");
    expect(
      resolveOAuthCallbackUrl(
        request,
        callbackPath,
        "http://localhost:3000/api/auth/google/callback",
        { WEB_APP_URL: "http://localhost:3000" },
      ),
    ).toBe("https://getrizly.com/api/auth/google/callback");
  });

  it("ignores a localhost callback on a production request", () => {
    expect(
      resolveOAuthCallbackUrl(
        new URL("https://getrizly.com/api/auth/google"),
        callbackPath,
        "http://localhost:3000/api/auth/google/callback",
        { WEB_APP_URL: "http://localhost:3000" },
      ),
    ).toBe("https://getrizly.com/api/auth/google/callback");
  });

  it("uses a valid configured production callback exactly", () => {
    expect(
      resolveOAuthCallbackUrl(
        new URL("https://preview.example.com/api/auth/google"),
        callbackPath,
        "https://www.getrizly.com/api/auth/google/callback",
        {},
      ),
    ).toBe("https://www.getrizly.com/api/auth/google/callback");
  });

  it("uses a configured HTTPS app domain after login", () => {
    expect(
      getAuthRedirectBaseUrl(new URL("https://api.internal/auth/callback"), {
        WEB_APP_URL: "https://app.example.com/",
      }),
    ).toBe("https://app.example.com");
  });

  it("falls back to the canonical domain when production config is unsafe", () => {
    expect(
      getAuthRedirectBaseUrl(new URL("https://getrizly.com/auth/callback"), {
        WEB_APP_URL: "http://127.0.0.1:3000",
      }),
    ).toBe("https://getrizly.com");
  });
});
