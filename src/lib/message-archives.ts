const GMT_PLUS_EIGHT_TIME_ZONE = "Asia/Singapore";

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
    formatter.formatToParts(dateLike instanceof Date ? dateLike : new Date(dateLike)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
}

export function formatArchiveWindowLabel(windowStartIso: string, windowEndIso: string) {
  const start = getParts(windowStartIso);
  const end = getParts(windowEndIso);

  return `${start.month} ${start.day}, ${start.year} ${start.hour}:${start.minute}-${end.hour}:${end.minute} GMT+8`;
}

export function formatArchiveExpiryLabel(expiresAtIso: string) {
  const expires = getParts(expiresAtIso);
  return `Expires ${expires.month} ${expires.day}, ${expires.year} ${expires.hour}:${expires.minute} GMT+8`;
}

export function isArchiveVisible(expiresAtIso: string, now = new Date()) {
  return new Date(expiresAtIso).getTime() > now.getTime();
}
