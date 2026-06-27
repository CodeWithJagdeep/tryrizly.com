import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import type { HeyRizEventSource } from "../context/context.types";

export type TaskStatus = "open" | "done";

export type PrincipalTask = {
  id: string;
  userId: string;
  summary: string;
  source: HeyRizEventSource;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  userId: string;
  summary: string;
  source?: HeyRizEventSource;
};

const inMemoryTasks = new Map<string, PrincipalTask>();

@Injectable()
export class TaskRepository implements OnModuleDestroy {
  private readonly pool?: Pool;
  private tableReady?: Promise<void>;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  async create(input: CreateTaskInput): Promise<PrincipalTask> {
    const now = new Date().toISOString();
    const task: PrincipalTask = {
      id: crypto.randomUUID(),
      userId: input.userId,
      summary: input.summary,
      source: input.source ?? "telegram",
      status: "open",
      createdAt: now,
      updatedAt: now,
    };

    if (!this.pool) {
      inMemoryTasks.set(task.id, task);
      return task;
    }

    await this.ensureTable();
    const row = await this.pool.query<PrincipalTask>(
      `
      insert into tasks (id, user_id, summary, source, status, created_at, updated_at)
      values ($1,$2,$3,$4,$5,$6,$7)
      returning
        id,
        user_id as "userId",
        summary,
        source,
        status,
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [
        task.id,
        task.userId,
        task.summary,
        task.source,
        task.status,
        task.createdAt,
        task.updatedAt,
      ],
    );

    return row.rows[0];
  }

  async listOpen(userId: string): Promise<PrincipalTask[]> {
    if (!this.pool) {
      return [...inMemoryTasks.values()]
        .filter((task) => task.userId === userId && task.status === "open")
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    }

    await this.ensureTable();
    const result = await this.pool.query<PrincipalTask>(
      `
      select
        id,
        user_id as "userId",
        summary,
        source,
        status,
        created_at as "createdAt",
        updated_at as "updatedAt"
      from tasks
      where user_id = $1 and status = 'open'
      order by created_at asc
      limit 25
      `,
      [userId],
    );

    return result.rows;
  }

  async listAll(userId: string, limit = 50): Promise<PrincipalTask[]> {
    if (!this.pool) {
      return [...inMemoryTasks.values()]
        .filter((task) => task.userId === userId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit);
    }

    await this.ensureTable();
    const result = await this.pool.query<PrincipalTask>(
      `
      select
        id,
        user_id as "userId",
        summary,
        source,
        status,
        created_at as "createdAt",
        updated_at as "updatedAt"
      from tasks
      where user_id = $1
      order by created_at desc
      limit $2
      `,
      [userId, limit],
    );

    return result.rows;
  }

  async markDone(id: string): Promise<void> {
    const now = new Date().toISOString();
    if (!this.pool) {
      const existing = inMemoryTasks.get(id);
      if (existing) {
        inMemoryTasks.set(id, { ...existing, status: "done", updatedAt: now });
      }
      return;
    }

    await this.ensureTable();
    await this.pool.query(
      "update tasks set status = 'done', updated_at = $2 where id = $1",
      [id, now],
    );
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private ensureTable(): Promise<void> {
    if (!this.pool) return Promise.resolve();
    this.tableReady ??= this.pool
      .query(
        `
        create table if not exists tasks (
          id text primary key,
          user_id text not null,
          summary text not null,
          source text not null,
          status text not null,
          created_at timestamptz not null,
          updated_at timestamptz not null
        )
        `,
      )
      .then(() => undefined);
    return this.tableReady;
  }
}
