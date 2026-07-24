import { randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";
import { getDb } from "@heyriz/shared/db/mongo";
import type {
  AutomationCursor,
  AutomationFlow,
  AutomationFlowStatus,
  AutomationRun,
  AutomationStep,
} from "@heyriz/shared/automations/types";

/**
 * Owns the `automation_flows` / `automation_runs` Mongo collections behind
 * the flow-builder execution engine. Same shape as AuthRepository: general
 * app state → Mongo, one memoized ensureIndexes(), one client via getDb().
 */
@Injectable()
export class AutomationRepository {
  private indexesReady?: Promise<void>;

  private ensureIndexes(): Promise<void> {
    this.indexesReady ??= (async () => {
      const db = await getDb();
      await Promise.all([
        db.collection("automation_flows").createIndex({ id: 1 }, { unique: true }),
        db.collection("automation_flows").createIndex({ userId: 1 }),
        db.collection("automation_flows").createIndex({ status: 1 }),
        db.collection("automation_runs").createIndex({ id: 1 }, { unique: true }),
        db.collection("automation_runs").createIndex({ flowId: 1, startedAt: -1 }),
        db.collection("automation_runs").createIndex({ userId: 1 }),
      ]).catch(() => undefined);
    })();
    return this.indexesReady;
  }

  async listFlows(userId: string): Promise<AutomationFlow[]> {
    await this.ensureIndexes();
    const db = await getDb();
    const docs = await db
      .collection<AutomationFlow>("automation_flows")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();
    return docs.map(stripMongoId);
  }

  async getFlow(userId: string, id: string): Promise<AutomationFlow | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const doc = await db.collection<AutomationFlow>("automation_flows").findOne({ id, userId });
    return doc ? stripMongoId(doc) : null;
  }

  async upsertFlow(
    userId: string,
    input: { id?: string; name: string; status?: AutomationFlowStatus; steps: AutomationStep[] },
  ): Promise<AutomationFlow> {
    await this.ensureIndexes();
    const db = await getDb();
    const now = new Date().toISOString();
    const id = input.id ?? newFlowId();

    const existing = await db.collection<AutomationFlow>("automation_flows").findOne({ id, userId });
    const flow: AutomationFlow = {
      id,
      userId,
      name: input.name,
      status: input.status ?? existing?.status ?? "draft",
      steps: input.steps,
      cursor: existing?.cursor,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await db
      .collection<AutomationFlow>("automation_flows")
      .updateOne({ id, userId }, { $set: flow }, { upsert: true });
    return flow;
  }

  async setStatus(
    userId: string,
    id: string,
    status: AutomationFlowStatus,
    options?: { resetCursor?: boolean },
  ): Promise<AutomationFlow | null> {
    await this.ensureIndexes();
    const db = await getDb();
    await db
      .collection<AutomationFlow>("automation_flows")
      .updateOne(
        { id, userId },
        {
          $set: { status, updatedAt: new Date().toISOString() },
          ...(options?.resetCursor ? { $unset: { cursor: "" } } : {}),
        },
      );
    return this.getFlow(userId, id);
  }

  async deleteFlow(userId: string, id: string): Promise<boolean> {
    await this.ensureIndexes();
    const db = await getDb();
    const result = await db.collection("automation_flows").deleteOne({ id, userId });
    await db.collection("automation_runs").deleteMany({ flowId: id, userId });
    return result.deletedCount > 0;
  }

  /** Every active flow, across all users — the poller's read path. */
  async listActiveFlows(): Promise<AutomationFlow[]> {
    await this.ensureIndexes();
    const db = await getDb();
    const docs = await db
      .collection<AutomationFlow>("automation_flows")
      .find({ status: "active" })
      .toArray();
    return docs.map(stripMongoId);
  }

  async updateCursor(userId: string, id: string, cursor: AutomationCursor): Promise<void> {
    await this.ensureIndexes();
    const db = await getDb();
    await db.collection("automation_flows").updateOne({ id, userId }, { $set: { cursor } });
  }

  async createRun(run: Omit<AutomationRun, "id">): Promise<AutomationRun> {
    await this.ensureIndexes();
    const db = await getDb();
    const record: AutomationRun = { ...run, id: newRunId() };
    await db.collection<AutomationRun>("automation_runs").insertOne({ ...record });
    return record;
  }

  async getRun(id: string, userId: string): Promise<AutomationRun | null> {
    await this.ensureIndexes();
    const db = await getDb();
    const doc = await db.collection<AutomationRun>("automation_runs").findOne({ id, userId });
    return doc ? stripMongoId(doc) : null;
  }

  async finishRun(
    id: string,
    userId: string,
    patch: Pick<AutomationRun, "status" | "finishedAt" | "stepResults" | "auditTrail">,
  ): Promise<boolean> {
    await this.ensureIndexes();
    const db = await getDb();
    const result = await db.collection("automation_runs").updateOne({ id, userId }, { $set: patch });
    return result.matchedCount === 1;
  }

  async listRuns(userId: string, flowId: string, limit = 20): Promise<AutomationRun[]> {
    await this.ensureIndexes();
    const db = await getDb();
    const docs = await db
      .collection<AutomationRun>("automation_runs")
      .find({ userId, flowId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map(stripMongoId);
  }
}

function stripMongoId<T extends { id: string }>(doc: T & { _id?: unknown }): T {
  const { _id: _drop, ...rest } = doc;
  return rest as T;
}

function newFlowId(): string {
  return `flow_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function newRunId(): string {
  return `run_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}
