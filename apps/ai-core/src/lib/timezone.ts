/** True if `tz` is a valid IANA timezone name (e.g. "Asia/Kolkata"), false otherwise. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Minutes to add to a UTC instant to get the local wall-clock time in `timeZone`. */
function offsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * The UTC instant for `hour:minute` local wall-clock time, on the same calendar
 * day (in `timeZone`) as `reference`. Use this instead of `Date#setHours`, which
 * always applies the server process's own timezone (UTC in these containers).
 */
export function zonedTimeToUtc(
  reference: Date,
  timeZone: string,
  hour: number,
  minute: number,
): Date {
  const offset = offsetMinutes(timeZone, reference);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const localGuess = new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), hour, minute, 0) - offset * 60_000,
  );
  // Re-check the offset using the resolved instant in case of a DST boundary.
  const refinedOffset = offsetMinutes(timeZone, localGuess);
  if (refinedOffset === offset) return localGuess;
  return new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), hour, minute, 0) - refinedOffset * 60_000,
  );
}

/**
 * The UTC instant for an arbitrary local wall-clock date/time in `timeZone`.
 * Use this instead of asking an LLM to compute a UTC offset itself — models
 * reliably hallucinate the arithmetic (e.g. emitting "-00:0.0054..." instead
 * of "+05:30"). Have the model give you naive local components and convert here.
 */
export function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naiveAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = offsetMinutes(timeZone, new Date(naiveAsUtc));
  const guess = new Date(naiveAsUtc - offset * 60_000);
  const refinedOffset = offsetMinutes(timeZone, guess);
  if (refinedOffset === offset) return guess;
  return new Date(naiveAsUtc - refinedOffset * 60_000);
}

/**
 * Parses a naive "YYYY-MM-DDTHH:mm" (or with :ss) datetime string with no
 * timezone/offset component. Returns undefined if it doesn't match.
 */
export function parseNaiveDateTime(
  value: string,
): { year: number; month: number; day: number; hour: number; minute: number } | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return undefined;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
}

/** Human-readable current time in `timeZone`, e.g. "9:42 AM". */
export function formatLocalTime(instant: Date, timeZone: string): string {
  return instant.toLocaleString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** UTC offset string for `timeZone` at `instant`, e.g. "+05:30" or "-04:00". */
export function offsetString(timeZone: string, instant: Date): string {
  const minutes = offsetMinutes(timeZone, instant);
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/**
 * Friendly event time range for display, e.g. "Wed, Jun 24 · 6:00 – 7:00 PM".
 * Falls back to the raw ISO strings if either fails to parse.
 */
export function formatEventRange(
  startIso: string,
  endIso: string,
  timeZone: string,
): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} → ${endIso}`;
  }
  const datePart = start.toLocaleString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = formatLocalTime(start, timeZone);
  const endTime = formatLocalTime(end, timeZone);
  return `${datePart} · ${startTime} – ${endTime}`;
}

/** Full reference string for grounding an LLM's date/time extraction, e.g. "Wednesday, June 24, 2026, 9:42 AM (Asia/Kolkata, UTC+05:30)". */
export function describeNow(instant: Date, timeZone: string): string {
  const formatted = instant.toLocaleString("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${formatted} (${timeZone}, UTC${offsetString(timeZone, instant)})`;
}
