#!/bin/bash
# Daily Postgres + Mongo backup with 7-day local rotation. Runs on the prod
# VM (heyriz-prod) against the heyriz-prod-postgres-1/heyriz-prod-mongodb-1
# containers by name — adjust those if container names ever change.
#
# Installed via cron (3am daily):
#   (crontab -l 2>/dev/null; echo "0 3 * * * $HOME/heyriz/scripts/backup.sh") | crontab -
#
# Backups land in ~/backups on the VM — local disk only, no offsite copy yet.
# If the VM's disk is ever lost, these go with it; consider syncing to a GCS
# bucket as a follow-up.
set -euo pipefail

BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y-%m-%d_%H%M%S)
LOG="$BACKUP_DIR/backup.log"
RETAIN_DAYS=7

mkdir -p "$BACKUP_DIR"
echo "[$DATE] Starting backup" >> "$LOG"

# --- Postgres ---
if docker exec heyriz-prod-postgres-1 pg_dump -U heyriz -d heyriz --format=custom > "$BACKUP_DIR/postgres_$DATE.dump" 2>> "$LOG"; then
  echo "[$DATE] Postgres backup OK: postgres_$DATE.dump ($(du -h "$BACKUP_DIR/postgres_$DATE.dump" | cut -f1))" >> "$LOG"
else
  echo "[$DATE] Postgres backup FAILED" >> "$LOG"
fi

# --- Mongo ---
MONGO_USER=$(docker exec heyriz-prod-mongodb-1 printenv MONGO_INITDB_ROOT_USERNAME)
MONGO_PASS=$(docker exec heyriz-prod-mongodb-1 printenv MONGO_INITDB_ROOT_PASSWORD)
if docker exec heyriz-prod-mongodb-1 mongodump --username "$MONGO_USER" --password "$MONGO_PASS" --authenticationDatabase admin --db heyriz --archive > "$BACKUP_DIR/mongo_$DATE.archive" 2>> "$LOG"; then
  echo "[$DATE] Mongo backup OK: mongo_$DATE.archive ($(du -h "$BACKUP_DIR/mongo_$DATE.archive" | cut -f1))" >> "$LOG"
else
  echo "[$DATE] Mongo backup FAILED" >> "$LOG"
fi

# --- Rotate old backups ---
find "$BACKUP_DIR" -name "postgres_*.dump" -mtime "+$RETAIN_DAYS" -delete
find "$BACKUP_DIR" -name "mongo_*.archive" -mtime "+$RETAIN_DAYS" -delete

echo "[$DATE] Backup complete. Disk usage: $(du -sh "$BACKUP_DIR" | cut -f1)" >> "$LOG"
