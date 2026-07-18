import { afterEach, describe, expect, it, vi } from "vitest";
import { NotionService } from "./notion.service";

describe("NotionService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists recently edited pages when the query is empty", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        results: [
          {
            id: "page-1",
            url: "https://notion.so/page-1",
            last_edited_time: "2026-07-18T10:00:00.000Z",
            properties: { title: { title: [{ plain_text: "Launch plan" }] } },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pages = await new NotionService().search({ apiToken: "secret" }, "");
    expect(pages[0]?.title).toBe("Launch plan");
    const request = fetchMock.mock.calls[0];
    const init = request?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("query");
    expect(body).toMatchObject({
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
    });
  });
});
