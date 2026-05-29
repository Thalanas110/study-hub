const GMT_PLUS_EIGHT_OFFSET_MS = 8 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const GMT_PLUS_EIGHT_TIME_ZONE = "Asia/Singapore";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDate(dateLike: Date | string) {
  return dateLike instanceof Date ? dateLike : new Date(dateLike);
}

function toGmtPlusEightDate(dateLike: Date | string) {
  const date = toDate(dateLike);
  return new Date(date.getTime() + GMT_PLUS_EIGHT_OFFSET_MS);
}

function getParts(dateLike: Date | string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: GMT_PLUS_EIGHT_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return Object.fromEntries(
    formatter.formatToParts(toDate(dateLike)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
}

function toStamp(dateLike: Date | string) {
  const shifted = toGmtPlusEightDate(dateLike);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}-${pad(shifted.getUTCMinutes())}-${pad(shifted.getUTCSeconds())}+08-00`;
}

export function getArchiveWindow(runAt = new Date()) {
  const shiftedTime = runAt.getTime() + GMT_PLUS_EIGHT_OFFSET_MS;
  const windowEndTime = Math.floor(shiftedTime / SIX_HOURS_MS) * SIX_HOURS_MS - GMT_PLUS_EIGHT_OFFSET_MS;

  return {
    windowStart: new Date(windowEndTime - SIX_HOURS_MS),
    windowEnd: new Date(windowEndTime),
  };
}

export function getArchiveExpiry(createdAt = new Date()) {
  return new Date(createdAt.getTime() + TWELVE_HOURS_MS);
}

export function buildArchiveFileName(windowStart: Date | string, windowEnd: Date | string) {
  return `${toStamp(windowStart)}_${toStamp(windowEnd)}.pdf`;
}

export function buildArchiveStoragePath(groupId: string, windowStart: Date | string, windowEnd: Date | string) {
  const shifted = toGmtPlusEightDate(windowStart);
  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());

  return `${groupId}/${year}/${month}/${day}/${buildArchiveFileName(windowStart, windowEnd)}`;
}

export function formatArchiveWindowLabel(windowStart: Date | string, windowEnd: Date | string) {
  const start = getParts(windowStart);
  const end = getParts(windowEnd);
  return `${start.month} ${start.day}, ${start.year} ${start.hour}:${start.minute}-${end.hour}:${end.minute} GMT+8`;
}

export function formatArchiveMessageTimeLabel(createdAt: Date | string) {
  const parts = getParts(createdAt);
  return `${parts.hour}:${parts.minute}`;
}
