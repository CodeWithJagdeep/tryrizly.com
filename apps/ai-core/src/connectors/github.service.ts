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

export type GitHubCreatedIssue = { number: number; html_url: string };

/**
 * GitHub access with a fine-grained or classic personal access token. Reads
 * hit fixed paths; the automation "Create Issue" action is the one mutation
 * endpoint, gated on the token having `issues:write` (a fine-grained token
 * without it surfaces as a normal 403 -> github_api_403 step failure).
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

  /** `repo` must be `owner/name`. */
  async createIssue(
    secret: GitHubConnectorSecret,
    repo: string,
    title: string,
    body?: string,
  ): Promise<GitHubCreatedIssue> {
    if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) throw new Error("github_invalid_repo");
    const res = await fetch(`${GITHUB_API}/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
      },
      body: JSON.stringify({ title, body: body || undefined }),
    });
    if (res.status === 401) throw new Error("github_invalid_token");
    if (res.status === 404) throw new Error("github_repo_not_found");
    if (!res.ok) throw new Error(`github_api_${res.status}`);
    return (await res.json()) as GitHubCreatedIssue;
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
