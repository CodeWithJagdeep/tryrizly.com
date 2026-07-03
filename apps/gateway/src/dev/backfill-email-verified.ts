import { getDb } from "@heyriz/shared/db/mongo";

/**
 * One-time migration for the emailVerified gate added to login.
 *
 * Users created BEFORE that change have no `emailVerified` field and would now
 * be treated as unverified — locking them out of password login. This grandfathers
 * them in by setting `emailVerified: true` on any user document missing the field.
 *
 * New users created after the change always have `emailVerified` set explicitly
 * (false at register, true after OTP/OAuth), so they are never touched here.
 *
 * Dry-run by default — prints the count that would change. Pass `--apply` to write.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = await getDb();
  const filter = { emailVerified: { $exists: false } };

  const affected = await db.collection("users").countDocuments(filter);
  console.log(`users missing emailVerified: ${affected}`);

  if (!apply) {
    console.log("dry run — re-run with --apply to set emailVerified: true on these users");
    return;
  }

  const result = await db.collection("users").updateMany(filter, { $set: { emailVerified: true } });
  console.log(`updated ${result.modifiedCount} user(s) -> emailVerified: true`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("backfill failed", error);
    process.exit(1);
  });
