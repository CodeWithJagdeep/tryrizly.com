export const GMAIL_PRIMARY_UPDATES_FILTER = "(category:primary OR category:updates)";

export function primaryUpdatesInboxQuery(base: string): string {
  return `${base} in:inbox ${GMAIL_PRIMARY_UPDATES_FILTER}`;
}
