import { Injectable } from "@nestjs/common";
import type { TrelloConnectorSecret } from "./connector.types";

export type TrelloCreatedCard = { id: string; url: string };
export type TrelloCard = { id: string; name: string; dateLastActivity: string; url: string };

@Injectable()
export class TrelloService {
  /** Most-recently-active first — backs the "New Card" poll trigger for a given list. */
  async listCards(
    secret: TrelloConnectorSecret,
    input: { listId: string; limit?: number },
  ): Promise<TrelloCard[]> {
    const params = new URLSearchParams({
      key: secret.apiKey,
      token: secret.token,
      fields: "name,dateLastActivity,shortUrl",
      limit: String(Math.min(input.limit ?? 20, 50)),
    });
    const res = await fetch(`https://api.trello.com/1/lists/${input.listId}/cards?${params.toString()}`);
    if (res.status === 401) throw new Error("trello_invalid_credentials");
    if (!res.ok) throw new Error(`trello_api_${res.status}`);
    const data = (await res.json()) as Array<{ id: string; name: string; dateLastActivity: string; shortUrl?: string }>;
    return data.map((c) => ({ id: c.id, name: c.name, dateLastActivity: c.dateLastActivity, url: c.shortUrl ?? "" }));
  }

  async createCard(
    secret: TrelloConnectorSecret,
    input: { listId: string; name: string; description?: string },
  ): Promise<TrelloCreatedCard> {
    const params = new URLSearchParams({
      key: secret.apiKey,
      token: secret.token,
      idList: input.listId,
      name: input.name,
      ...(input.description ? { desc: input.description } : {}),
    });
    const res = await fetch(`https://api.trello.com/1/cards?${params.toString()}`, { method: "POST" });
    if (res.status === 401) throw new Error("trello_invalid_credentials");
    if (!res.ok) throw new Error(`trello_api_${res.status}`);
    const data = (await res.json()) as { id: string; shortUrl?: string; url?: string };
    return { id: data.id, url: data.shortUrl ?? data.url ?? "" };
  }
}
