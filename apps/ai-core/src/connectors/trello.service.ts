import { Injectable } from "@nestjs/common";
import type { TrelloConnectorSecret } from "./connector.types";

export type TrelloCreatedCard = { id: string; url: string };

@Injectable()
export class TrelloService {
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
