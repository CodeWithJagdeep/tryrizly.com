import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient } from "pg";
import { env } from "@heyriz/shared/env";
import { removeUserQueueData } from "@heyriz/shared/queue/queues";
import { ConnectorRepository } from "../connectors/connector.repository";
import { ConnectorVaultService } from "../connectors/connector-vault.service";
import { EmailPreferencesRepository } from "../email/email-preferences.repository";
import { VectorMemoryService } from "../memory/vector-memory.service";

const USER_TABLES = [
  "notification_log",
  "source_receipts",
  "agent_plans",
  "tasks",
  "llm_usage_log",
  "ai_credit_rollovers",
  "user_preferences",
  "memories",
  "decisions",
  "events",
  "entities",
] as const;

@Injectable()
export class AccountDeletionService implements OnModuleDestroy {
  private readonly pool?: Pool;

  constructor(
    private readonly connectors: ConnectorRepository,
    private readonly vault: ConnectorVaultService,
    private readonly emailPreferences: EmailPreferencesRepository,
    private readonly memories: VectorMemoryService,
  ) {
    if (env.DATABASE_URL) this.pool = new Pool({ connectionString: env.DATABASE_URL });
  }

  async deleteUserData(userId: string) {
    await this.revokeGoogleAccess(userId);
    const queue = await removeUserQueueData(userId);

    // These calls also clear the repositories' development-mode stores.
    const [connectors, memories] = await Promise.all([
      this.connectors.deleteAll(userId),
      this.memories.forgetAll(userId),
      this.emailPreferences.deleteAll(userId),
    ]);

    const databaseRows = this.pool ? await this.deletePostgresRows(userId) : 0;
    return { ok: true, queueJobsRemoved: queue.removed, connectors, memories, databaseRows };
  }

  private async revokeGoogleAccess(userId: string): Promise<void> {
    const accounts = await this.connectors.list(userId);
    const googleAccounts = accounts.filter(
      (account) => account.authType === "oauth" && (account.provider === "gmail" || account.provider === "calendar"),
    );
    for (const account of googleAccounts) {
      const secret = this.vault.decrypt(account.encryptedPayload);
      const token =
        (typeof secret.refresh_token === "string" && secret.refresh_token) ||
        (typeof secret.access_token === "string" && secret.access_token);
      if (!token) continue;
      const response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`google_token_revocation_failed:${response.status}`);
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private async deletePostgresRows(userId: string): Promise<number> {
    const client = await this.pool!.connect();
    try {
      await client.query("begin");
      let removed = 0;
      for (const table of USER_TABLES) {
        removed += await deleteFromExistingTable(client, table, userId);
      }
      await client.query("commit");
      return removed;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function deleteFromExistingTable(
  client: PoolClient,
  table: (typeof USER_TABLES)[number],
  userId: string,
): Promise<number> {
  const exists = await client.query<{ table_name: string | null }>("select to_regclass($1) as table_name", [table]);
  if (!exists.rows[0]?.table_name) return 0;
  const result = await client.query(`delete from ${table} where user_id = $1`, [userId]);
  return result.rowCount ?? 0;
}
