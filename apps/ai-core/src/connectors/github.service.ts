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

export type GitHubIssuePollItem = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  user?: { login?: string };
  pull_request?: unknown;
};

export type GitHubPullRequestPollItem = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  user?: { login?: string };
};

export type GitHubCommitPollItem = {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { name?: string; date?: string } };
  author?: { login?: string } | null;
};

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

  private assertRepoFormat(repo: string): void {
    if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) throw new Error("github_invalid_repo");
  }

  /** `repo` must be `owner/name`. */
  async createIssue(
    secret: GitHubConnectorSecret,
    repo: string,
    title: string,
    body?: string,
  ): Promise<GitHubCreatedIssue> {
    this.assertRepoFormat(repo);
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

  /**
   * Backs the "New Issue" poll trigger — newest-created-first. GitHub's
   * `/issues` endpoint also returns pull requests (flagged with a
   * `pull_request` key on the item), so those are filtered out here rather
   * than left for the caller to dedupe against the "New Pull Request" trigger.
   */
  async listNewIssues(
    secret: GitHubConnectorSecret,
    repo: string,
    limit = 20,
  ): Promise<GitHubIssuePollItem[]> {
    this.assertRepoFormat(repo);
    const data = await this.get<GitHubIssuePollItem[]>(
      secret,
      `/repos/${repo}/issues?sort=created&direction=desc&state=all&per_page=${Math.min(limit, 50)}`,
    );
    return data.filter((item) => !item.pull_request);
  }

  /** Backs the "New Pull Request" poll trigger — newest-created-first. */
  async listNewPullRequests(
    secret: GitHubConnectorSecret,
    repo: string,
    limit = 20,
  ): Promise<GitHubPullRequestPollItem[]> {
    this.assertRepoFormat(repo);
    return this.get<GitHubPullRequestPollItem[]>(
      secret,
      `/repos/${repo}/pulls?sort=created&direction=desc&state=all&per_page=${Math.min(limit, 50)}`,
    );
  }

  /**
   * Backs the "New Push" poll trigger. `sha` is intentionally omitted —
   * GitHub defaults the commits list to the repo's default branch, sparing a
   * second request to `GET /repos/{repo}` just to read `default_branch`.
   */
  async listNewCommits(
    secret: GitHubConnectorSecret,
    repo: string,
    limit = 20,
  ): Promise<GitHubCommitPollItem[]> {
    this.assertRepoFormat(repo);
    return this.get<GitHubCommitPollItem[]>(
      secret,
      `/repos/${repo}/commits?per_page=${Math.min(limit, 50)}`,
    );
  }
}
