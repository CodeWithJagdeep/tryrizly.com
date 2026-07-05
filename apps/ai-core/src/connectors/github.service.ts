import { Injectable } from "@nestjs/common";
import type { GitHubConnectorSecret } from "./connector.types";

const GITHUB_API = "https://api.github.com";

export type GitHubIssueItem = {
  title: string;
  html_url: string;
  state: string;
  number: number;
  updated_at: string;
  repository_url: string;
  pull_request?: unknown;
  user?: { login?: string };
};

/**
 * Read-only GitHub access with a fine-grained or classic personal access
 * token. Only GETs against fixed paths — no mutation endpoint is reachable.
 */
@Injectable()
export class GitHubService {
  private async get<T>(secret: GitHubConnectorSecret, path: string): Promise<T> {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        authorization: `Bearer ${secret.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (res.status === 401) throw new Error("github_invalid_token");
    if (!res.ok) throw new Error(`github_api_${res.status}`);
    return (await res.json()) as T;
  }

  /** The token owner's login — also serves as the connection health check. */
  async getViewerLogin(secret: GitHubConnectorSecret): Promise<string> {
    const user = await this.get<{ login?: string }>(secret, "/user");
    if (!user.login) throw new Error("github_no_login");
    return user.login;
  }

  /**
   * Open issues + PRs involving the given login (author, assignee, mentioned,
   * or review-requested), most recently updated first.
   */
  async listOpenInvolvements(
    secret: GitHubConnectorSecret,
    login: string,
    limit = 20,
  ): Promise<GitHubIssueItem[]> {
    const q = encodeURIComponent(`is:open involves:${login} archived:false`);
    const data = await this.get<{ items?: GitHubIssueItem[] }>(
      secret,
      `/search/issues?q=${q}&sort=updated&order=desc&per_page=${Math.min(limit, 50)}`,
    );
    return data.items ?? [];
  }
}
