import { MongoClient, type Db } from "mongodb";
import { env } from "../env";

let client: MongoClient | undefined;
let connecting: Promise<MongoClient> | undefined;

/**
 * General application state (users, OTPs, link tokens, onboarding progress)
 * lives in Mongo; agent memory/tasks stay on Postgres. One lazily-connected
 * client shared by both `web` and `apps/gateway`.
 */
export async function getDb(): Promise<Db> {
  if (!env.MONGODB_URL) {
    throw new Error("MONGODB_URL is not configured");
  }

  if (!client) {
    connecting ??= MongoClient.connect(env.MONGODB_URL).then((c) => {
      client = c;
      return c;
    });
    client = await connecting;
  }

  return client.db();
}
