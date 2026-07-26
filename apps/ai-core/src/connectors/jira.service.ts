import { Injectable } from "@nestjs/common";
import type { JiraConnectorSecret } from "./connector.types";

export type JiraCreatedIssue = { key: string; url: string };
export type JiraIssue = {
  key: string;
  summary: string;
  status: string;
  url: string;
  updated: string;
};

type JiraRequest = { baseUrl: string; headers: Record<string, string> };

/** Jira Cloud — OAuth 2.0 (3LO) when connected, falling back to email + API-token Basic auth for manual connections. */
@Injectable()
export class JiraService {
  async createIssue(
    secret: JiraConnectorSecret,
    input: { projectKey: string; summary: string; description?: string; issueType?: string },
  ): Promise<JiraCreatedIssue> {
    const { baseUrl, headers } = requestFor(secret);
    const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", accept: "application/json" },
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
    return { key: data.key, url: `${issueBrowseBase(secret)}/browse/${data.key}` };
  }

  /** Newest-updated first. `jql` overrides the default "assigned to me, unresolved" search when provided. */
  async searchIssues(
    secret: JiraConnectorSecret,
    input: { jql?: string; projectKey?: string; maxResults?: number },
  ): Promise<JiraIssue[]> {
    const { baseUrl, headers } = requestFor(secret);
    const jql = input.jql?.trim()
      || (input.projectKey
        ? `project = ${jqlLiteral(input.projectKey)} ORDER BY updated DESC`
        : "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC");
    const params = new URLSearchParams({
      jql,
      maxResults: String(Math.min(Math.max(input.maxResults ?? 10, 1), 25)),
      fields: "summary,status,updated",
    });
    const res = await fetch(`${baseUrl}/rest/api/3/search?${params.toString()}`, {
      headers: { ...headers, accept: "application/json" },
    });
    if (res.status === 401) throw new Error("jira_invalid_credentials");
    if (!res.ok) throw new Error(`jira_api_${res.status}`);
    const data = (await res.json()) as {
      issues?: Array<{
        key: string;
        fields: { summary: string; status: { name: string }; updated: string };
      }>;
    };
    const browseBase = issueBrowseBase(secret);
    return (data.issues ?? []).map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      updated: issue.fields.updated,
      url: `${browseBase}/browse/${issue.key}`,
    }));
  }
}

function requestFor(secret: JiraConnectorSecret): JiraRequest {
  if (secret.accessToken && secret.cloudId) {
    return {
      baseUrl: `https://api.atlassian.com/ex/jira/${secret.cloudId}`,
      headers: { authorization: `Bearer ${secret.accessToken}` },
    };
  }
  if (secret.siteUrl && secret.email && secret.apiToken) {
    const auth = Buffer.from(`${secret.email}:${secret.apiToken}`).toString("base64");
    return {
      baseUrl: secret.siteUrl.replace(/\/+$/, ""),
      headers: { authorization: `Basic ${auth}` },
    };
  }
  throw new Error("jira_invalid_credentials");
}

/** Issue browse links go through the site's real URL, not the api.atlassian.com proxy host used for OAuth requests. */
function issueBrowseBase(secret: JiraConnectorSecret): string {
  if (secret.siteUrl) return secret.siteUrl.replace(/\/+$/, "");
  // OAuth connections don't store the human site URL on the secret itself
  // (only cloudId, which the API needs) — metadata.siteUrl on the connected
  // account has it for display purposes; this proxy link still works for API
  // clients but won't render as a normal browser page without it.
  return `https://api.atlassian.com/ex/jira/${secret.cloudId}`;
}

function jqlLiteral(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}
