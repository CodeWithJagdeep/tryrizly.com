import { Injectable } from "@nestjs/common";

export type NotionSecret = { apiToken: string };

export type NotionPage = {
  id: string;
  title: string;
  url: string;
  lastEdited: string;
};

@Injectable()
export class NotionService {
  async search(secret: NotionSecret, query: string): Promise<NotionPage[]> {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify({ query, page_size: 10 }),
    });

    if (!res.ok) throw new Error(`notion_api_${res.status}`);
    const data = (await res.json()) as { results?: unknown[] };
    return (data.results ?? []).map((r) => this.parsePage(r as Record<string, unknown>));
  }

  async getPageContent(secret: NotionSecret, pageId: string): Promise<string> {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      headers: this.headers(secret),
    });
    if (!res.ok) throw new Error(`notion_api_${res.status}`);
    const data = (await res.json()) as { results?: unknown[] };
    return (data.results ?? [])
      .map((b) => this.extractText(b as Record<string, unknown>))
      .filter(Boolean)
      .join("\n")
      .slice(0, 3000);
  }

  private parsePage(r: Record<string, unknown>): NotionPage {
    const props = (r.properties ?? {}) as Record<string, unknown>;
    const titleProp = (props.title ?? props.Name ?? props.name ?? {}) as { title?: { plain_text?: string }[] };
    const title = titleProp.title?.[0]?.plain_text ?? "Untitled";
    return {
      id: r.id as string,
      title,
      url: r.url as string,
      lastEdited: r.last_edited_time as string,
    };
  }

  private extractText(block: Record<string, unknown>): string {
    const type = block.type as string;
    const content = (block[type] ?? {}) as { rich_text?: { plain_text?: string }[] };
    return (content.rich_text ?? []).map((t) => t.plain_text ?? "").join("");
  }

  private headers(secret: NotionSecret): Record<string, string> {
    return {
      Authorization: `Bearer ${secret.apiToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };
  }
}
