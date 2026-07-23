import { Injectable } from "@nestjs/common";
import type { JiraConnectorSecret } from "./connector.types";

export type JiraCreatedIssue = { key: string; url: string };

/** Jira Cloud, API-token auth (email + token, Basic auth) — the standard non-OAuth path Atlassian documents for personal automation. */
@Injectable()
export class JiraService {
  async createIssue(
    secret: JiraConnectorSecret,
    input: { projectKey: string; summary: string; description?: string; issueType?: string },
  ): Promise<JiraCreatedIssue> {
    const siteUrl = secret.siteUrl.replace(/\/+$/, "");
    const auth = Buffer.from(`${secret.email}:${secret.apiToken}`).toString("base64");
    const res = await fetch(`${siteUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: { key: input.projectKey },
          summary: input.summary,
          issuetype: { name: input.issueType || "Task" },
          ...(input.description
            ? {
                description: {
                  type: "doc",
                  version: 1,
                  content: [{ type: "paragraph", content: [{ type: "text", text: input.description }] }],
                },
              }
            : {}),
        },
      }),
    });
    if (res.status === 401) throw new Error("jira_invalid_credentials");
    if (!res.ok) throw new Error(`jira_api_${res.status}`);
    const data = (await res.json()) as { key: string };
    return { key: data.key, url: `${siteUrl}/browse/${data.key}` };
  }
}
